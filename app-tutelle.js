        // =========================================================================
        // 1. CONFIGURATION & ÉTAT GLOBAL
        // =========================================================================
        const SUPABASE_URL = 'https://ugrmpawukiyiutjufizb.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVncm1wYXd1a2l5aXV0anVmaXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxODE1MDMsImV4cCI6MjEwMzc1NzUwM30.XhxxvEoEhYlvh-rekBXhAREUtYuljwES2fAyM7TwJvo';
        const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } });

        const entityConfig = {
            personnes: { table: 'T_PERSONNES', pk: 'PERS_id', labelField: 'PERS_NOM', searchFields: ['PERS_NOM', 'PERS_Prenom'] },
            etablissements: { table: 'T_ETABLISSEMENT', pk: 'ETAB_id', labelField: 'ETAB_nom', searchFields: ['ETAB_nom', 'ETAB_ville'] },
            unites_pedagogiques: { table: 'T_UNITE_PEDAGOGIQUE', pk: 'UP_id', labelField: 'UP_NOM', searchFields: ['UP_NOM', 'UP_ville'] },
            ogec: { table: 'T_OGEC', pk: 'OGEC_id', labelField: 'OGEC_nom', searchFields: ['OGEC_nom', 'OGEC_ville'] },
            apel: { table: 'T_APEL', pk: 'APEL_id', labelField: 'APEL_nom', searchFields: ['APEL_nom', 'APEL_ville'] },
            dioceses: { table: 'T_DIOCESE', pk: 'DIO_id', labelField: 'DIO_NOM', searchFields: ['DIO_NOM'] }
        };

        const ENQUETES_CONFIG = {
            economique: { url: 'https://mericiens.eu/enquete-economique-etablissement/', limite: '28 février', paramKey: 'ECO_id', titre: 'Enquête Données Économiques' },
            effectif_eleves: { url: 'https://mericiens.eu/enquete-effectif-eleves/', limite: '15 septembre', paramKey: 'EFFECTIF_etab', titre: 'Enquête Effectifs Élèves' },
            effectif_personnel: { url: 'https://mericiens.eu/enquete-personnel/', limite: '15 septembre', paramKey: 'EFF_id', titre: 'Enquête Effectifs Personnel' }
        };

        const PERSON_SELECT_MAP = {
            "CHEF D'ETABLISSEMENT": ['UP_chefetablissement'],
            'ADJOINT': ['UP_adjoint'],
            'APS': ['UP_APS'],
            'SECRETAIRE': ['UP_secretaire'],
            'OGEC': ['OGEC_président', 'OGEC_vicepresident', 'OGEC_tresorier', 'OGEC_secretaire'],
            'APEL': ['APEL_president', 'APEL_vicepresident', 'APEL_tresorier', 'APEL_secretaire']
        };

        let failedAttempts = 0, currentUserRole = '', currentEntity = 'personnes', currentMode = 'create';
        let selectedRecordId = null, allRecords = [], pendingMfaFactorId = null, currentCampagneType = '';
        let chefsCampagneList = [], personnesCollectifList = [], currentTarifsRecord = null, calculatedFacturesList = [];
        const exportStore = { personnes: [], etablissements: [], ogec: [], apel: [], dioceses: [], synthese_eco: [], eff_personnel: [], effectifs_6ans: [], emprunteur: [] };

        // =========================================================================
        // 2. UTILITAIRES GÉNÉRIQUES (VUES, MODALES, FORMATAGE, FICHIERS)
        // =========================================================================
        const showView = (viewId) => {
            document.querySelectorAll('.app-view').forEach(el => el.classList.add('hidden'));
            document.getElementById(viewId)?.classList.remove('hidden');
        };

        const openSubMenu = (menu) => {
            const map = { 'saisie-consultation': 'view-submenu-saisie', 'editions': 'view-submenu-editions', 'courriels-enquetes': 'view-courriels-enquetes', 'carriere-ce': 'view-carriere', 'parametres': 'view-parametres', 'facturation': 'view-submenu-facturation' };
            if (map[menu]) showView(map[menu]);
        };

        const toggleModal = (id, show) => document.getElementById(id)?.classList.toggle('hidden', !show);

        const toggleCheckboxes = (selector, checked, callback) => {
            document.querySelectorAll(selector).forEach(cb => cb.checked = checked);
            if (callback) callback();
        };

        const fmtCurrency = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v || 0);

        const fileToBase64 = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({ filename: file.name, content: reader.result.split(',')[1] });
            reader.onerror = reject;
        });

        async function getPersonMap() {
            const { data } = await supabaseClient.from('T_PERSONNES').select('PERS_id, PERS_Civilite, PERS_NOM, PERS_Prenom');
            return Object.fromEntries((data || []).map(p => [p.PERS_id, `${p.PERS_Civilite || ''} ${p.PERS_NOM} ${p.PERS_Prenom}`.trim()]));
        }

        // =========================================================================
        // 3. INITIALISATION & AUTHENTIFICATION
        // =========================================================================
    const WORDPRESS_LOGIN_URL = "https://mericiens.eu/application-tutelle-mericienne/";
    window.onload = async () => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (accessToken && refreshToken) {
        // Efface immédiatement les jetons de la barre d'adresse
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        const { data, error } = await supabaseClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });
        if (!error && data?.user) {
            await initSessionUI(data.user);
            return;
        }
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
        await initSessionUI(session.user);
    } else {
        // Si personne n'est connecté, retour automatique sur la page de login WordPress
        window.location.href = WORDPRESS_LOGIN_URL;
    }
};
        async function handleLogin() {
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const attemptText = document.getElementById('login-attempts');

            if (!email || !password) return alert("Veuillez renseigner l'email et le mot de passe.");

            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                failedAttempts++;
                attemptText.classList.remove('hidden');
                attemptText.innerText = `Tentative (${failedAttempts}/3) : Identifiants incorrects`;
                if (failedAttempts >= 3) document.body.innerHTML = "<div class='flex items-center justify-center h-screen text-xl font-bold text-red-700'>Accès temporairement verrouillé.</div>";
                return;
            }

            failedAttempts = 0;
            attemptText.classList.add('hidden');

            const { data: mfaFactors } = await supabaseClient.auth.mfa.listFactors();
            const verifiedFactor = mfaFactors?.totp?.find(f => f.status === 'verified');
            if (verifiedFactor) {
                pendingMfaFactorId = verifiedFactor.id;
                document.getElementById('mfa-code-input').value = '';
                toggleModal('modal-mfa', true);
                return;
            }
            if (data?.user) await initSessionUI(data.user);
        }

        async function verifyMfaCode() {
            const code = document.getElementById('mfa-code-input').value.trim();
            if (code.length !== 6) return alert("Veuillez saisir un code à 6 chiffres.");
            const { data: challenge } = await supabaseClient.auth.mfa.challenge({ factorId: pendingMfaFactorId });
            const { data, error } = await supabaseClient.auth.mfa.verify({ factorId: pendingMfaFactorId, challengeId: challenge.id, code });
            if (error) return alert("Code invalide : " + error.message);
            toggleModal('modal-mfa', false);
            if (data?.user) await initSessionUI(data.user);
        }

        function togglePasswordVisibility(inputId, iconId) {
            const input = document.getElementById(inputId);
            input.type = input.type === 'password' ? 'text' : 'password';
        }

        async function requestPasswordReset() {
            const email = document.getElementById('login-email').value.trim();
            if (!email) return alert("Veuillez d'abord saisir votre adresse email.");
            if (!confirm(`Envoyer un lien de réinitialisation à : ${email} ?`)) return;
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
            alert(error ? "Erreur : " + error.message : `Un lien de réinitialisation a été envoyé à ${email}.`);
        }

        async function initSessionUI(user) {
            currentUserRole = user.user_metadata?.role || 'CONSULTATION';
            document.getElementById('lbl-current-user').innerText = user.email || '';
            document.getElementById('lbl-current-role').innerText = currentUserRole;
            document.getElementById('user-session-info').classList.remove('hidden');

            showView('view-main-menu');
            const isAdmin = currentUserRole === 'ADMINISTRATION';
            ['btn-menu-enquetes', 'btn-menu-carriere', 'btn-menu-parametres'].forEach(id => {
                document.getElementById(id).style.display = isAdmin ? 'flex' : 'none';
            });

            await Promise.all([
                loadAllDropdownReferences(),
                loadEtablissementsSelect(),
                loadAnneesScolairesSelect()
            ]);

            const now = new Date();
            await supabaseClient.from('T_LOG_CONNEXION').insert([{ LOG_utilisateur: user.email, LOG_date: now.toISOString().split('T')[0], LOG_heure: now.toTimeString().split(' ')[0] }]);
        }

        async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = WORDPRESS_LOGIN_URL;
}

        // =========================================================================
        // 4. CRUD GÉNÉRIQUE & MODALE RAPIDE PERSONNE
        // =========================================================================
        function selectEntityModule(entityName) {
            currentEntity = entityName;
            const isConsult = currentUserRole === 'CONSULTATION';
            document.getElementById('btn-mode-create').style.display = isConsult ? 'none' : 'block';
            document.getElementById('btn-mode-modify').style.display = isConsult ? 'none' : 'block';
            document.getElementById('choice-main-title').innerText = `Gestion des ${entityName.charAt(0).toUpperCase() + entityName.slice(1)}`;
            showView('view-choice');
        }

        async function selectMode(mode) {
            currentMode = mode;
            if (mode === 'create') return openForm(null);
            document.getElementById('search-title').innerText = mode === 'consult' ? "Consulter une fiche" : "Modifier une fiche";
            document.getElementById('search-action-btn').innerText = mode === 'consult' ? "Consulter" : "Modifier";
            const config = entityConfig[currentEntity];
            const { data } = await supabaseClient.from(config.table).select('*').order(config.labelField);
            allRecords = data || [];
            renderSearchList(allRecords);
            showView('view-search');
        }

        function filterSearchList() {
            const q = document.getElementById('search-input').value.toLowerCase();
            const cfg = entityConfig[currentEntity];
            renderSearchList(allRecords.filter(r => cfg.searchFields.some(f => (r[f] || '').toLowerCase().includes(q))));
        }

        function renderSearchList(list) {
            const cfg = entityConfig[currentEntity];
            document.getElementById('search-select').innerHTML = list.map(r => 
                `<option value="${r[cfg.pk]}">${r[cfg.labelField] || ''} ${r[cfg.searchFields[1]] ? '(' + r[cfg.searchFields[1]] + ')' : ''}</option>`
            ).join('');
        }

        async function loadSelectedRecord() {
            const id = document.getElementById('search-select').value;
            if (!id) return alert("Veuillez sélectionner une fiche.");
            const cfg = entityConfig[currentEntity];
            const { data } = await supabaseClient.from(cfg.table).select('*').eq(cfg.pk, id).single();
            openForm(data);
        }

        async function openForm(record) {
            showView(`view-form-${currentEntity}`);
            const isConsult = currentMode === 'consult' || currentUserRole === 'CONSULTATION';
            document.querySelectorAll(`#view-form-${currentEntity} input, #view-form-${currentEntity} select`).forEach(el => {
                el.disabled = isConsult;
                el.classList.toggle('bg-slate-100', isConsult);
            });
            document.getElementById(`submit-btn-${currentEntity}`).style.display = isConsult ? 'none' : 'block';

            const pkField = document.getElementById(entityConfig[currentEntity].pk);
            if (pkField) { pkField.disabled = true; pkField.readOnly = true; }

            if (record) {
                Object.entries(record).forEach(([k, v]) => { const f = document.getElementById(k); if (f) f.value = v || ''; });
                selectedRecordId = record[entityConfig[currentEntity].pk];
                if (currentEntity === 'personnes') await loadPersonPhoto(record);
            } else {
                document.getElementById(`form-${currentEntity}-data`).reset();
                selectedRecordId = null;
                if (pkField) pkField.value = 'Génération automatique...';
            }
        }

        async function loadPersonPhoto(person) {
            const preview = document.getElementById('photo-preview'), placeholder = document.getElementById('photo-placeholder');
            preview.classList.add('hidden'); placeholder.classList.remove('hidden'); placeholder.innerText = "Chargement...";
            try {
                const { data } = await supabaseClient.storage.from('Photos_personnes').download(person.PERS_photo || `${person.PERS_id}.jpg`);
                if (data) { preview.src = URL.createObjectURL(data); preview.classList.remove('hidden'); placeholder.classList.add('hidden'); }
                else placeholder.innerText = "Aucune photo";
            } catch { placeholder.innerText = "Aucune photo"; }
        }

        async function saveRecord(event, entity) {
            event.preventDefault();
            if (currentMode === 'consult' || currentUserRole === 'CONSULTATION') return;

            const cfg = entityConfig[entity], formData = {};
            document.getElementById(`form-${entity}-data`).querySelectorAll('input, select').forEach(el => {
                if (el.id && el.id !== cfg.pk && el.type !== 'file') {
                    formData[el.id] = el.type === 'number' ? (el.value ? parseFloat(el.value) : null) : (el.value !== "" ? el.value : null);
                }
            });

            let recordId = selectedRecordId;
            if (currentMode === 'create') {
                const { data, error } = await supabaseClient.from(cfg.table).insert([formData]).select();
                if (error) return alert("Erreur : " + error.message);
                recordId = data?.[0]?.[cfg.pk];
            } else {
                const { error } = await supabaseClient.from(cfg.table).update(formData).eq(cfg.pk, recordId);
                if (error) return alert("Erreur : " + error.message);
            }

            if (entity === 'personnes' && recordId) {
                const file = document.getElementById('photo-file')?.files[0];
                if (file) {
                    const fileName = `${recordId}.${file.name.split('.').pop()}`;
                    const { error: upErr } = await supabaseClient.storage.from('Photos_personnes').upload(fileName, file, { upsert: true });
                    if (!upErr) await supabaseClient.from('T_PERSONNES').update({ PERS_photo: fileName }).eq('PERS_id', recordId);
                }
            }
            await loadAllDropdownReferences();
            alert("Opération effectuée avec succès !");
            showView('view-choice');
        }

        async function loadAllDropdownReferences() {
            const [etabRes, dioRes, ogecRes, apelRes] = await Promise.all([
                supabaseClient.from('T_ETABLISSEMENT').select('ETAB_id, ETAB_nom, ETAB_ville').order('ETAB_ville'),
                supabaseClient.from('T_DIOCESE').select('DIO_id, DIO_NOM').order('DIO_NOM'),
                supabaseClient.from('T_OGEC').select('OGEC_id, OGEC_nom, OGEC_ville').order('OGEC_nom'),
                supabaseClient.from('T_APEL').select('APEL_id, APEL_nom, APEL_ville').order('APEL_nom')
            ]);

            const fillSelect = (id, list, labelFn, placeholder) => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = `<option value="">${placeholder}</option>` + (list || []).map(labelFn).join('');
            };

            ['PERS_etab', 'UP_etablissement'].forEach(id => fillSelect(id, etabRes.data, e => `<option value="${e.ETAB_id}">${e.ETAB_ville} - ${e.ETAB_nom}</option>`, '-- Choisir un établissement --'));
            fillSelect('ETAB_DIO', dioRes.data, d => `<option value="${d.DIO_id}">${d.DIO_NOM}</option>`, '-- Choisir un diocèse --');
            fillSelect('ETAB_OGEC', ogecRes.data, o => `<option value="${o.OGEC_id}">${o.OGEC_nom} (${o.OGEC_ville})</option>`, '-- Choisir un OGEC --');
            fillSelect('ETAB_apel', apelRes.data, a => `<option value="${a.APEL_id}">${a.APEL_nom} (${a.APEL_ville})</option>`, '-- Choisir une APEL --');

            await refreshAllPersonDropdowns();
        }

        async function refreshAllPersonDropdowns() {
            const { data: persons } = await supabaseClient.from('T_PERSONNES').select('PERS_id, PERS_NOM, PERS_Prenom, PERS_Type').order('PERS_NOM');
            Object.entries(PERSON_SELECT_MAP).forEach(([pType, selectIds]) => {
                const filtered = (persons || []).filter(p => (p.PERS_Type || '').toUpperCase().includes(pType));
                selectIds.forEach(id => {
                    const sel = document.getElementById(id);
                    if (!sel) return;
                    const prev = sel.value;
                    sel.innerHTML = '<option value="">-- Choisir --</option>' +
                        filtered.map(p => `<option value="${p.PERS_id}">${p.PERS_NOM} ${p.PERS_Prenom}</option>`).join('') +
                        '<option value="__NEW_PERSON__" class="font-bold text-red-900 bg-red-50">➕ Créer une nouvelle personne...</option>';
                    if (prev && prev !== '__NEW_PERSON__') sel.value = prev;
                    if (!sel.dataset.bound) {
                        sel.addEventListener('change', function () {
                            if (this.value === '__NEW_PERSON__') { this.value = ''; openQuickPersonModal(this.id); }
                        });
                        sel.dataset.bound = 'true';
                    }
                });
            });
        }

        function openQuickPersonModal(targetSelectId) {
            document.getElementById('quick-pers-target-select').value = targetSelectId;
            ['quick-pers-nom', 'quick-pers-prenom', 'quick-pers-tel', 'quick-pers-mail'].forEach(id => document.getElementById(id).value = '');
            const typeSelect = document.getElementById('quick-pers-type');
            if (targetSelectId.startsWith('OGEC_')) typeSelect.value = 'OGEC';
            else if (targetSelectId.startsWith('APEL_')) typeSelect.value = 'APEL';
            else if (targetSelectId === 'UP_chefetablissement') typeSelect.value = "CHEF D'ETABLISSEMENT";
            else if (targetSelectId === 'UP_adjoint') typeSelect.value = 'ADJOINT';
            else if (targetSelectId === 'UP_APS') typeSelect.value = 'APS';
            else if (targetSelectId === 'UP_secretaire') typeSelect.value = 'SECRETAIRE';
            else typeSelect.value = 'AUTRE';
            toggleModal('modal-quick-person', true);
        }

        async function saveQuickPerson() {
            const targetId = document.getElementById('quick-pers-target-select').value;
            const nom = document.getElementById('quick-pers-nom').value.trim().toUpperCase();
            const prenom = document.getElementById('quick-pers-prenom').value.trim();
            if (!nom || !prenom) return alert("Veuillez renseigner le nom et le prénom.");

            const { data, error } = await supabaseClient.from('T_PERSONNES').insert([{
                PERS_Civilite: document.getElementById('quick-pers-civilite').value,
                PERS_NOM: nom, PERS_Prenom: prenom,
                PERS_Type: document.getElementById('quick-pers-type').value,
                PERS_Telephoneportable: document.getElementById('quick-pers-tel').value.trim() || null,
                PERS_courriel1: document.getElementById('quick-pers-mail').value.trim() || null
            }]).select('PERS_id').single();

            if (error) return alert("Erreur : " + error.message);
            await refreshAllPersonDropdowns();
            if (data) document.getElementById(targetId).value = data.PERS_id;
            toggleModal('modal-quick-person', false);
        }

        // =========================================================================
        // 5. ÉDITIONS & ANNUAIRES
        // =========================================================================
        async function generateAnnuairePersonnes() {
            const selectedType = document.getElementById('filter-pers-type').value;
            let q = supabaseClient.from('T_PERSONNES').select('*').order('PERS_NOM');
            if (selectedType) q = q.eq('PERS_Type', selectedType);
            const { data: persons, error } = await q;
            if (error) return alert("Erreur : " + error.message);

            const [etabsRes, upsRes, ogecsRes, apelsRes] = await Promise.all([
                supabaseClient.from('T_ETABLISSEMENT').select('ETAB_id, ETAB_nom, ETAB_ville'),
                supabaseClient.from('T_UNITE_PEDAGOGIQUE').select('UP_id, UP_NOM, UP_type, UP_chefetablissement, UP_ville, UP_telephone'),
                supabaseClient.from('T_OGEC').select('OGEC_id, OGEC_nom, OGEC_ville, "OGEC_président", OGEC_vicepresident, OGEC_tresorier, OGEC_secretaire'),
                supabaseClient.from('T_APEL').select('APEL_id, APEL_nom, APEL_ville, "APEL_president", APEL_vicepresident, APEL_tresorier, APEL_secretaire')
            ]);

            const etabMap = Object.fromEntries((etabsRes.data || []).map(e => [e.ETAB_id, `${e.ETAB_nom} (${e.ETAB_ville})`]));
            exportStore.personnes = [];
            document.getElementById('annuaire-pers-title').innerText = selectedType ? `Annuaire des Personnes - Type : ${selectedType}` : "Annuaire complet des Personnes";

            const photoEntries = await Promise.all((persons || []).map(async p => {
                try {
                    const { data: blob } = await supabaseClient.storage.from('Photos_personnes').download(p.PERS_photo || `${p.PERS_id}.jpg`);
                    return blob ? [p.PERS_id, URL.createObjectURL(blob)] : null;
                } catch { return null; }
            }));
            const photoMap = Object.fromEntries(photoEntries.filter(Boolean));

            const container = document.getElementById('annuaire-pers-container');
            container.innerHTML = !(persons?.length) ? `<p class="text-center text-slate-500 py-6">Aucune personne trouvée.</p>` : persons.map(p => {
                const pid = String(p.PERS_id).trim(), mandats = [], affectParts = [];
                const checkBureau = (list, prefix, nomKey, villeKey, roles) => (list || []).forEach(item => {
                    const label = `${item[nomKey] || prefix}${item[villeKey] ? ' (' + item[villeKey] + ')' : ''}`;
                    Object.entries(roles).forEach(([col, titre]) => { if (String(item[col] || '').trim() === pid) mandats.push({ poste: `${titre} ${prefix}`, structure: label }); });
                });
                checkBureau(ogecsRes.data, 'OGEC', 'OGEC_nom', 'OGEC_ville', { 'OGEC_président': 'PRÉSIDENT', OGEC_vicepresident: 'VICE-PRÉSIDENT', OGEC_tresorier: 'TRÉSORIER', OGEC_secretaire: 'SECRÉTAIRE' });
                checkBureau(apelsRes.data, 'APEL', 'APEL_nom', 'APEL_ville', { 'APEL_president': 'PRÉSIDENT', APEL_vicepresident: 'VICE-PRÉSIDENT', APEL_tresorier: 'TRÉSORIER', APEL_secretaire: 'SECRÉTAIRE' });

                const upList = p.PERS_Type === "CHEF D'ETABLISSEMENT" ? (upsRes.data || []).filter(u => String(u.UP_chefetablissement || '').trim() === pid) : [];
                if (upList.length) affectParts.push(upList.map(u => `${u.UP_NOM} (${u.UP_ville || ''})`).join(" / "));
                else if (p.PERS_Type === "CHEF D'ETABLISSEMENT" && etabMap[p.PERS_etab]) affectParts.push(etabMap[p.PERS_etab]);

                let badge = p.PERS_Type || 'Non défini';
                if (mandats.length) {
                    const pStr = mandats.map(m => m.poste).join(' / ');
                    badge = p.PERS_Type === "CHEF D'ETABLISSEMENT" ? `${p.PERS_Type} — ${pStr}` : pStr;
                    affectParts.push(mandats.map(m => `${m.poste} — ${m.structure}`).join(' ; '));
                }
                if (!affectParts.length) affectParts.push(etabMap[p.PERS_etab] || 'Non rattaché');
                const affectText = affectParts.join(' | ');

                exportStore.personnes.push({ Civilite: p.PERS_Civilite || '', Nom: p.PERS_NOM || '', Prenom: p.PERS_Prenom || '', Fonction: badge, Affectation: affectText, Courriel: p.PERS_courriel1 || '', Telephone: p.PERS_Telephoneportable || p.PERS_Telephonebureau || '' });

                let affHtml = upList.length ? `<div class="mt-2 space-y-1"><span class="font-semibold text-xs text-red-900 uppercase">Unités Pédagogiques dirigées :</span>${upList.map(u => `<p class="text-sm text-slate-700 bg-slate-50 p-2 rounded border-l-4 border-red-950"><strong>${u.UP_NOM}</strong> — ${u.UP_ville || ''}</p>`).join('')}</div>` : '';
                if (mandats.length) affHtml += `<div class="mt-2 space-y-1"><span class="font-semibold text-xs text-red-900 uppercase">Fonctions OGEC / APEL :</span>${mandats.map(m => `<p class="text-sm text-slate-700 bg-slate-50 p-2 rounded border-l-4 border-red-800"><strong>${m.poste}</strong> — ${m.structure}</p>`).join('')}</div>`;
                if (!affHtml) affHtml = `<p class="text-sm text-slate-600 mt-2">Affectation : <span class="font-medium">${affectText}</span></p>`;

                const photoHtml = photoMap[p.PERS_id] ? `<img src="${photoMap[p.PERS_id]}" class="w-24 h-32 object-cover rounded border shadow-sm">` : `<div class="w-24 h-32 bg-slate-100 border rounded flex items-center justify-center text-xs text-slate-400">Pas de photo</div>`;
                return `<div class="bg-white border rounded-xl p-5 shadow-sm flex flex-col md:flex-row gap-6 items-start">
                    <div class="flex-shrink-0 mx-auto md:mx-0">${photoHtml}</div>
                    <div class="flex-grow space-y-2">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2">
                            <h3 class="text-lg font-bold text-red-900 uppercase">${p.PERS_Civilite || ''} ${p.PERS_NOM || ''} ${p.PERS_Prenom || ''}</h3>
                            <span class="text-xs font-semibold bg-red-100 text-red-800 px-2.5 py-1 rounded-full">${badge}</span>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600">
                            <p><strong>Courriel :</strong> <a href="mailto:${p.PERS_courriel1 || ''}" class="text-blue-800 underline">${p.PERS_courriel1 || 'N/c'}</a></p>
                            <p><strong>Téléphone :</strong> ${p.PERS_Telephoneportable || p.PERS_Telephonebureau || 'N/c'}</p>
                        </div>${affHtml}
                    </div>
                </div>`;
            }).join('');
            showView('view-annuaire-personnes-result');
        }

        async function generateAnnuaireEtablissements() {
            const [{ data: etabs }, { data: ups }, personMap] = await Promise.all([
                supabaseClient.from('T_ETABLISSEMENT').select('*').order('ETAB_ville'),
                supabaseClient.from('T_UNITE_PEDAGOGIQUE').select('*'),
                getPersonMap()
            ]);
            exportStore.etablissements = [];
            document.getElementById('annuaire-etabs-container').innerHTML = (etabs || []).map(e => {
                const eUps = (ups || []).filter(u => u.UP_etablissement === e.ETAB_id);
                exportStore.etablissements.push({ Ville: e.ETAB_ville || '', Etablissement: e.ETAB_nom || '', Adresse: `${e.ETAB_adresse || ''} ${e.ETAB_codepostal || ''}`, Courriel: e.ETAB_courriel || '', Telephone: e.ETAB_telephone || '', Site: e.ETAB_siteinternet || '', NbUP: eUps.length });
                const upsHtml = eUps.length ? `<div class="mt-4 border-t pt-3 grid grid-cols-1 md:grid-cols-2 gap-3">${eUps.map(u => `<div class="bg-slate-50 border p-3 rounded-lg text-sm"><p class="font-bold text-red-900">${u.UP_NOM} (${u.UP_type || 'N/C'})</p><p class="text-xs text-slate-600"><strong>Chef :</strong> ${personMap[u.UP_chefetablissement] || 'Non renseigné'}</p></div>`).join('')}</div>` : '';
                return `<div class="bg-white border rounded-xl p-6 shadow-sm"><span class="text-xs font-semibold bg-red-900 text-white px-2.5 py-1 rounded uppercase">${e.ETAB_ville || ''}</span><h3 class="text-xl font-bold text-slate-900 mt-1">${e.ETAB_nom || ''}</h3><p class="text-sm text-slate-600 mt-2">${e.ETAB_adresse || ''} ${e.ETAB_codepostal || ''} ${e.ETAB_ville || ''} — Tél : ${e.ETAB_telephone || 'N/c'}</p>${upsHtml}</div>`;
            }).join('');
            showView('view-annuaire-etabs-result');
        }

        async function generateAnnuaireOGEC() {
            const [{ data: ogecs }, personMap] = await Promise.all([supabaseClient.from('T_OGEC').select('*').order('OGEC_ville'), getPersonMap()]);
            exportStore.ogec = [];
            document.getElementById('annuaire-ogec-container').innerHTML = (ogecs || []).map(o => {
                const pdt = personMap[o.OGEC_président] || (o.OGEC_pdtNOM ? `${o.OGEC_pdttitre || ''} ${o.OGEC_pdtNOM} ${o.OGEC_pdtprenom || ''}` : 'N/c');
                const vp = personMap[o.OGEC_vicepresident] || 'N/c', tres = personMap[o.OGEC_tresorier] || 'N/c', sec = personMap[o.OGEC_secretaire] || 'N/c';
                exportStore.ogec.push({ Ville: o.OGEC_ville || '', Nom: o.OGEC_nom || '', Siret: o.OGEC_siret || '', Adresse: `${o.OGEC_adresse || ''} ${o.OGEC_codepostal || ''} ${o.OGEC_ville || ''}`, President: pdt, VicePresident: vp, Tresorier: tres, Secretaire: sec });
                return `<div class="bg-white border rounded-xl p-6 shadow-sm"><div class="flex justify-between border-b pb-2 mb-3"><div><span class="text-xs font-semibold bg-red-900 text-white px-2.5 py-1 rounded uppercase">${o.OGEC_ville || ''}</span><h3 class="text-xl font-bold mt-1">${o.OGEC_nom || ''}</h3></div><span class="text-xs font-mono">SIRET : ${o.OGEC_siret || 'N/c'}</span></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm"><div>${o.OGEC_adresse || ''}<br>${o.OGEC_codepostal || ''} ${o.OGEC_ville || ''}</div><div class="bg-slate-50 p-3 rounded border"><p><strong>Président :</strong> ${pdt}</p><p><strong>VP :</strong> ${vp} | <strong>Trés. :</strong> ${tres} | <strong>Sec. :</strong> ${sec}</p></div></div></div>`;
            }).join('');
            showView('view-annuaire-ogec-result');
        }

        async function generateAnnuaireAPEL() {
            const [{ data: apels }, personMap] = await Promise.all([supabaseClient.from('T_APEL').select('*').order('APEL_ville'), getPersonMap()]);
            exportStore.apel = [];
            document.getElementById('annuaire-apel-container').innerHTML = (apels || []).map(a => {
                const pdt = personMap[a.APEL_president] || 'N/c', vp = personMap[a.APEL_vicepresident] || 'N/c', tres = personMap[a.APEL_tresorier] || 'N/c', sec = personMap[a.APEL_secretaire] || 'N/c';
                exportStore.apel.push({ Ville: a.APEL_ville || '', Nom: a.APEL_nom || '', President: pdt, VicePresident: vp, Tresorier: tres, Secretaire: sec });
                return `<div class="bg-white border rounded-xl p-6 shadow-sm"><span class="text-xs font-semibold bg-red-900 text-white px-2.5 py-1 rounded uppercase">${a.APEL_ville || ''}</span><h3 class="text-xl font-bold mt-1 mb-3">${a.APEL_nom || ''}</h3><div class="bg-slate-50 p-3 rounded border text-sm grid grid-cols-2 gap-2"><p><strong>Président :</strong> ${pdt}</p><p><strong>VP :</strong> ${vp}</p><p><strong>Trésorier :</strong> ${tres}</p><p><strong>Secrétaire :</strong> ${sec}</p></div></div>`;
            }).join('');
            showView('view-annuaire-apel-result');
        }

        async function generateAnnuaireDioceses() {
            const { data: dioceses } = await supabaseClient.from('T_DIOCESE').select('*').order('DIO_NOM');
            exportStore.dioceses = [];
            document.getElementById('annuaire-dioceses-container').innerHTML = (dioceses || []).map(d => {
                const ev = `${d.DIO_EV_PRE || ''} ${d.DIO_EV_NOM || ''}`.trim() || 'N/c';
                const dd = `${d.DIO_DD_TITRE || ''} ${d.DIO_DD_PRE || ''} ${d.DIO_DD_NOM || ''}`.trim() || 'N/c';
                exportStore.dioceses.push({ Diocese: d.DIO_NOM || '', Pays: d.DIO_PAYS || 'FRANCE', Eveque: ev, EvequeMail: d.DIO_EV_MAIL || '', EvequeTel: d.DIO_EV_TEL || '', EvequeAdr: `${d.DIO_EV_ADR || ''} ${d.DIO_EV_CP || ''} ${d.DIO_EV_VILLE || ''}`, Directeur: dd, DirecteurMail: d.DIO_DD_MAIL || '', DirecteurMob: d.DIO_DD_MOB || '', DirecteurTel: d.DIO_DD_TEL || '', DirecteurAdr: `${d.DIO_DD_ADR || ''} ${d.DIO_DD_CP || ''} ${d.DIO_DD_VILLE || ''}` });
                return `<div class="bg-white border rounded-xl p-6 shadow-sm"><h3 class="text-xl font-bold text-red-900 border-b pb-2 mb-3">${d.DIO_NOM || ''}</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"><div class="bg-slate-50 p-3 rounded border"><p class="font-bold text-red-900">Évêque : Mgr ${ev}</p><p>${d.DIO_EV_MAIL || ''} | ${d.DIO_EV_TEL || ''}</p></div><div class="bg-slate-50 p-3 rounded border"><p class="font-bold text-red-900">Directeur : ${dd}</p><p>${d.DIO_DD_MAIL || ''} | ${d.DIO_DD_MOB || ''}</p></div></div></div>`;
            }).join('');
            showView('view-annuaire-dioceses-result');
        }

        // =========================================================================
        // 6. SYNTHÈSE ÉCONOMIQUE, EFFECTIFS & EMPRUNTS
        // =========================================================================
        async function loadEtablissementsSelect() {
            const { data } = await supabaseClient.from('T_ETABLISSEMENT').select('ETAB_id, ETAB_nom, ETAB_ville').order('ETAB_ville');
            const html = (data || []).map(e => `<option value="${e.ETAB_id}">${e.ETAB_ville} — ${e.ETAB_nom}</option>`).join('');
            ['select-eco-etab', 'select-emprunteur-etab', 'select-effpers-etab'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = html; });
        }

        async function loadAnneesScolairesSelect() {
            const { data } = await supabaseClient.from('T_ANNEESCOLAIRE').select('*');
            let annees = (data || []).map(a => a.ANNEESCOLAIRE || a.annee).filter(Boolean);
            if (!annees.length) annees = ['2025-2026', '2024-2025', '2023-2024', '2022-2023', '2021-2022'];
            annees.sort((a, b) => b.localeCompare(a));
            const target = `${new Date().getFullYear() - 2}-${new Date().getFullYear() - 1}`;
            const html = annees.map(a => `<option value="${a}" ${a === target ? 'selected' : ''}>${a}</option>`).join('');
            ['select-eco-annee', 'select-effpers-annee-ref', 'select-effectifs-annee-ref', 'TARIF_anneescolaire', 'select-facture-annee'].forEach(id => {
                const el = document.getElementById(id); if (el) el.innerHTML = html;
            });
        }

        async function generateSyntheseEco() {
            const etabId = document.getElementById('select-eco-etab').value;
            const anneeN = document.getElementById('select-eco-annee').value;
            const yN = parseInt(anneeN.split('-')[0]);
            const annees = [`${yN - 2}-${yN - 1}`, `${yN - 1}-${yN}`, anneeN];

            const [{ data: etab }, { data: ecos }, { data: effs }] = await Promise.all([
                supabaseClient.from('T_ETABLISSEMENT').select('*').eq('ETAB_id', etabId).single(),
                supabaseClient.from('T_ECO').select('*').or(`ECO_id.eq.${etabId},ETAB_id.eq.${etabId}`),
                supabaseClient.from('T_EFFECTIF').select('*').or(`EFFECTIF_etab.eq.${etabId},EFFECTIF_id.eq.${etabId}`)
            ]);

            document.getElementById('lbl-eco-ville').innerText = etab?.ETAB_ville || '';
            document.getElementById('lbl-eco-etab-nom').innerText = etab?.ETAB_nom || '';
            document.getElementById('lbl-eco-annee-ref').innerText = anneeN;
            ['th-annee-n2', 'th-annee-n1', 'th-annee-n'].forEach((id, i) => document.getElementById(id).innerText = annees[i]);

            const metrics = annees.map(an => {
                const r = (ecos || []).find(x => String(x.ECO_EXERCICE || x.ECO_exercice || '').trim() === an) || {};
                const e = (effs || []).find(x => String(x.EFFECTIF_anneescolaire || x.ANNEESCOLAIRE || '').trim() === an) || {};
                const cc = r.ECO_CC || 0, prod = r.ECO_PROFONC || 0, inv = r.ECO_INVIMM || 0, caf = r.ECO_CAF || 0;
                const msal = r.ECO_MSAL || 0, fdr = r.ECO_FDR || 0, dette = r.ECO_DETTE || 0, fact = r.ECO_FACTFAM || 0, imp = r.ECO_IMPFAM || 0;
                const effTot = (e.EFFECTIF_ecole || 0) + (e.EFFECTIF_college || 0) + (e['EFFECTIF_lyceegeneral et technologique'] || e.EFFECTIF_lycee_general || 0) + (e.EFFECTIF_lyceeprofessionnel || 0) + (e.EFFECTIF_btsprepa || 0) + (e.EFFECTIF_fcfa || 0);
                return { cc, prod, inv, pctInv: cc ? inv / cc : null, caf, pctCaf: prod ? caf / prod : null, mna: caf - (r.ECO_ANNEMP || 0), msal, pctMsal: prod ? msal / prod : null, fdr, fdrJ: cc ? (fdr / cc) * 365 : null, dette, remb: caf ? dette / caf : null, effTot, fact, imp, pctImp: fact ? imp / fact : null, repas: r.ECO_NBREPAS || 0 };
            });

            const fmt = (v, t) => v === null || isNaN(v) ? '-' : t === 'pct' ? (v * 100).toFixed(1) + ' %' : t === 'days' ? Math.round(v) + ' j' : t === 'yrs' ? v.toFixed(1) + ' an(s)' : t === 'num' ? v : fmtCurrency(v);
            const rowsDef = [
                ['Charges de fonctionnement courant', 'cc', true, 'cur'], ['Produits de fonctionnement courant', 'prod', true, 'cur'],
                ['Investissements de l\'exercice', 'inv', false, 'cur'], ['% Entretien immo / charges', 'pctInv', false, 'pct'],
                ['Capacité d\'Autofinancement (CAF)', 'caf', true, 'cur'], ['CAF / Produits courants', 'pctCaf', false, 'pct'],
                ['MNA (CAF - Annuité Emprunt)', 'mna', false, 'cur'], ['Masse Salariale', 'msal', true, 'cur'],
                ['Masse Salariale / Produits courants', 'pctMsal', false, 'pct'], ['Fonds de Roulement (FDR)', 'fdr', true, 'cur'],
                ['FDR en jours de charges', 'fdrJ', false, 'days'], ['Restant dû emprunts', 'dette', false, 'cur'],
                ['Remboursement en fonction de la CAF', 'remb', false, 'yrs'], ['EFFECTIFS ELEVES TOTAUX', 'effTot', true, 'num'],
                ['Facturation Familles', 'fact', true, 'cur'], ['Montant des Impayés', 'imp', false, 'cur'],
                ['% Impayés / Facturation', 'pctImp', false, 'pct'], ['Nombre de repas servis', 'repas', false, 'num']
            ];

            exportStore.synthese_eco = rowsDef.map(([label, key]) => ({ Indicateur: label, N2: metrics[0][key], N1: metrics[1][key], N: metrics[2][key] }));
            document.getElementById('tb-eco-body').innerHTML = rowsDef.map(([label, key, bold, type]) => `
                <tr class="${bold ? 'bg-slate-100 font-bold' : ''}"><td class="p-2.5">${label}</td>
                <td class="p-2.5 text-right font-mono">${fmt(metrics[0][key], type)}</td>
                <td class="p-2.5 text-right font-mono">${fmt(metrics[1][key], type)}</td>
                <td class="p-2.5 text-right font-mono font-bold bg-red-50/50">${fmt(metrics[2][key], type)}</td></tr>`
            ).join('');
            showView('view-synthese-eco-result');
        }

        function openConsultationEffectifsForm() { showView('view-effectifs-filter'); }
        async function generateTableauEffectifs() {
            const anneeRef = document.getElementById('select-effectifs-annee-ref').value;
            const perimetre = document.getElementById('select-effectifs-perimetre').value;
            document.getElementById('lbl-effectifs-annee-ref').innerText = anneeRef;
            const yRef = parseInt(anneeRef.split('-')[0]);
            const periodes = Array.from({ length: 6 }, (_, i) => `${yRef - 5 + i}-${yRef - 4 + i}`);

            let [{ data: etabs }, { data: allEffs }] = await Promise.all([supabaseClient.from('T_ETABLISSEMENT').select('*').order('ETAB_ville'), supabaseClient.from('T_EFFECTIF').select('*')]);
            if (perimetre === 'france_uniquement') etabs = (etabs || []).filter(e => !((e.ETAB_ville || '') + (e.ETAB_pays || '')).toUpperCase().match(/MONS|BELGIQUE/));

            exportStore.effectifs_6ans = [];
            const gt = Object.fromEntries(periodes.map(p => [p, 0]));

            document.getElementById('container-effectifs-villes').innerHTML = (etabs || []).map(e => {
                const eEffs = (allEffs || []).filter(r => String(r.EFFECTIF_etab || r.EFFECTIF_id || '').trim() === String(e.ETAB_id).trim());
                let prevTot = 0;
                const rowsHtml = periodes.map((p, idx) => {
                    const r = eEffs.find(x => String(x.EFFECTIF_anneescolaire || x.ANNEESCOLAIRE || '').trim() === p) || {};
                    const tot = (Number(r.EFFECTIF_ecole) || 0) + (Number(r.EFFECTIF_college) || 0) + (Number(r['EFFECTIF_lyceegeneral et technologique'] || r.EFFECTIF_lycee_general) || 0) + (Number(r.EFFECTIF_lyceeprofessionnel) || 0) + (Number(r.EFFECTIF_btsprepa) || 0) + (Number(r.EFFECTIF_fcfa) || 0);
                    gt[p] += tot;
                    const evol = idx > 0 && prevTot > 0 ? (((tot - prevTot) / prevTot) * 100).toFixed(1) + ' %' : '-';
                    prevTot = tot;
                    exportStore.effectifs_6ans.push({ Ville: e.ETAB_ville, Etablissement: e.ETAB_nom, Periode: p, Total: tot, Evolution: evol });
                    return `<tr class="${p === anneeRef ? 'bg-amber-50 font-bold' : ''}"><td class="p-2 border">${p}</td><td class="p-2 text-right border font-mono">${r.EFFECTIF_ecole || '-'}</td><td class="p-2 text-right border font-mono">${r.EFFECTIF_college || '-'}</td><td class="p-2 text-right border font-mono font-bold bg-slate-100">${tot || '-'}</td><td class="p-2 text-right border font-mono">${evol}</td></tr>`;
                }).join('');
                return `<div class="bg-white border rounded-xl shadow-sm p-4 mb-6"><div class="bg-red-900 text-white p-2.5 rounded-t-lg font-bold uppercase">${e.ETAB_ville} — ${e.ETAB_nom}</div><table class="w-full text-xs border-collapse mt-2"><thead><tr class="bg-slate-100"><th class="p-2 border">Période</th><th class="p-2 text-right border">École</th><th class="p-2 text-right border">Collège</th><th class="p-2 text-right border">Total</th><th class="p-2 text-right border">Évol %</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
            }).join('');
            showView('view-effectifs-result');
        }

        function openEmprunteurForm() {
            document.getElementById('input-emprunteur-date').value = new Date().toISOString().split('T')[0];
            showView('view-emprunteur-filter');
        }

        async function generateEtatEmprunteur() {
            const etabId = document.getElementById('select-emprunteur-etab').value;
            const dateEtat = new Date(document.getElementById('input-emprunteur-date').value);
            document.getElementById('lbl-emp-date-ref').innerText = dateEtat.toLocaleDateString('fr-FR');

            const [{ data: etab }, { data: emprunts }] = await Promise.all([
                supabaseClient.from('T_ETABLISSEMENT').select('*').eq('ETAB_id', etabId).single(),
                supabaseClient.from('T_EMPRUNT').select('*').or(`T_EMPRUNT_ETAB.eq.${etabId},ETAB_id.eq.${etabId}`)
            ]);
            document.getElementById('lbl-emp-etab-ville').innerText = etab?.ETAB_ville || '';
            document.getElementById('lbl-emp-etab-nom').innerText = etab?.ETAB_nom || '';

            exportStore.emprunteur = [];
            let totCap = 0, totAnn = 0, totCrd = 0;
            const rows = (emprunts || []).map(emp => {
                const dEmp = new Date(emp.T_EMPRUNT_DATE || emp.DATE);
                const duree = Number(emp.T_EMPRUNT_DUREEMOIS || emp.DUREEMOIS) || 0;
                const taux = (Number(emp.T_EMPRUNT_TAUX || emp.TAUX) || 0) / 100;
                const cap = Number(emp.T_EMPRUNT_CAPEMP || emp.CAPEMP) || 0;
                const ann = Number(emp.T_EMPRUNT_ANNUITE || emp.ANNUITE) || 0;
                const tRest = (duree - ((dateEtat.getFullYear() - dEmp.getFullYear()) * 12 + (dateEtat.getMonth() - dEmp.getMonth()))) / 12;
                if (tRest <= 0) return '';
                const crd = taux > 0 ? ann * (1 - Math.pow(1 + taux, -tRest)) / taux : ann * tRest;
                totCap += cap; totAnn += ann; totCrd += crd;
                exportStore.emprunteur.push({ Date: emp.T_EMPRUNT_DATE, Motif: emp.T_EMPRUNT_MOTIF, Duree: (duree / 12).toFixed(1), Taux: (taux * 100).toFixed(2) + '%', Capital: cap, Annuite: ann, RestantDu: crd.toFixed(2) });
                return `<tr><td class="p-3 border font-mono">${emp.T_EMPRUNT_DATE}</td><td class="p-3 border">${emp.T_EMPRUNT_MOTIF || 'Emprunt'}</td><td class="p-3 border text-right font-mono">${fmtCurrency(cap)}</td><td class="p-3 border text-right font-mono">${fmtCurrency(ann)}</td><td class="p-3 border text-right font-mono font-bold bg-red-50/30">${fmtCurrency(crd)}</td></tr>`;
            }).join('');

            document.getElementById('container-emprunteur-table').innerHTML = `<table class="w-full text-sm border-collapse"><thead><tr class="bg-red-900 text-white"><th class="p-3 border">Date</th><th class="p-3 border">Motif</th><th class="p-3 border text-right">Capital</th><th class="p-3 border text-right">Annuité</th><th class="p-3 border text-right">Restant Dû</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="bg-slate-100 font-bold"><td colspan="2" class="p-3 text-right">TOTAL :</td><td class="p-3 text-right font-mono">${fmtCurrency(totCap)}</td><td class="p-3 text-right font-mono">${fmtCurrency(totAnn)}</td><td class="p-3 text-right font-mono bg-red-100">${fmtCurrency(totCrd)}</td></tr></tfoot></table>`;
            showView('view-emprunteur-result');
        }

        function openEffectifPersonnelForm() { showView('view-effectif-personnel-filter'); }
        async function generateTableauEffectifPersonnel() {
            const etabId = document.getElementById('select-effpers-etab').value;
            const anneeRef = document.getElementById('select-effpers-annee-ref').value;
            const yRef = parseInt(anneeRef.split('-')[0]);
            const periodes = Array.from({ length: 6 }, (_, i) => `${yRef - 5 + i}-${yRef - 4 + i}`);

            const [{ data: etab }, { data: recs }] = await Promise.all([
                supabaseClient.from('T_ETABLISSEMENT').select('*').eq('ETAB_id', etabId).single(),
                supabaseClient.from('T_EFFPERSONNEL').select('*').or(`EFF_id.eq.${etabId},ETAB_id.eq.${etabId}`)
            ]);
            document.getElementById('lbl-effpers-ville').innerText = etab?.ETAB_ville || '';
            document.getElementById('lbl-effpers-etab-nom').innerText = etab?.ETAB_nom || '';
            document.getElementById('lbl-effpers-annee-ref').innerText = anneeRef;
            document.getElementById('tr-effpers-headers').innerHTML = `<th class="p-3">Catégorie</th>` + periodes.map(p => `<th class="p-3 text-right">${p}</th>`).join('');

            const cats = [['EFF_DIRTOT', 'EFF_DIRETP', 'Direction'], ['EFF_ENSSCTOT', 'EFF_ENSSCETP', 'Enseignants sous contrat'], ['EFF_ENSHCTOT', 'EFF_ENHSCETP', 'Enseignants hors contrat'], ['EFF_PVSTOT', 'EFF_PVSETP', 'Vie scolaire / ASEM'], ['EFF_GAITOT', 'EFF_GAIETP', 'Administration / Gestion'], ['EFF_ENTTOT', 'EFF_ENTETP', 'Entretien'], ['EFF_PASTOTOT', 'EFF_PASTOETP', 'Pastorale'], ['EFF_AUTTOT', 'EFF_AUTETP', 'Autres']];
            exportStore.eff_personnel = [];
            document.getElementById('tb-effpers-body').innerHTML = cats.map(([kTot, kEtp, label]) => {
                const rowExp = { Categorie: label };
                const cells = periodes.map(p => {
                    const r = (recs || []).find(x => String(x.EFF_exercice || x.EFF_ANNEE || '').trim() === p) || {};
                    rowExp[p] = `${r[kTot] || 0} (${r[kEtp] || 0} ETP)`;
                    return `<td class="p-2.5 text-right font-mono">${r[kTot] || '-'} <span class="text-xs text-slate-400">(${r[kEtp] || 0})</span></td>`;
                }).join('');
                exportStore.eff_personnel.push(rowExp);
                return `<tr><td class="p-2.5 font-medium">${label}</td>${cells}</tr>`;
            }).join('');
            showView('view-effectif-personnel-result');
        }

        // =========================================================================
        // 7. CAMPAGNES D'ENQUÊTES & COURRIELS COLLECTIFS
        // =========================================================================
        async function openCampagneForm(type) {
            currentCampagneType = type;
            showView('view-campagne-runner');
            document.getElementById('lbl-campagne-type').innerText = `Campagne : ${type.toUpperCase()}`;
            document.getElementById('lbl-campagne-titre').innerText = ENQUETES_CONFIG[type].titre;
            document.getElementById('select-campagne-annee').innerHTML = document.getElementById('select-eco-annee').innerHTML;

            const { data } = await supabaseClient.from('T_PERSONNES').select('PERS_id, PERS_Civilite, PERS_NOM, PERS_Prenom, PERS_courriel1, PERS_etab').eq('PERS_Type', "CHEF D'ETABLISSEMENT").order('PERS_NOM');
            chefsCampagneList = data || [];
            document.getElementById('lbl-nb-total').innerText = chefsCampagneList.length;
            document.getElementById('container-chefs-list').innerHTML = chefsCampagneList.map((c, idx) => `
                <div class="p-3 flex items-center hover:bg-slate-50"><label class="flex items-center space-x-3 cursor-pointer flex-grow">
                    <input type="checkbox" class="chef-checkbox w-4 h-4 text-red-900" data-index="${idx}" ${c.PERS_courriel1 && c.PERS_etab ? 'checked' : ''} onchange="updateCampagneCount()">
                    <div><p class="text-sm font-bold">${c.PERS_Civilite || ''} ${c.PERS_NOM} ${c.PERS_Prenom} (${c.PERS_etab || 'MANQUANT'})</p><p class="text-xs text-slate-500">${c.PERS_courriel1 || '⚠️ Aucun courriel'}</p></div>
                </label></div>`
            ).join('');
            updateCampagneCount();
            mettreAJourApercuMail();
        }

        const updateCampagneCount = () => document.getElementById('lbl-nb-selectionnes').innerText = document.querySelectorAll('.chef-checkbox:checked').length;

        function construireMessageChef(chef, exercice) {
            const cfg = ENQUETES_CONFIG[currentCampagneType];
            return `Bonjour ${chef.PERS_Civilite || 'Madame/Monsieur'} ${chef.PERS_NOM || ''},\nDans le cadre de la campagne de collecte des données pour l'exercice ${exercice}, veuillez trouver ci-dessous votre lien personnalisé :\n\n${cfg.url}?${cfg.paramKey}=${chef.PERS_etab || ''}&exercice=${encodeURIComponent(exercice)}\n\nMerci de saisir vos données avant le ${cfg.limite}.\n\nBien cordialement,\nLe délégué de tutelle.`;
        }

        function mettreAJourApercuMail() {
            if (chefsCampagneList.length) document.getElementById('apercu-corps-mail').innerText = construireMessageChef(chefsCampagneList[0], document.getElementById('select-campagne-annee').value);
        }

        async function executerEnvoiCampagne(mode) {
            const exercice = document.getElementById('select-campagne-annee').value;
            const destList = [...document.querySelectorAll('.chef-checkbox:checked')].map(cb => chefsCampagneList[cb.dataset.index]).filter(c => c.PERS_courriel1);
            if (!destList.length) return alert("Aucun destinataire valide sélectionné.");

            const sujet = `Campagne d'enquête - Tutelle Méricienne (${exercice})`;
            if (mode === 'outlook') {
                const c = destList[0];
                if (confirm(`Préparer le mail Outlook pour ${c.PERS_NOM} ?`)) window.location.href = `mailto:${c.PERS_courriel1}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(construireMessageChef(c, exercice))}`;
            } else if (confirm(`Confirmer l'envoi via Resend à ${destList.length} destinataire(s) ?`)) {
                let ok = 0;
                for (const c of destList) {
                    const { error } = await supabaseClient.functions.invoke('send-emails', { body: { destinataires: [c.PERS_courriel1], sujet, corps: construireMessageChef(c, exercice) } });
                    if (!error) ok++;
                }
                alert(`Campagne transmise à ${ok} / ${destList.length} destinataire(s) !`);
                showView('view-main-menu');
            }
        }

        function openCourrielsCollectifs() {
            showView('view-courriels-collectifs');
            document.getElementById('select-collectif-type').value = '';
            document.getElementById('container-collectif-list').innerHTML = `<p class="text-center text-slate-400 text-sm py-4">Veuillez sélectionner un type.</p>`;
            updateCollectifCount();
        }

        async function chargerPersonnesPourCollectif() {
            const pType = document.getElementById('select-collectif-type').value;
            if (!pType) return;
            const { data } = await supabaseClient.from('T_PERSONNES').select('PERS_id, PERS_Civilite, PERS_NOM, PERS_Prenom, PERS_courriel1').eq('PERS_Type', pType).order('PERS_NOM');
            personnesCollectifList = data || [];
            document.getElementById('lbl-collectif-total').innerText = personnesCollectifList.length;
            document.getElementById('container-collectif-list').innerHTML = personnesCollectifList.map((p, idx) => `
                <div class="p-2 flex items-center hover:bg-slate-50"><label class="flex items-center space-x-3 cursor-pointer flex-grow">
                    <input type="checkbox" class="collectif-checkbox w-4 h-4 text-red-900" data-index="${idx}" ${p.PERS_courriel1 ? 'checked' : ''} onchange="updateCollectifCount()">
                    <span class="text-xs font-bold">${p.PERS_Civilite || ''} ${p.PERS_NOM} ${p.PERS_Prenom} (${p.PERS_courriel1 || 'Pas de courriel'})</span>
                </label></div>`
            ).join('');
            updateCollectifCount();
        }

        const updateCollectifCount = () => document.getElementById('lbl-collectif-selectionnes').innerText = document.querySelectorAll('.collectif-checkbox:checked').length;

        async function executerCourrielCollectif(mode) {
            const sujet = document.getElementById('input-collectif-objet').value.trim();
            const corps = document.getElementById('textarea-collectif-corps').value.trim();
            const destList = [...document.querySelectorAll('.collectif-checkbox:checked')].map(cb => personnesCollectifList[cb.dataset.index]?.PERS_courriel1).filter(Boolean);
            if (!sujet || !corps || !destList.length) return alert("Veuillez remplir l'objet, le corps et sélectionner au moins un destinataire valide.");

            if (mode === 'outlook') {
                if (confirm(`Ouvrir Outlook pour ${destList.length} destinataire(s) en CCI ?`)) window.location.href = `mailto:?bcc=${destList.join(';')}&subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
            } else if (confirm(`Confirmer l'envoi via Resend à ${destList.length} destinataire(s) ?`)) {
                const files = [...(document.getElementById('file-collectif-pieces').files || [])];
                const piecesJointes = await Promise.all(files.map(fileToBase64));
                const { error } = await supabaseClient.functions.invoke('send-emails', { body: { destinataires: destList, sujet, corps, piecesJointes } });
                alert(error ? "Erreur : " + error.message : "Message collectif transmis avec succès !");
                if (!error) showView('view-main-menu');
            }
        }

        // =========================================================================
        // 8. PARAMÈTRES & UTILISATEURS
        // =========================================================================
        function openParametresModule() { showView('view-parametres'); switchParamTab('utilisateurs'); }

        function switchParamTab(tab) {
            document.querySelectorAll('.param-tab').forEach(b => b.className = "param-tab px-6 py-3 font-semibold text-slate-500");
            document.querySelectorAll('.param-sec').forEach(s => s.classList.add('hidden'));
            document.getElementById(`tab-btn-${tab}`).className = "param-tab px-6 py-3 font-bold text-red-900 border-b-2 border-red-900";
            document.getElementById(`param-section-${tab}`).classList.remove('hidden');
            if (tab === 'utilisateurs') loadUsersTable();
            else if (tab === 'constantes') loadParamsTable();
            else loadLogsTable();
        }

        async function loadUsersTable() {
            const { data: res } = await supabaseClient.functions.invoke('manage-users', { body: { action: 'list' } });
            document.getElementById('tbody-users-list').innerHTML = (res?.data || []).map(u => {
                const role = u.user_metadata?.role || 'CONSULTATION';
                return `<tr><td class="p-3 font-bold">${u.email}</td><td class="p-3">${role}</td><td class="p-3 text-right space-x-2">
                    <button onclick="editUser('${u.id}', '${u.email}', '${role}')" class="bg-amber-700 text-white px-3 py-1 rounded text-xs">Modifier</button>
                    <button onclick="deleteUser('${u.id}', '${u.email}')" class="bg-red-800 text-white px-3 py-1 rounded text-xs">Supprimer</button>
                </td></tr>`;
            }).join('');
        }

        function openModalUser() {
            document.getElementById('modal-user-title').innerText = "Nouvel utilisateur";
            document.getElementById('modal-user-old-id').value = "";
            document.getElementById('modal-user-email').value = "";
            document.getElementById('modal-user-email').disabled = false;
            document.getElementById('modal-user-pass').value = "";
            toggleModal('modal-user', true);
        }

        function editUser(id, email, role) {
            document.getElementById('modal-user-title').innerText = "Modifier : " + email;
            document.getElementById('modal-user-old-id').value = id;
            document.getElementById('modal-user-email').value = email;
            document.getElementById('modal-user-email').disabled = true;
            document.getElementById('modal-user-pass').value = "";
            document.getElementById('modal-user-type').value = role;
            toggleModal('modal-user', true);
        }

        async function saveUserRecord() {
            const id = document.getElementById('modal-user-old-id').value;
            const email = document.getElementById('modal-user-email').value.trim();
            const password = document.getElementById('modal-user-pass').value;
            const role = document.getElementById('modal-user-type').value;
            if (!email || (!id && !password)) return alert("Email et mot de passe requis.");
            const payload = { id, email, role, ...(password && { password }) };
            const { error } = await supabaseClient.functions.invoke('manage-users', { body: { action: id ? 'update' : 'create', payload } });
            if (error) return alert("Erreur : " + error.message);
            toggleModal('modal-user', false);
            loadUsersTable();
        }

        async function deleteUser(id, email) {
            if (!confirm(`Supprimer le compte de "${email}" ?`)) return;
            await supabaseClient.functions.invoke('manage-users', { body: { action: 'delete', payload: { id } } });
            loadUsersTable();
        }

        async function loadParamsTable() {
            const { data } = await supabaseClient.from('T_PARAM').select('*').limit(1).maybeSingle();
            if (!data) return;
            document.getElementById('tbody-params-list').innerHTML = Object.entries(data)
                .filter(([k]) => !['id', 'PARAM_id', 'created_at', 'updated_at', 'N°'].includes(k))
                .map(([k, v]) => `<tr><td class="p-3 font-semibold">${k}</td><td class="p-3 font-mono">${v ?? ''}</td><td class="p-3 text-right"><button onclick="editParamCol('${k}', '${encodeURIComponent(v ?? '')}')" class="bg-amber-700 text-white px-3 py-1 rounded text-xs">Modifier</button></td></tr>`).join('');
        }

        function editParamCol(key, val) {
            document.getElementById('modal-param-old-id').value = key;
            document.getElementById('modal-param-key').value = key;
            document.getElementById('modal-param-val').value = decodeURIComponent(val);
            toggleModal('modal-param', true);
        }

        async function saveParamRecord() {
            const key = document.getElementById('modal-param-old-id').value;
            const raw = document.getElementById('modal-param-val').value.trim();
            const val = raw === '' ? null : (!isNaN(raw.replace(',', '.')) ? parseFloat(raw.replace(',', '.')) : raw);
            await supabaseClient.from('T_PARAM').update({ [key]: val }).eq('PARAM_id', 1);
            toggleModal('modal-param', false);
            loadParamsTable();
        }

        async function loadLogsTable() {
            const { data } = await supabaseClient.from('T_LOG_CONNEXION').select('*').order('LOG_id', { ascending: false });
            document.getElementById('tbody-logs-list').innerHTML = (data || []).map(l => `<tr><td class="p-3 font-bold">${l.LOG_utilisateur}</td><td class="p-3 font-mono">${l.LOG_date || '-'}</td><td class="p-3 font-mono">${l.LOG_heure || '-'}</td></tr>`).join('');
        }

        async function purgerLogsConnexion() {
            const d = document.getElementById('input-purge-date').value;
            if (!d || !confirm(`Purger avant le ${d} ?`)) return;
            await supabaseClient.from('T_LOG_CONNEXION').delete().lt('LOG_date', d);
            loadLogsTable();
        }

        // =========================================================================
        // 9. EXPORT CSV GÉNÉRIQUE
        // =========================================================================
        function exportDataToCSV(key) {
            const rows = exportStore[key];
            if (!rows?.length) return alert("Aucune donnée à exporter.");
            const headers = Object.keys(rows[0]);
            const csv = "\uFEFF" + headers.join(';') + "\n" + rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(';')).join('\n');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
            a.download = `Export_${key}_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
        }

       // =========================================================================
        // 10. MODULE FACTURATION & TARIFS
        // =========================================================================
        const TARIF_FIELDS = [
            'TARIF_ADH100', 'TARIF_ADH-300', 'TARIF_ADH+300',
            'TARIF_ECOLEUUR', 'TARIF_COLLEGEUUR', 'TARIF_LYCEEUUR',
            'TARIF_ECOLEUSAM', 'TARIF_COLLEGEUSAM', 'TARIF_LYCEEUSAM',
            'TARIFS_CE'
        ];

        function openGestionTarifs() {
            showView('view-tarifs-form');
            loadTarifsForAnnee();
        }

        async function loadTarifsForAnnee() {
            const annee = document.getElementById('TARIF_anneescolaire').value;
            const { data } = await supabaseClient
                .from('T_TARIFS')
                .select('*')
                .eq('TARIF_anneescolaire', annee)
                .maybeSingle();
            currentTarifsRecord = data;
            TARIF_FIELDS.forEach(f => document.getElementById(f).value = data?.[f] || 0);
        }

        async function saveTarifs(e) {
            e.preventDefault();
            const annee = document.getElementById('TARIF_anneescolaire').value;
            const payload = {
                TARIF_anneescolaire: annee,
                ...Object.fromEntries(TARIF_FIELDS.map(f => [f, parseFloat(document.getElementById(f).value) || 0]))
            };
            const res = currentTarifsRecord?.TARIF_id
                ? await supabaseClient.from('T_TARIFS').update(payload).eq('TARIF_id', currentTarifsRecord.TARIF_id)
                : await supabaseClient.from('T_TARIFS').insert([payload]);
            if (res.error) return alert("Erreur : " + res.error.message);
            alert("Tarifs enregistrés !");
            openSubMenu('facturation');
        }

        async function openEditionFactures() {
            showView('view-factures-runner');
            await calculerFacturesReseau();
        }

        async function calculerFacturesReseau() {
            const annee = document.getElementById('select-facture-annee').value;
            const tbody = document.getElementById('tbody-factures-list');
            const [{ data: tarifData }, { data: allEtabs }, { data: allEffectifs }, { data: allUPs }, { data: allPersonnes }] = await Promise.all([
                supabaseClient.from('T_TARIFS').select('*').eq('TARIF_anneescolaire', annee).maybeSingle(),
                supabaseClient.from('T_ETABLISSEMENT').select('*').order('ETAB_ville'),
                supabaseClient.from('T_EFFECTIF').select('*'),
                supabaseClient.from('T_UNITE_PEDAGOGIQUE').select('*'),
                supabaseClient.from('T_PERSONNES').select('PERS_id, PERS_courriel1')
            ]);

            if (!tarifData) {
                tbody.innerHTML = '<tr><td colspan="9" class="p-4 text-center text-red-600 font-semibold">⚠️ Aucun tarif pour ' + annee + '.</td></tr>';
                return;
            }

            const etabs = (allEtabs || []).filter(e => !((e.ETAB_ville || '') + (e.ETAB_nom || '') + (e.ETAB_pays || '')).toUpperCase().match(/MONS|BELGIQUE/));
            const etabElevesMap = {};
            etabs.forEach(etab => {
                const r = (allEffectifs || []).find(x => String(x.EFFECTIF_etab || x.EFFECTIF_id || '').trim() === String(etab.ETAB_id).trim() && String(x.EFFECTIF_anneescolaire || x.ANNEESCOLAIRE || '').trim() === annee);
                etabElevesMap[etab.ETAB_id] = r
                    ? (Number(r.EFFECTIF_ecole) || 0) + (Number(r.EFFECTIF_college) || 0) + (Number(r['EFFECTIF_lyceegeneral et technologique'] || r.EFFECTIF_lycee_general) || 0) + (Number(r.EFFECTIF_lyceeprofessionnel) || 0) + (Number(r.EFFECTIF_btsprepa) || 0) + (Number(r.EFFECTIF_fcfa) || 0)
                    : 0;
            });

            const chefBestEtab = {};
            (allUPs || []).forEach(u => {
                const cid = String(u.UP_chefetablissement || '').trim();
                const eid = String(u.UP_etablissement || '').trim();
                if (cid && etabElevesMap[eid] !== undefined && (!chefBestEtab[cid] || etabElevesMap[eid] > etabElevesMap[chefBestEtab[cid]])) {
                    chefBestEtab[cid] = eid;
                }
            });

            const mapChefsCount = {};
            Object.values(chefBestEtab).forEach(eid => mapChefsCount[eid] = (mapChefsCount[eid] || 0) + 1);

            calculatedFacturesList = [];
            tbody.innerHTML = '';
            let missingCount = 0;

            etabs.forEach(etab => {
                const r = (allEffectifs || []).find(x => String(x.EFFECTIF_etab || x.EFFECTIF_id || '').trim() === String(etab.ETAB_id).trim() && String(x.EFFECTIF_anneescolaire || x.ANNEESCOLAIRE || '').trim() === annee);
                if (!r) { missingCount++; return; }

                const ecole = Number(r.EFFECTIF_ecole) || 0;
                const college = Number(r.EFFECTIF_college) || 0;
                const lyceePlus = (Number(r['EFFECTIF_lyceegeneral et technologique'] || r.EFFECTIF_lycee_general) || 0) + (Number(r.EFFECTIF_lyceeprofessionnel) || 0) + (Number(r.EFFECTIF_btsprepa) || 0) + (Number(r.EFFECTIF_fcfa) || 0);
                const totalEleves = ecole + college + lyceePlus;

                const adh = totalEleves <= 100
                    ? { code: 'AR1005', libelle: 'Adhésion PM (-100 élèves)', mnt: Number(tarifData.TARIF_ADH100) || 0 }
                    : totalEleves <= 300
                        ? { code: 'AR1006', libelle: 'Adhésion PM (101-300 élèves)', mnt: Number(tarifData['TARIF_ADH-300']) || 0 }
                        : { code: 'AR1007', libelle: 'Adhésion PM (+300 élèves)', mnt: Number(tarifData['TARIF_ADH+300']) || 0 };

                const nbChefs = mapChefsCount[etab.ETAB_id] || 0;
                const tarifCE = Number(tarifData.TARIFS_CE) || 0;
                const typeFact = (etab.ETAB_facturation || 'USAM').toUpperCase();
                const puE = Number(tarifData['TARIF_ECOLE' + typeFact]) || 0;
                const puC = Number(tarifData['TARIF_COLLEGE' + typeFact]) || 0;
                const puL = Number(tarifData['TARIF_LYCEE' + typeFact]) || 0;

                const emailsCE = new Set();
                (allUPs || []).filter(u => String(u.UP_etablissement).trim() === String(etab.ETAB_id).trim()).forEach(u => {
                    const mail = (allPersonnes || []).find(p => String(p.PERS_id).trim() === String(u.UP_chefetablissement).trim())?.PERS_courriel1;
                    if (mail && mail.includes('@')) emailsCE.add(mail.trim());
                });
                if (!emailsCE.size && etab.ETAB_courriel) emailsCE.add(etab.ETAB_courriel.trim());

                const fact = {
                    etabId: etab.ETAB_id,
                    nom: etab.ETAB_nom,
                    ville: etab.ETAB_ville,
                    adresse: ((etab.ETAB_adresse || '') + ' ' + (etab.ETAB_codepostal || '') + ' ' + (etab.ETAB_ville || '')).trim(),
                    courriel: etab.ETAB_courriel,
                    destinataires: [...emailsCE],
                    typeFact: typeFact,
                    annee: annee,
                    adhesionPM: adh,
                    ce: { nb: nbChefs, pu: tarifCE, mnt: nbChefs * tarifCE },
                    ecole: { qty: ecole, pu: puE, mnt: ecole * puE },
                    college: { qty: college, pu: puC, mnt: college * puC },
                    lycee: { qty: lyceePlus, pu: puL, mnt: lyceePlus * puL },
                    totalNetHT: adh.mnt + (nbChefs * tarifCE) + (ecole * puE) + (college * puC) + (lyceePlus * puL)
                };
                calculatedFacturesList.push(fact);

                tbody.innerHTML += '<tr class="hover:bg-slate-50">' +
                    '<td class="p-3 text-center"><input type="checkbox" class="fact-checkbox" data-index="' + (calculatedFacturesList.length - 1) + '" checked onchange="updateFacturesCount()"></td>' +
                    '<td class="p-3 font-bold">' + etab.ETAB_ville + ' — ' + etab.ETAB_nom + '</td>' +
                    '<td class="p-3"><span class="text-xs px-2 py-0.5 rounded font-bold ' + (typeFact === 'UUR' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800') + '">' + typeFact + '</span></td>' +
                    '<td class="p-3 text-right font-mono">' + fmtCurrency(fact.adhesionPM.mnt) + '</td>' +
                    '<td class="p-3 text-right font-mono">' + fmtCurrency(fact.ce.mnt) + ' (' + nbChefs + ')</td>' +
                    '<td class="p-3 text-right font-mono">' + fmtCurrency(fact.ecole.mnt) + '</td>' +
                    '<td class="p-3 text-right font-mono">' + fmtCurrency(fact.college.mnt) + '</td>' +
                    '<td class="p-3 text-right font-mono">' + fmtCurrency(fact.lycee.mnt) + '</td>' +
                    '<td class="p-3 text-right font-mono font-bold text-red-900 bg-red-50">' + fmtCurrency(fact.totalNetHT) + '</td>' +
                    '</tr>';
            });

            if (missingCount) alert("⚠️ " + missingCount + " établissement(s) ignoré(s) faute d'effectifs saisis pour " + annee + ".");
            updateFacturesCount();
        }

        const updateFacturesCount = () => {
            document.getElementById('lbl-factures-selected').innerText = document.querySelectorAll('.fact-checkbox:checked').length;
            document.getElementById('lbl-factures-total').innerText = calculatedFacturesList.length;
        };

        function dessinerFactureSurPdf(doc, f) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(31, 41, 55);
            doc.text('Association INSIEME / TUTELLE', 15, 20);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text('9 Impasse Royer-Collard, 75005 Paris', 15, 26);
            doc.text('Tél : 01.40.46.79.59 | SIRET : 41312953700028', 15, 31);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(30, 58, 138);
            doc.text('FACTURE', 195, 20, { align: 'right' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(31, 41, 55);
            doc.text('N° : ' + f.etabId + '-' + f.annee.replace('-', '/'), 195, 26, { align: 'right' });
            doc.text('Date : ' + new Date().toLocaleDateString('fr-FR'), 195, 31, { align: 'right' });

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(203, 213, 225);
            doc.rect(105, 36, 90, 26, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.text('Client : ' + f.etabId, 108, 42);
            doc.text(doc.splitTextToSize(f.nom || '', 84), 108, 47);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(doc.splitTextToSize(f.adresse || '', 84), 108, 54);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Objet : Cotisation association de tutelle — Année scolaire ' + f.annee, 15, 74);

            const rows = [
                f.adhesionPM.mnt > 0 && [f.adhesionPM.code, f.adhesionPM.libelle, '1,000', f.adhesionPM.mnt.toFixed(2) + ' €', f.adhesionPM.mnt.toFixed(2) + ' €'],
                f.ce.nb > 0 && ['ARI021', "Adhésion Chef d'établissement", f.ce.nb.toFixed(3), f.ce.pu.toFixed(2) + ' €', f.ce.mnt.toFixed(2) + ' €'],
                f.ecole.qty > 0 && ['AR1040', 'Contribution école (' + f.typeFact + ')', f.ecole.qty.toFixed(3), f.ecole.pu.toFixed(2) + ' €', f.ecole.mnt.toFixed(2) + ' €'],
                f.college.qty > 0 && ['ARI041', 'Contribution collège (' + f.typeFact + ')', f.college.qty.toFixed(3), f.college.pu.toFixed(2) + ' €', f.college.mnt.toFixed(2) + ' €'],
                f.lycee.qty > 0 && ['ARI042', 'Contribution lycée / post-bac (' + f.typeFact + ')', f.lycee.qty.toFixed(3), f.lycee.pu.toFixed(2) + ' €', f.lycee.mnt.toFixed(2) + ' €']
            ].filter(Boolean);

            let y = 82;
            const cols = [15, 38, 120, 142, 168, 195];

            doc.setFillColor(241, 245, 249);
            doc.rect(15, y, 180, 8, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.text('Code', cols[0] + 2, y + 5.5);
            doc.text('Désignation', cols[1] + 2, y + 5.5);
            doc.text('Qté', cols[3] - 2, y + 5.5, { align: 'right' });
            doc.text('P.U. HT', cols[4] - 2, y + 5.5, { align: 'right' });
            doc.text('Montant HT', cols[5] - 2, y + 5.5, { align: 'right' });
            for (let c = 1; c < cols.length - 1; c++) doc.line(cols[c], y, cols[c], y + 8);
            y += 8;

            doc.setFont('helvetica', 'normal');
            rows.forEach(([code, desig, qte, pu, mnt]) => {
                doc.rect(15, y, 180, 8, 'D');
                doc.text(code, cols[0] + 2, y + 5.5);
                doc.text(desig, cols[1] + 2, y + 5.5);
                doc.text(qte, cols[3] - 2, y + 5.5, { align: 'right' });
                doc.text(pu, cols[4] - 2, y + 5.5, { align: 'right' });
                doc.text(mnt, cols[5] - 2, y + 5.5, { align: 'right' });
                for (let c = 1; c < cols.length - 1; c++) doc.line(cols[c], y, cols[c], y + 8);
                y += 8;
            });

            y += 8;
            const totRows = [
                ['Total HT', f.totalNetHT.toFixed(2) + ' €', false],
                ['TVA (0%)', '0,00 €', false],
                ['NET À PAYER', f.totalNetHT.toFixed(2) + ' €', true]
            ];
            totRows.forEach(([lbl, val, isBold]) => {
                doc.setFillColor(isBold ? 226 : 241, isBold ? 232 : 245, isBold ? 240 : 249);
                doc.rect(115, y, 45, 8, 'FD');
                doc.rect(160, y, 35, 8, isBold ? 'FD' : 'D');
                doc.setFont('helvetica', isBold ? 'bold' : 'normal');
                doc.text(lbl, 117, y + 5.5);
                doc.text(val, 193, y + 5.5, { align: 'right' });
                y += 8;
            });

            y += 12;
            doc.setDrawColor(148, 163, 184);
            doc.line(15, y, 195, y);
            y += 6;
            doc.setFontSize(8.5);
            doc.setTextColor(71, 85, 105);
            doc.setFont('helvetica', 'bold');
            doc.text('Facture payable au 31/12/2026 par Virement : ' + f.totalNetHT.toFixed(2) + ' € — TVA non applicable (art. 239 B CGI)', 15, y);
            y += 5;
            doc.text('IBAN : FR60 3000 2004 9800 0000 6734 F50   |   BIC : CRLYFRPP', 15, y);
        }

        function createJsPdfInstance() {
            const JsPDFConstructor = window.jspdf?.jsPDF || window.jsPDF?.default || window.jsPDF;
            return new JsPDFConstructor({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        }

        function genererPdfFactureDataUri(f) {
            const doc = createJsPdfInstance();
            dessinerFactureSurPdf(doc, f);
            return doc.output('datauristring');
        }

        function toutImprimerFactures() {
            const cbs = [...document.querySelectorAll('.fact-checkbox:checked')];
            if (!cbs.length) return alert("Aucune facture sélectionnée.");

            const selectedFactures = cbs.map(cb => calculatedFacturesList[cb.dataset.index]);
            const doc = createJsPdfInstance();

            selectedFactures.forEach((f, idx) => {
                if (idx > 0) doc.addPage();
                dessinerFactureSurPdf(doc, f);
            });

            const blobUrl = doc.output('bloburl');
            window.open(blobUrl, '_blank');
        }

        async function envoyerFacturesSelectionneesResend() {
            const cbs = [...document.querySelectorAll('.fact-checkbox:checked')];
            if (!cbs.length || !confirm("Envoyer " + cbs.length + " facture(s) via Resend ?")) return;
            const btn = document.getElementById('btn-send-resend');
            const orig = btn.innerHTML;
            btn.disabled = true;
            let ok = 0;
            const errs = [];

            for (let i = 0; i < cbs.length; i++) {
                const f = calculatedFacturesList[cbs[i].dataset.index];
                btn.innerHTML = "⏳ Envoi " + (i + 1) + "/" + cbs.length + " (" + f.ville + ")...";
                const dests = [...new Set([...f.destinataires, ...(f.courriel ? [f.courriel.trim()] : [])])];
                if (!dests.length) {
                    errs.push(f.ville + " : aucun mail");
                    continue;
                }

                try {
                    const dataUri = genererPdfFactureDataUri(f);
                    const corpsMail = "Madame, Monsieur le Chef d'Établissement,\n\n" +
                        "Veuillez trouver ci-joint l'appel à cotisation " + f.annee + " pour " + f.nom + " (" + f.ville + ").\n" +
                        "Montant total : " + f.totalNetHT.toFixed(2) + " €\n\n" +
                        "Cordialement,\nLa Tutelle Méricienne";

                    const { error } = await supabaseClient.functions.invoke('send-emails', {
                        body: {
                            destinataires: dests,
                            sujet: "Appel à cotisation " + f.annee + " — " + f.nom + " (" + f.ville + ")",
                            corps: corpsMail,
                            piecesJointes: [{ filename: "Facture_" + f.annee + "_" + f.etabId + ".pdf", content: dataUri.split(',')[1] }]
                        }
                    });
                    if (error) throw error;
                    ok++;
                } catch (e) {
                    errs.push(f.ville + " : " + e.message);
                }
            }

            btn.disabled = false;
            btn.innerHTML = orig;
            alert("✅ " + ok + " facture(s) envoyée(s)." + (errs.length ? "\n\n⚠️ Erreurs :\n- " + errs.join('\n- ') : ''));
        }

        function imprimerRecapitulatifPDF() {
            if (!calculatedFacturesList.length) return alert("Aucune facture calculée.");
            const annee = document.getElementById('select-facture-annee').value;
            const rows = calculatedFacturesList.map(f => '<tr><td><strong>' + f.ville + '</strong> — ' + f.nom + '</td><td>' + f.typeFact + '</td><td style="text-align:right">' + f.adhesionPM.mnt.toFixed(2) + ' €</td><td style="text-align:right">' + f.ce.mnt.toFixed(2) + ' €</td><td style="text-align:right">' + f.ecole.mnt.toFixed(2) + ' €</td><td style="text-align:right">' + (f.college.mnt + f.lycee.mnt).toFixed(2) + ' €</td><td style="text-align:right;font-weight:bold">' + f.totalNetHT.toFixed(2) + ' €</td></tr>').join('');
            const tot = calculatedFacturesList.reduce((s, f) => s + f.totalNetHT, 0);
            const win = window.open('', '_blank');
            win.document.write('<html><head><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial;font-size:10px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:5px}</style></head><body><h2>Récapitulatif Cotisations ' + annee + '</h2><table><thead><tr><th>Établissement</th><th>Type</th><th>Adh. PM</th><th>Adh. CE</th><th>Écoles</th><th>Collèges/Lycées</th><th>Total HT</th></tr></thead><tbody>' + rows + '<tr><td colspan="6" style="text-align:right;font-weight:bold">TOTAL RÉSEAU :</td><td style="text-align:right;font-weight:bold">' + tot.toFixed(2) + ' €</td></tr></tbody></table></body></html>');
            win.document.close();
            win.onload = () => win.print();
        }

        function exporterRecapitulatifExcel() {
            if (!calculatedFacturesList.length) return alert("Aucune facture calculée.");
            const annee = document.getElementById('select-facture-annee').value;
            const rows = [
                ["Code", "Ville", "Établissement", "Réseau", "Adhésion PM", "Adhésion CE", "Cotis. École", "Cotis. Collège", "Cotis. Lycée", "Total Net HT"],
                ...calculatedFacturesList.map(f => [f.etabId, f.ville, f.nom, f.typeFact, f.adhesionPM.mnt, f.ce.mnt, f.ecole.mnt, f.college.mnt, f.lycee.mnt, f.totalNetHT])
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Récapitulatif");
            XLSX.writeFile(wb, 'Facturation_' + annee.replace('/', '-') + '.xlsx');
        }