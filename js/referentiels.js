// =========================================================================
// 4. CRUD GÉNÉRIQUE & MODALE RAPIDE PERSONNE
// =========================================================================
function selectEntityModule(entityName) {
    appState.entity = entityName;
    const isConsult = appState.role === 'CONSULTATION';
    $('btn-mode-create').style.display = isConsult ? 'none' : 'block';
    $('btn-mode-modify').style.display = isConsult ? 'none' : 'block';
    $('choice-main-title').innerText = `Gestion des ${entityName.charAt(0).toUpperCase() + entityName.slice(1)}`;
    showView('view-choice');
}

async function selectMode(mode) {
    appState.mode = mode;
    if (mode === 'create') return openForm(null);
    $('search-title').innerText = mode === 'consult' ? "Consulter une fiche" : "Modifier une fiche";
    $('search-action-btn').innerText = mode === 'consult' ? "Consulter" : "Modifier";
    const cfg = ENTITY_CONFIG[appState.entity];
    const { data } = await supabaseClient.from(cfg.table).select('*').order(cfg.labelField);
    appState.allRecords = data || [];
    renderSearchList(appState.allRecords);
    showView('view-search');
}

function filterSearchList() {
    const q = $('search-input').value.toLowerCase();
    const cfg = ENTITY_CONFIG[appState.entity];
    renderSearchList(appState.allRecords.filter(r => cfg.searchFields.some(f => (r[f] || '').toLowerCase().includes(q))));
}

function renderSearchList(list) {
    const cfg = ENTITY_CONFIG[appState.entity];
    $('search-select').innerHTML = list.map(r =>
        `<option value="${r[cfg.pk]}">${escapeHTML(r[cfg.labelField] || '')} ${r[cfg.searchFields[1]] ? '(' + escapeHTML(r[cfg.searchFields[1]]) + ')' : ''}</option>`
    ).join('');
}

async function loadSelectedRecord() {
    const id = $('search-select').value;
    if (!id) return alert("Veuillez sélectionner une fiche.");
    const cfg = ENTITY_CONFIG[appState.entity];
    const { data } = await supabaseClient.from(cfg.table).select('*').eq(cfg.pk, id).single();
    openForm(data);
}

async function openForm(record) {
    const ent = appState.entity;
    showView(`view-form-${ent}`);
    const isConsult = appState.mode === 'consult' || appState.role === 'CONSULTATION';
    document.querySelectorAll(`#view-form-${ent} input, #view-form-${ent} select`).forEach(el => {
        el.disabled = isConsult;
        el.classList.toggle('bg-slate-100', isConsult);
    });
    $(`submit-btn-${ent}`).style.display = isConsult ? 'none' : 'block';

    const pkField = $(ENTITY_CONFIG[ent].pk);
    if (pkField) { pkField.disabled = true; pkField.readOnly = true; }

    if (record) {
        Object.entries(record).forEach(([k, v]) => { const f = $(k); if (f) f.value = v || ''; });
        appState.selectedId = record[ENTITY_CONFIG[ent].pk];
        if (ent === 'personnes') await loadPersonPhoto(record);
    } else {
        $(`form-${ent}-data`).reset();
        appState.selectedId = null;
        if (pkField) pkField.value = 'Génération automatique...';
    }
}

async function loadPersonPhoto(person) {
    const preview = $('photo-preview'), placeholder = $('photo-placeholder');
    preview.classList.add('hidden'); placeholder.classList.remove('hidden'); placeholder.innerText = "Chargement...";
    try {
        const { data } = await supabaseClient.storage.from('Photos_personnes').download(person.PERS_photo || `${person.PERS_id}.jpg`);
        if (data) { preview.src = URL.createObjectURL(data); preview.classList.remove('hidden'); placeholder.classList.add('hidden'); }
        else placeholder.innerText = "Aucune photo";
    } catch { placeholder.innerText = "Aucune photo"; }
}

async function saveRecord(event, entity) {
    event.preventDefault();
    if (appState.mode === 'consult' || appState.role === 'CONSULTATION') return;

    const cfg = ENTITY_CONFIG[entity], formData = {};
    $(`form-${entity}-data`).querySelectorAll('input, select').forEach(el => {
        if (el.id && el.id !== cfg.pk && el.type !== 'file') {
            formData[el.id] = el.type === 'number' ? (el.value ? parseFloat(el.value) : null) : (el.value !== "" ? el.value : null);
        }
    });

    let recordId = appState.selectedId;
    if (appState.mode === 'create') {
        const { data, error } = await supabaseClient.from(cfg.table).insert([formData]).select();
        if (error) return alert("Erreur : " + error.message);
        recordId = data?.[0]?.[cfg.pk];
    } else {
        const { error } = await supabaseClient.from(cfg.table).update(formData).eq(cfg.pk, recordId);
        if (error) return alert("Erreur : " + error.message);
    }

    if (entity === 'personnes' && recordId) {
        const file = $('photo-file')?.files[0];
        if (file) {
            const fileName = `${recordId}.${file.name.split('.').pop()}`;
            const { error: upErr } = await supabaseClient.storage.from('Photos_personnes').upload(fileName, file, { upsert: true });
            if (!upErr) await supabaseClient.from('T_PERSONNES').update({ PERS_photo: fileName }).eq('PERS_id', recordId);
        }
    }
    appState.cachePersonMap = null;
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
        const el = $(id);
        if (el) el.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') + (list || []).map(labelFn).join('');
    };

    const etabOptions = (e) => `<option value="${e.ETAB_id}">${escapeHTML(e.ETAB_ville)} — ${escapeHTML(e.ETAB_nom)}</option>`;
    ['PERS_etab', 'UP_etablissement'].forEach(id => fillSelect(id, etabRes.data, etabOptions, '-- Choisir un établissement --'));
    ['select-eco-etab', 'select-emprunteur-etab', 'select-effpers-etab'].forEach(id => fillSelect(id, etabRes.data, etabOptions, ''));

    fillSelect('ETAB_DIO', dioRes.data, d => `<option value="${d.DIO_id}">${escapeHTML(d.DIO_NOM)}</option>`, '-- Choisir un diocèse --');
    fillSelect('ETAB_OGEC', ogecRes.data, o => `<option value="${o.OGEC_id}">${escapeHTML(o.OGEC_nom)} (${escapeHTML(o.OGEC_ville)})</option>`, '-- Choisir un OGEC --');
    fillSelect('ETAB_apel', apelRes.data, a => `<option value="${a.APEL_id}">${escapeHTML(a.APEL_nom)} (${escapeHTML(a.APEL_ville)})</option>`, '-- Choisir une APEL --');

    await refreshAllPersonDropdowns();
}

async function refreshAllPersonDropdowns() {
    const { data: persons } = await supabaseClient.from('T_PERSONNES').select('PERS_id, PERS_NOM, PERS_Prenom, PERS_Type').order('PERS_NOM');
    Object.entries(PERSON_SELECT_MAP).forEach(([pType, selectIds]) => {
        const filtered = (persons || []).filter(p => (p.PERS_Type || '').toUpperCase().includes(pType));
        selectIds.forEach(id => {
            const sel = $(id);
            if (!sel) return;
            const prev = sel.value;
            sel.innerHTML = '<option value="">-- Choisir --</option>' +
                filtered.map(p => `<option value="${p.PERS_id}">${escapeHTML(p.PERS_NOM)} ${escapeHTML(p.PERS_Prenom)}</option>`).join('') +
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
    $('quick-pers-target-select').value = targetSelectId;
    ['quick-pers-nom', 'quick-pers-prenom', 'quick-pers-tel', 'quick-pers-mail'].forEach(id => $(id).value = '');
    const typeSelect = $('quick-pers-type');
    const prefixMap = { OGEC_: 'OGEC', APEL_: 'APEL', UP_chefetablissement: "CHEF D'ETABLISSEMENT", UP_adjoint: 'ADJOINT', UP_APS: 'APS', UP_secretaire: 'SECRETAIRE' };
    const matched = Object.entries(prefixMap).find(([k]) => targetSelectId.startsWith(k));
    typeSelect.value = matched ? matched[1] : 'AUTRE';
    toggleModal('modal-quick-person', true);
}

async function saveQuickPerson() {
    const targetId = $('quick-pers-target-select').value;
    const nom = $('quick-pers-nom').value.trim().toUpperCase();
    const prenom = $('quick-pers-prenom').value.trim();
    if (!nom || !prenom) return alert("Veuillez renseigner le nom et le prénom.");

    const { data, error } = await supabaseClient.from('T_PERSONNES').insert([{
        PERS_Civilite: $('quick-pers-civilite').value,
        PERS_NOM: nom, PERS_Prenom: prenom,
        PERS_Type: $('quick-pers-type').value,
        PERS_Telephoneportable: $('quick-pers-tel').value.trim() || null,
        PERS_courriel1: $('quick-pers-mail').value.trim() || null
    }]).select('PERS_id').single();

    if (error) return alert("Erreur : " + error.message);
    appState.cachePersonMap = null;
    await refreshAllPersonDropdowns();
    if (data) $(targetId).value = data.PERS_id;
    toggleModal('modal-quick-person', false);
}
