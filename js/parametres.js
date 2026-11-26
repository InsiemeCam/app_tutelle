// =========================================================================
// 9. ADMINISTRATION & PARAMÈTRES (UTILISATEURS, T_PARAM, LOGS, PURGE)
// =========================================================================
async function openParametresModule() {
    showView('view-parametres');
    switchParamTab('utilisateurs');
}

async function switchParamTab(tab) {
    document.querySelectorAll('.param-tab').forEach(b => {
        b.classList.remove('font-bold', 'text-red-900', 'border-b-2', 'border-red-900');
        b.classList.add('font-semibold', 'text-slate-500');
    });
    const activeBtn = $(`tab-btn-${tab}`);
    if (activeBtn) {
        activeBtn.classList.remove('font-semibold', 'text-slate-500');
        activeBtn.classList.add('font-bold', 'text-red-900', 'border-b-2', 'border-red-900');
    }
    document.querySelectorAll('.param-sec').forEach(s => s.classList.add('hidden'));
    $(`param-section-${tab}`)?.classList.remove('hidden');

    if (tab === 'utilisateurs') await loadUsersList();
    if (tab === 'constantes') await loadParamsList();
    if (tab === 'logs') await loadLogsList();
}

async function loadUsersList() {
    const tbody = $('tbody-users-list');
    tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">Chargement des utilisateurs...</td></tr>';

    const { data: res, error } = await supabaseClient.functions.invoke('manage-users', { body: { action: 'list' } });
    if (error || res?.error) {
        const msg = error?.message || res?.error || 'Erreur inconnue';
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-700">Erreur : ${escapeHTML(msg)}</td></tr>`;
        return;
    }

    const users = res?.data || [];
    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">Aucun utilisateur trouvé.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => {
        const role = u.user_metadata?.role || 'CONSULTATION';
        const safeId = escapeHTML(u.id || '');
        const safeEmail = escapeHTML(u.email || '');
        const safeRole = escapeHTML(role);
        return `
        <tr>
            <td class="p-3 font-medium">${safeEmail}</td>
            <td class="p-3"><span class="text-xs font-semibold bg-slate-100 px-2 py-1 rounded">${safeRole}</span></td>
            <td class="p-3 text-right space-x-2">
                <button data-id="${safeId}" data-email="${safeEmail}" data-role="${safeRole}" onclick="editUserRecord(this.dataset.id, this.dataset.email, this.dataset.role)" class="text-xs bg-amber-600 text-white px-2.5 py-1 rounded">Modifier</button>
                <button data-id="${safeId}" data-email="${safeEmail}" onclick="deleteUserRecord(this.dataset.id, this.dataset.email)" class="text-xs bg-red-800 text-white px-2.5 py-1 rounded">Supprimer</button>
            </td>
        </tr>`;
    }).join('');
}

function openModalUser() {
    $('modal-user-title').innerText = 'Nouvel utilisateur';
    $('modal-user-old-id').value = '';
    $('modal-user-email').value = '';
    $('modal-user-email').disabled = false;
    $('modal-user-pass').value = '';
    $('modal-user-type').value = 'CONSULTATION';
    toggleModal('modal-user', true);
}

function editUserRecord(id, email, role) {
    $('modal-user-title').innerText = 'Modifier : ' + email;
    $('modal-user-old-id').value = id;
    $('modal-user-email').value = email;
    $('modal-user-email').disabled = true;
    $('modal-user-pass').value = '';
    $('modal-user-type').value = role || 'CONSULTATION';
    toggleModal('modal-user', true);
}

async function saveUserRecord() {
    const id = $('modal-user-old-id').value;
    const email = $('modal-user-email').value.trim();
    const password = $('modal-user-pass').value;
    const role = $('modal-user-type').value;
    if (!email || (!id && !password)) return alert("Email et mot de passe requis.");

    const payload = { id, email, role, ...(password && { password }) };
    const { data: res, error } = await supabaseClient.functions.invoke('manage-users', {
        body: { action: id ? 'update' : 'create', payload }
    });
    if (error || res?.error) return alert("Erreur : " + (error?.message || res?.error));

    toggleModal('modal-user', false);
    await loadUsersList();
}

async function deleteUserRecord(id, email) {
    if (!confirm(`Supprimer le compte de "${email}" ?`)) return;
    const { data: res, error } = await supabaseClient.functions.invoke('manage-users', {
        body: { action: 'delete', payload: { id } }
    });
    if (error || res?.error) return alert("Erreur : " + (error?.message || res?.error));
    await loadUsersList();
}

const EXCLUDED_PARAM_COLS = new Set([
    'id', 'PARAM_id', 'created_at', 'updated_at', 'N°',
    'PARAM_MODELE_AVENANT_CE', 'PARAM_MODELE_CONTRAT_CE',
    'PARAM_MODELE_CR_TRIENNAL', 'PARAM_MAIL_VT',
    'MODELE_WORD_AVENANT', 'MODELE_WORD_CONTRAT', 'MODELE_MAIL_VT'
]);

function getParamPrimaryKey(paramRow) {
    if (!paramRow || typeof paramRow !== 'object') return null;
    const candidates = ['PARAM_id', 'id', 'N°', 'ID', 'param_id'];
    for (const c of candidates) {
        if (Object.prototype.hasOwnProperty.call(paramRow, c) && paramRow[c] !== null && paramRow[c] !== undefined) {
            return { col: c, val: paramRow[c] };
        }
    }
    const firstKey = Object.keys(paramRow)[0];
    return firstKey ? { col: firstKey, val: paramRow[firstKey] } : null;
}

async function loadParamsList() {
    const tbody = $('tbody-params-list');
    tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">Chargement des paramètres...</td></tr>';

    const { data: rows, error } = await supabaseClient.from('T_PARAM').select('*');
    if (error) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-700">Erreur : ${escapeHTML(error.message)}</td></tr>`;
        return;
    }
    if (!rows || !rows.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">Aucun paramètre trouvé dans T_PARAM.</td></tr>';
        return;
    }

    // Cas 1 : Table clé/valeur (colonnes PARAM_key / PARAM_val)
    if (Object.prototype.hasOwnProperty.call(rows[0], 'PARAM_key')) {
        tbody.innerHTML = rows.map(p => `
            <tr>
                <td class="p-3 font-mono font-bold text-xs">${escapeHTML(p.PARAM_key)}</td>
                <td class="p-3 text-xs max-w-md truncate">${escapeHTML(p.PARAM_val ?? '')}</td>
                <td class="p-3 text-right">
                    <button data-key="${escapeHTML(p.PARAM_key)}" data-val="${encodeURIComponent(p.PARAM_val ?? '')}" onclick="openModalParam(this.dataset.key, decodeURIComponent(this.dataset.val))" class="text-xs bg-amber-600 text-white px-2.5 py-1 rounded">Modifier</button>
                </td>
            </tr>`).join('');
        return;
    }

    // Cas 2 : Table mono-ligne avec une colonne par paramètre (structure historique T_PARAM)
    const paramRow = rows[0];
    tbody.innerHTML = Object.entries(paramRow)
        .filter(([k]) => !EXCLUDED_PARAM_COLS.has(k))
        .map(([k, v]) => `
            <tr>
                <td class="p-3 font-mono font-bold text-xs">${escapeHTML(k)}</td>
                <td class="p-3 font-mono text-xs max-w-md truncate">${escapeHTML(v ?? '')}</td>
                <td class="p-3 text-right">
                    <button data-key="${escapeHTML(k)}" data-val="${encodeURIComponent(v ?? '')}" onclick="openModalParam(this.dataset.key, decodeURIComponent(this.dataset.val))" class="text-xs bg-amber-600 text-white px-2.5 py-1 rounded">Modifier</button>
                </td>
            </tr>`).join('');
}

function openModalParam(key, val) {
    $('modal-param-old-id').value = key;
    $('modal-param-key').value = key;
    $('modal-param-val').value = val;
    toggleModal('modal-param', true);
}

async function saveParamRecord() {
    const key = $('modal-param-old-id').value;
    const raw = $('modal-param-val').value.trim();

    try {
        const { data: rows, error: errSel } = await supabaseClient.from('T_PARAM').select('*');
        if (errSel) throw errSel;

        // Cas 1 : Table clé/valeur (PARAM_key / PARAM_val)
        if (rows && rows.length && Object.prototype.hasOwnProperty.call(rows[0], 'PARAM_key')) {
            const { error } = await supabaseClient.from('T_PARAM').update({ PARAM_val: raw }).eq('PARAM_key', key);
            if (error) throw error;
        } else {
            // Cas 2 : Table mono-ligne en colonnes
            const val = raw === '' ? null : (!isNaN(raw.replace(',', '.')) ? parseFloat(raw.replace(',', '.')) : raw);
            const paramRow = rows?.[0];
            if (!paramRow) {
                const { error: errIns } = await supabaseClient.from('T_PARAM').insert([{ [key]: val }]);
                if (errIns) throw errIns;
            } else {
                const pk = getParamPrimaryKey(paramRow);
                if (!pk) throw new Error("Clé primaire introuvable dans T_PARAM.");
                const { error: errUpd } = await supabaseClient.from('T_PARAM').update({ [key]: val }).eq(pk.col, pk.val);
                if (errUpd) throw errUpd;
            }
        }

        toggleModal('modal-param', false);
        await loadParamsList();
    } catch (e) {
        alert("Erreur lors de l'enregistrement du paramètre : " + e.message);
    }
}

async function loadLogsList() {
    const { data } = await supabaseClient.from('T_LOG_CONNEXION').select('*').order('LOG_date', { ascending: false }).limit(200);
    $('tbody-logs-list').innerHTML = (data || []).map(l => `
        <tr><td class="p-3">${escapeHTML(l.LOG_utilisateur || '')}</td><td class="p-3 font-mono">${formatDateFR(l.LOG_date)}</td><td class="p-3 font-mono">${escapeHTML(l.LOG_heure || '')}</td></tr>`).join('');
}

async function purgerLogsConnexion() {
    const d = $('input-purge-date').value;
    if (!d || !confirm(`Supprimer les journaux antérieurs au ${formatDateFR(d)} ?`)) return;
    await supabaseClient.from('T_LOG_CONNEXION').delete().lt('LOG_date', d);
    await loadLogsList();
}

async function rechercherPersonnesOrphelins() {
    const [{ data: persons }, { data: ups }, { data: ogecs }, { data: apels }] = await Promise.all([
        supabaseClient.from('T_PERSONNES').select('PERS_id, PERS_Civilite, PERS_NOM, PERS_Prenom, PERS_Type, PERS_courriel1').order('PERS_NOM'),
        supabaseClient.from('T_UNITE_PEDAGOGIQUE').select('UP_chefetablissement, UP_adjoint, UP_APS, UP_secretaire'),
        supabaseClient.from('T_OGEC').select('"OGEC_président", OGEC_vicepresident, OGEC_tresorier, OGEC_secretaire'),
        supabaseClient.from('T_APEL').select('APEL_president, APEL_vicepresident, APEL_tresorier, APEL_secretaire')
    ]);

    const usedIds = new Set();
    const collect = (arr) => (arr || []).forEach(row => Object.values(row).forEach(v => { if (v) usedIds.add(String(v).trim()); }));
    collect(ups); collect(ogecs); collect(apels);

    const orphelins = (persons || []).filter(p => (p.PERS_Type || '').toUpperCase() !== 'TUTELLE' && !usedIds.has(String(p.PERS_id).trim()));
    $('compteurOrphelins').innerText = orphelins.length;
    $('zoneResultatsPurge').classList.remove('hidden');

    $('listeCheckboxesPurge').innerHTML = !orphelins.length
        ? '<p class="text-center text-slate-400 text-sm py-4">Aucune fiche orpheline trouvée.</p>'
        : orphelins.map(p => `
            <label class="flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer text-sm">
                <span class="flex items-center gap-2">
                    <input type="checkbox" checked value="${p.PERS_id}" class="chk-purge-personne w-4 h-4 text-red-900 rounded">
                    <strong>${escapeHTML(p.PERS_Civilite || '')} ${escapeHTML(p.PERS_NOM)} ${escapeHTML(p.PERS_Prenom)}</strong>
                    <span class="text-xs bg-slate-100 px-2 py-0.5 rounded">${escapeHTML(p.PERS_Type || '')}</span>
                </span>
                <span class="text-xs text-slate-500">${escapeHTML(p.PERS_courriel1 || '')}</span>
            </label>`).join('');
}

async function executerPurgePersonnes() {
    const ids = [...document.querySelectorAll('.chk-purge-personne:checked')].map(cb => cb.value);
    if (!ids.length) return alert("Aucune fiche sélectionnée.");
    if (!confirm(`Supprimer définitivement ${ids.length} fiche(s) personne(s) ?`)) return;

    const { error } = await supabaseClient.from('T_PERSONNES').delete().in('PERS_id', ids);
    if (error) return alert("Erreur lors de la suppression : " + error.message);
    alert(`✅ ${ids.length} fiche(s) supprimée(s).`);
    appState.cachePersonMap = null;
    await rechercherPersonnesOrphelins();
}
