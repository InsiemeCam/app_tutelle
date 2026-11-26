// =========================================================================
// 7. CAMPAGNES D'ENQUÊTES, ÉDITION DIRECTE & COURRIELS COLLECTIFS
// =========================================================================
async function openCampagneForm(type) {
    appState.campagneType = type;
    const cfg = ENQUETES_CONFIG[type];
    $('lbl-campagne-type').innerText = `Enquête ${type.toUpperCase()}`;
    $('lbl-campagne-titre').innerText = cfg.titre;

    const anneeSel = $('select-campagne-annee');
    anneeSel.innerHTML = (appState.cacheAnnees || ['2025-2026', '2024-2025']).map(a => `<option value="${a}">${a}</option>`).join('');

    const [{ data: chefs }, { data: etabs }] = await Promise.all([
        supabaseClient.from('T_PERSONNES').select('PERS_id, PERS_Civilite, PERS_NOM, PERS_Prenom, PERS_courriel1, PERS_etab').eq('PERS_Type', "CHEF D'ETABLISSEMENT").order('PERS_NOM'),
        supabaseClient.from('T_ETABLISSEMENT').select('ETAB_id, ETAB_nom, ETAB_ville')
    ]);

    const etabMap = Object.fromEntries((etabs || []).map(e => [e.ETAB_id, e]));
    appState.chefsCampagne = (chefs || []).filter(c => c.PERS_courriel1 && c.PERS_etab).map(c => ({
        ...c,
        etabNom: etabMap[c.PERS_etab]?.ETAB_nom || 'Établissement',
        etabVille: etabMap[c.PERS_etab]?.ETAB_ville || ''
    }));

    $('lbl-nb-total').innerText = appState.chefsCampagne.length;
    $('container-chefs-list').innerHTML = appState.chefsCampagne.map((c, idx) => `
        <label class="flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer text-sm">
            <div class="flex items-center gap-3">
                <input type="checkbox" checked data-idx="${idx}" onchange="updateCampagneCount()" class="chef-checkbox w-4 h-4 text-red-900 rounded">
                <div>
                    <p class="font-bold text-slate-800">${escapeHTML(c.PERS_Civilite || '')} ${escapeHTML(c.PERS_NOM)} ${escapeHTML(c.PERS_Prenom)}</p>
                    <p class="text-xs text-slate-500">${escapeHTML(c.etabVille)} — ${escapeHTML(c.etabNom)}</p>
                </div>
            </div>
            <span class="text-xs font-mono text-blue-800">${escapeHTML(c.PERS_courriel1)}</span>
        </label>`).join('');

    updateCampagneCount();
    mettreAJourApercuMail();
    showView('view-campagne-runner');
}

function updateCampagneCount() {
    $('lbl-nb-selectionnes').innerText = document.querySelectorAll('.chef-checkbox:checked').length;
}

function buildCampagneMessage(chef, annee) {
    const cfg = ENQUETES_CONFIG[appState.campagneType];
    const link = `${cfg.url}?${cfg.paramKey}=${encodeURIComponent(chef.PERS_etab)}&annee=${encodeURIComponent(annee)}`;
    const salutation = chef.PERS_Civilite ? `Bonjour ${chef.PERS_Civilite} ${chef.PERS_NOM},` : 'Bonjour,';
    return `${salutation}\n\nDans le cadre du suivi annuel de la Tutelle Méricienne pour l'exercice ${annee}, nous vous remercions de bien vouloir compléter l'enquête « ${cfg.titre} » concernant votre établissement (${chef.etabNom} - ${chef.etabVille}).\n\nAccès direct au formulaire pré-identifié :\n${link}\n\nDate limite de retour souhaitée : ${cfg.limite}.\n\nBien cordialement,\nLe Service de Tutelle Méricienne`;
}

function mettreAJourApercuMail() {
    const annee = $('select-campagne-annee').value;
    const sampleChef = appState.chefsCampagne[0] || { PERS_Civilite: 'Madame / Monsieur', PERS_NOM: 'DUPONT', PERS_etab: 'ETAB01', etabNom: 'Établissement', etabVille: 'Ville' };
    $('apercu-corps-mail').innerText = buildCampagneMessage(sampleChef, annee);
}

async function executerEnvoiCampagne(mode) {
    const selected = [...document.querySelectorAll('.chef-checkbox:checked')].map(cb => appState.chefsCampagne[parseInt(cb.dataset.idx, 10)]);
    if (!selected.length) return alert("Veuillez sélectionner au moins un destinataire.");
    const annee = $('select-campagne-annee').value;
    const cfg = ENQUETES_CONFIG[appState.campagneType];

    if (mode === 'outlook') {
        const c = selected[0];
        const subject = encodeURIComponent(`Tutelle Méricienne — ${cfg.titre} (${annee})`);
        const body = encodeURIComponent(buildCampagneMessage(c, annee));
        if (selected.length > 1) alert(`Le lien étant personnalisé par établissement, Outlook va s'ouvrir pour le premier destinataire sélectionné (${c.PERS_NOM}). Utilisez Resend pour un envoi groupé personnalisé.`);
        window.location.href = `mailto:${encodeURIComponent(c.PERS_courriel1)}?subject=${subject}&body=${body}`;
        return;
    }

    if (!confirm(`Envoyer ${selected.length} courriel(s) personnalisé(s) via Resend pour l'enquête "${cfg.titre}" (${annee}) ?`)) return;
    let okCount = 0;
    for (const chef of selected) {
        const text = buildCampagneMessage(chef, annee);
        const { error } = await supabaseClient.functions.invoke('send-email', {
            body: { to: chef.PERS_courriel1, subject: `Tutelle Méricienne — ${cfg.titre} (${annee})`, text, html: text.replace(/\n/g, '<br>') }
        });
        if (!error) okCount++;
        await sleep(500);
    }
    alert(`✅ Campagne terminée : ${okCount} / ${selected.length} courriel(s) envoyé(s).`);
}

// --- Édition directe des données d'enquête ---
const ENQUETE_EDIT_SCHEMAS = {
    economique: {
        table: 'T_ECO', idCol: 'ECO_id', anneeCol: 'ECO_EXERCICE', badge: 'DONNÉES ÉCONOMIQUES',
        fields: [
            ['ECO_CC', 'Charges de fonctionnement courant (€)'], ['ECO_PROFONC', 'Produits de fonctionnement courant (€)'],
            ['ECO_INVIMM', 'Investissements immobiliers (€)'], ['ECO_CAF', 'Capacité d\'Autofinancement (CAF) (€)'],
            ['ECO_ANNEMP', 'Annuité des emprunts (€)'], ['ECO_MSAL', 'Masse salariale (€)'],
            ['ECO_FDR', 'Fonds de roulement (FDR) (€)'], ['ECO_DETTE', 'Capital restant dû emprunts (€)'],
            ['ECO_FACTFAM', 'Facturation familles (€)'], ['ECO_IMPFAM', 'Impayés familles (€)'],
            ['ECO_NBREPAS', 'Nombre de repas servis']
        ]
    },
    effectif_eleves: {
        table: 'T_EFFECTIF', idCol: 'EFFECTIF_etab', anneeCol: 'EFFECTIF_anneescolaire', badge: 'EFFECTIFS ÉLÈVES',
        fields: [
            ['EFFECTIF_ecole', 'Effectif École (Mat. & Élém.)'], ['EFFECTIF_college', 'Effectif Collège'],
            ['EFFECTIF_lyceegeneral et technologique', 'Effectif Lycée Général & Techno'],
            ['EFFECTIF_lyceeprofessionnel', 'Effectif Lycée Professionnel'],
            ['EFFECTIF_btsprepa', 'Effectif BTS & Prépa'], ['EFFECTIF_fcfa', 'Effectif FC / FA']
        ]
    },
    effectif_personnel: {
        table: 'T_EFFPERSONNEL', idCol: 'EFF_id', anneeCol: 'EFF_exercice', badge: 'EFFECTIFS PERSONNEL',
        fields: [
            ['EFF_DIRTOT', 'Direction — Effectif'], ['EFF_DIRETP', 'Direction — ETP'],
            ['EFF_ENSSCTOT', 'Enseignants sous contrat — Effectif'], ['EFF_ENSSCETP', 'Enseignants sous contrat — ETP'],
            ['EFF_ENSHCTOT', 'Enseignants hors contrat — Effectif'], ['EFF_ENHSCETP', 'Enseignants hors contrat — ETP'],
            ['EFF_PVSTOT', 'Vie scolaire / ASEM — Effectif'], ['EFF_PVSETP', 'Vie scolaire / ASEM — ETP'],
            ['EFF_GAITOT', 'Administration / Gestion — Effectif'], ['EFF_GAIETP', 'Administration / Gestion — ETP'],
            ['EFF_ENTTOT', 'Entretien — Effectif'], ['EFF_ENTETP', 'Entretien — ETP'],
            ['EFF_PASTOTOT', 'Pastorale — Effectif'], ['EFF_PASTOETP', 'Pastorale — ETP'],
            ['EFF_AUTTOT', 'Autres — Effectif'], ['EFF_AUTETP', 'Autres — ETP']
        ]
    }
};

let currentEditEnqueteCtx = null;

async function openEnqueteEditSelector() {
    const { data: etabs } = await supabaseClient.from('T_ETABLISSEMENT').select('ETAB_id, ETAB_nom, ETAB_ville').order('ETAB_ville');
    $('edit-enq-etab').innerHTML = (etabs || []).map(e => `<option value="${e.ETAB_id}">${escapeHTML(e.ETAB_ville)} — ${escapeHTML(e.ETAB_nom)}</option>`).join('');
    $('edit-enq-annee').innerHTML = (appState.cacheAnnees || ['2025-2026', '2024-2025']).map(a => `<option value="${a}">${a}</option>`).join('');
    showView('view-enquete-edit-selector');
}

async function chargerFormulaireEditionEnquete() {
    const type = $('edit-enq-type').value;
    const etabId = $('edit-enq-etab').value;
    const annee = $('edit-enq-annee').value;
    const schema = ENQUETE_EDIT_SCHEMAS[type];

    const [{ data: etab }, { data: existing }] = await Promise.all([
        supabaseClient.from('T_ETABLISSEMENT').select('ETAB_nom, ETAB_ville').eq('ETAB_id', etabId).maybeSingle(),
        supabaseClient.from(schema.table).select('*').eq(schema.idCol, etabId).eq(schema.anneeCol, annee).maybeSingle()
    ]);

    currentEditEnqueteCtx = { type, etabId, annee, schema, isNew: !existing };
    $('lbl-edit-enq-badge').innerText = schema.badge;
    $('lbl-edit-enq-titre').innerText = `${etab?.ETAB_ville || ''} — ${etab?.ETAB_nom || ''}`;
    $('lbl-edit-enq-sous-titre').innerText = `Exercice : ${annee}`;
    $('lbl-edit-enq-mode').innerText = existing ? 'Modification d\'une fiche existante' : 'Création d\'une nouvelle fiche';

    $('container-edit-enq-fields').innerHTML = schema.fields.map(([col, label]) => `
        <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">${label}</label>
            <input type="number" step="0.01" data-col="${col}" value="${existing?.[col] ?? ''}" class="enq-dyn-field w-full p-2.5 border rounded-lg bg-white font-mono">
        </div>`).join('');

    showView('view-enquete-edit-form');
}

async function sauvegarderEditionEnquete(event) {
    event.preventDefault();
    if (!currentEditEnqueteCtx) return;
    const { etabId, annee, schema, isNew } = currentEditEnqueteCtx;
    const payload = { [schema.idCol]: etabId, [schema.anneeCol]: annee };
    document.querySelectorAll('.enq-dyn-field').forEach(inp => {
        payload[inp.dataset.col] = inp.value !== '' ? parseFloat(inp.value) : 0;
    });

    const res = isNew
        ? await supabaseClient.from(schema.table).insert([payload])
        : await supabaseClient.from(schema.table).update(payload).eq(schema.idCol, etabId).eq(schema.anneeCol, annee);

    if (res.error) return alert("Erreur lors de l'enregistrement : " + res.error.message);
    alert("✅ Données d'enquête enregistrées avec succès !");
    showView('view-courriels-enquetes');
}

// --- Courriels Collectifs ---
function openCourrielsCollectifs() {
    $('select-collectif-type').value = '';
    $('container-collectif-list').innerHTML = '<p class="text-center text-slate-400 text-sm py-4">Veuillez d\'abord sélectionner un type de personne.</p>';
    $('lbl-collectif-selectionnes').innerText = '0';
    $('lbl-collectif-total').innerText = '0';
    $('input-collectif-objet').value = '';
    $('editor-collectif-corps').innerHTML = '';
    $('file-collectif-pieces').value = '';
    showView('view-courriels-collectifs');
}

async function chargerPersonnesPourCollectif() {
    const pType = $('select-collectif-type').value;
    if (!pType) return;
    const { data } = await supabaseClient.from('T_PERSONNES').select('PERS_id, PERS_Civilite, PERS_NOM, PERS_Prenom, PERS_courriel1').eq('PERS_Type', pType).order('PERS_NOM');
    appState.personnesCollectif = (data || []).filter(p => p.PERS_courriel1);
    $('lbl-collectif-total').innerText = appState.personnesCollectif.length;

    $('container-collectif-list').innerHTML = !appState.personnesCollectif.length
        ? '<p class="text-center text-slate-400 text-sm py-4">Aucun destinataire avec adresse courriel trouvé.</p>'
        : appState.personnesCollectif.map((p, i) => `
            <label class="flex items-center justify-between p-2 hover:bg-slate-50 cursor-pointer text-sm">
                <span class="flex items-center gap-2">
                    <input type="checkbox" checked data-idx="${i}" onchange="updateCollectifCount()" class="collectif-checkbox w-4 h-4 text-red-900 rounded">
                    <strong>${escapeHTML(p.PERS_Civilite || '')} ${escapeHTML(p.PERS_NOM)} ${escapeHTML(p.PERS_Prenom)}</strong>
                </span>
                <span class="text-xs font-mono text-blue-800">${escapeHTML(p.PERS_courriel1)}</span>
            </label>`).join('');
    updateCollectifCount();
}

function updateCollectifCount() {
    $('lbl-collectif-selectionnes').innerText = document.querySelectorAll('.collectif-checkbox:checked').length;
}

function transformCollectifCase(mode) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const text = sel.toString();
    const converted = mode === 'upper' ? text.toUpperCase() : text.toLowerCase();
    document.execCommand('insertText', false, converted);
}

async function executerCourrielCollectif(mode) {
    const selected = [...document.querySelectorAll('.collectif-checkbox:checked')].map(cb => appState.personnesCollectif[parseInt(cb.dataset.idx, 10)]);
    if (!selected.length) return alert("Veuillez sélectionner au moins un destinataire.");
    const objet = $('input-collectif-objet').value.trim();
    const htmlBody = $('editor-collectif-corps').innerHTML.trim();
    const textBody = $('editor-collectif-corps').innerText.trim();
    if (!objet || !textBody) return alert("Veuillez saisir un objet et un message.");

    if (mode === 'outlook') {
        const bcc = selected.map(p => p.PERS_courriel1).join(';');
        window.location.href = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(textBody)}`;
        return;
    }

    if (!confirm(`Envoyer ce message à ${selected.length} destinataire(s) via Resend ?`)) return;
    const files = [...($('file-collectif-pieces')?.files || [])];
    const attachments = await Promise.all(files.map(fileToBase64));

    let okCount = 0;
    for (const p of selected) {
        const { error } = await supabaseClient.functions.invoke('send-email', {
            body: { to: p.PERS_courriel1, subject: objet, html: htmlBody, text: textBody, attachments }
        });
        if (!error) okCount++;
        await sleep(500);
    }
    alert(`✅ Envoi collectif terminé : ${okCount} / ${selected.length} courriel(s) envoyé(s).`);
}
