// =========================================================================
// 3. INITIALISATION & AUTHENTIFICATION (SÉCURISÉE + PERSISTANCE)
// =========================================================================
window.addEventListener('DOMContentLoaded', async () => {
    const isRecovery = window.location.hash?.includes('type=recovery');
    if (isRecovery) toggleModal('modal-reset-password', true);

    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (accessToken && refreshToken) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        const { data, error } = await supabaseClient.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (!error && data?.user && !isRecovery) {
            await initSessionUI(data.user);
            return;
        }
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user && !isRecovery) {
        await initSessionUI(session.user);
    } else if (!session?.user) {
        $('user-session-info').classList.add('hidden');
        showView('view-login');
    }
});

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
        toggleModal('modal-reset-password', true);
        return;
    }
    if (event === 'SIGNED_OUT') {
        appState.userId = null;
        $('user-session-info').classList.add('hidden');
        showView('view-login');
    } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        const isRecovering = !$('modal-reset-password').classList.contains('hidden');
        if (!appState.pendingMfaFactorId && !isRecovering && appState.userId !== session.user.id) {
            await initSessionUI(session.user);
        }
    }
});

async function validerNouveauMotDePasse(event) {
    event.preventDefault();
    const pwd1 = $('input-new-password').value;
    const pwd2 = $('input-confirm-password').value;
    if (pwd1 !== pwd2) return alert("Les deux mots de passe ne correspondent pas.");

    const btn = $('btn-submit-new-pwd');
    btn.disabled = true; btn.innerText = "Enregistrement...";
    const { error } = await supabaseClient.auth.updateUser({ password: pwd1 });
    btn.disabled = false; btn.innerText = "Enregistrer le mot de passe";

    if (error) return alert("Erreur lors de la mise à jour : " + error.message);
    alert("✅ Votre mot de passe a été modifié avec succès !");
    toggleModal('modal-reset-password', false);
    window.history.replaceState({}, document.title, window.location.pathname);

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user && appState.userId !== session.user.id) await initSessionUI(session.user);
}

const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const LOCKOUT_STORAGE_KEY = 'app_tutelle_login_security';
let lockoutTimerInterval = null;

const getLoginSecurityState = () => {
    try { return JSON.parse(localStorage.getItem(LOCKOUT_STORAGE_KEY)) || { attempts: 0, lockedUntil: null }; }
    catch { return { attempts: 0, lockedUntil: null }; }
};

const saveLoginSecurityState = (state) => {
    try { localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(state)); } catch {}
};

const resetLoginSecurityState = () => {
    try { localStorage.removeItem(LOCKOUT_STORAGE_KEY); } catch {}
    if (lockoutTimerInterval) { clearInterval(lockoutTimerInterval); lockoutTimerInterval = null; }
};

function setLoginFeedback(html, show = true) {
    const el = $('login-attempts');
    if (!el) return;
    el.innerHTML = html;
    el.classList.toggle('hidden', !show);
}

function setLoginButtonLocked(locked) {
    const btn = $('btn-login-submit');
    if (!btn) return;
    btn.disabled = locked;
    btn.classList.toggle('opacity-50', locked);
    btn.classList.toggle('cursor-not-allowed', locked);
}

function checkAndApplyLoginLockout() {
    const state = getLoginSecurityState();
    if (!state.lockedUntil) return false;
    const remainingMs = state.lockedUntil - Date.now();
    if (remainingMs <= 0) {
        resetLoginSecurityState();
        setLoginButtonLocked(false);
        setLoginFeedback('', false);
        return false;
    }
    setLoginButtonLocked(true);
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, '0');
    setLoginFeedback(`🔒 Trop de tentatives échouées. Accès bloqué pendant <strong>${mins} min ${secs} s</strong>.`, true);
    if (!lockoutTimerInterval) lockoutTimerInterval = setInterval(checkAndApplyLoginLockout, 1000);
    return true;
}

checkAndApplyLoginLockout();

async function handleLogin(e) {
    if (e) e.preventDefault();
    if (checkAndApplyLoginLockout()) return;

    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    setLoginFeedback('', false);
    setLoginButtonLocked(true);

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            const state = getLoginSecurityState();
            state.attempts += 1;
            if (state.attempts >= MAX_LOGIN_ATTEMPTS) {
                state.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
                saveLoginSecurityState(state);
                checkAndApplyLoginLockout();
            } else {
                saveLoginSecurityState(state);
                setLoginButtonLocked(false);
                const rest = MAX_LOGIN_ATTEMPTS - state.attempts;
                const msg = error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : error.message;
                setLoginFeedback(`⚠️ ${msg} (${state.attempts}/${MAX_LOGIN_ATTEMPTS}). Il vous reste <strong>${rest}</strong> tentative${rest > 1 ? 's' : ''}.`, true);
            }
            return;
        }

        resetLoginSecurityState();
        setLoginButtonLocked(false);

        const { data: factors } = await supabaseClient.auth.mfa.listFactors();
        const totpFactor = factors?.totp?.find(f => f.status === 'verified');
        if (totpFactor) {
            appState.pendingMfaFactorId = totpFactor.id;
            $('mfa-code-input').value = '';
            toggleModal('modal-mfa', true);
            return;
        }
        if (data?.user) await initSessionUI(data.user);
    } catch {
        setLoginButtonLocked(false);
        setLoginFeedback("⚠️ Erreur de communication avec le serveur d'authentification.", true);
    }
}

async function verifyMfaCode() {
    const code = $('mfa-code-input').value.trim();
    if (code.length !== 6) return alert("Veuillez saisir un code à 6 chiffres.");
    const { data: challenge } = await supabaseClient.auth.mfa.challenge({ factorId: appState.pendingMfaFactorId });
    const { data, error } = await supabaseClient.auth.mfa.verify({ factorId: appState.pendingMfaFactorId, challengeId: challenge.id, code });
    if (error) return alert("Code invalide : " + error.message);
    appState.pendingMfaFactorId = null;
    toggleModal('modal-mfa', false);
    if (data?.user) await initSessionUI(data.user);
}

function togglePasswordVisibility(inputId) {
    const input = $(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

async function requestPasswordReset() {
    const email = $('login-email').value.trim();
    if (!email) return alert("Veuillez d'abord saisir votre adresse email.");
    if (!confirm(`Envoyer un lien de réinitialisation à : ${email} ?`)) return;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
    alert(error ? "Erreur : " + error.message : `Un lien de réinitialisation a été envoyé à ${email}.`);
}

function applyRoleMenuPermissions(rawRole) {
    const role = String(rawRole || 'CONSULTATION').trim().toUpperCase();
    appState.role = role;

    const isAdmin = role === 'ADMINISTRATION';
    const canEdit = role === 'ADMINISTRATION' || role === 'MODIFICATION';

    const setMenuBtnVisible = (id, visible) => {
        const el = $(id);
        if (!el) return;
        el.classList.toggle('hidden', !visible);
        el.style.display = visible ? 'flex' : 'none';
    };

    setMenuBtnVisible('btn-menu-enquetes', canEdit);
    setMenuBtnVisible('btn-menu-collectifs', canEdit);
    setMenuBtnVisible('btn-menu-carriere', isAdmin);
    setMenuBtnVisible('btn-menu-facturation', isAdmin);
    setMenuBtnVisible('btn-menu-vt', isAdmin);
    setMenuBtnVisible('btn-menu-parametres', isAdmin);

    if ($('btn-enquetes-campagnes-section')) {
        $('btn-enquetes-campagnes-section').style.display = isAdmin ? 'block' : 'none';
    }
    if ($('btn-enquetes-edit-section')) {
        $('btn-enquetes-edit-section').style.display = canEdit ? 'block' : 'none';
    }
}

async function initSessionUI(user) {
    const rawRole = user.user_metadata?.role || user.app_metadata?.role || 'CONSULTATION';
    applyRoleMenuPermissions(rawRole);

    $('lbl-current-user').innerText = user.email || '';
    $('lbl-current-role').innerText = appState.role;
    $('user-session-info').classList.remove('hidden');

    if (appState.userId === user.id) return;
    appState.userId = user.id;

    showView('view-main-menu');

    await Promise.all([loadAllDropdownReferences(), loadAnneesScolairesSelect()]);

    const now = new Date();
    await supabaseClient.from('T_LOG_CONNEXION').insert([{
        LOG_utilisateur: user.email,
        LOG_date: now.toISOString().split('T')[0],
        LOG_heure: now.toTimeString().split(' ')[0]
    }]);
}

async function logout() {
    await supabaseClient.auth.signOut();
    appState.userId = null;
    appState.role = '';
    applyRoleMenuPermissions('CONSULTATION');
    $('login-password').value = '';
    $('user-session-info').classList.add('hidden');
    showView('view-login');
}
