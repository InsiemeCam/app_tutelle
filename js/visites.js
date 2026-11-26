// =========================================================================
// 12. MODULE VISITES DE TUTELLE (T_VT)
// =========================================================================
let vtSelectedEtab = null, vtEditingRecord = null, vtCurrentMailEtab = null, vtCurrentMailChefs = [], vtCurrentMailVisites = [];

const DEFAULT_MODELE_MAIL_VT = `Bonjour {{CHEF_SALUTATION}},

Dans le cadre de la mission d'accompagnement de la Tutelle Méricienne, nous avons le plaisir de vous confirmer la préparation de la visite de tutelle de votre établissement : {{ETAB_NOM}} ({{ETAB_VILLE}}).

Dates prévisionnelles de la visite : {{VT_DATES}}
Équipe des visiteurs de tutelle : {{VT_VISITEURS}}

Afin de préparer au mieux ces rencontres avec les différents acteurs de la communauté éducative, nous vous remercions de bien vouloir nous transmettre votre proposition de planning avant le {{DATE_LIMITE}}.

Restant à votre entière disposition,
Bien cordialement,
Le Service de Tutelle Méricienne`;

async function openVtGestionSelect() {
    const { data: etabs } = await supabaseClient.from('T_ETABLISSEMENT').select('*').order('ETAB_ville');
    $('select-vt-etab').innerHTML = '<option value="">-- Sélectionner un établissement --</option>' +
        (etabs || []).map(e => `<option value="${e.ETAB_id}">${escapeHTML(e.ETAB_ville)} — ${escapeHTML(e.ETAB_nom)}</option>`).join('');
    $('zone-liste-vt-etab').classList.add('hidden');
    showView('view-vt-select');
}

async function chargerVisitesEtablissement() {
    const etabId = $('select-vt-etab').value;
    if (!etabId) return $('zone-liste-vt-etab').classList.add('hidden');

    const [{ data: etab }, { data: visites }, personMap] = await Promise.all([
        supabaseClient.from('T_ETABLISSEMENT').select('*').eq('ETAB_id', etabId).single(),
        supabaseClient.from('T_VT').select('*').eq('VT_etab', etabId).order('VT_debut', { ascending: false }),
        getPersonMap()
    ]);
    vtSelectedEtab = etab;
    $('lbl-vt-etab-nom').innerText = `${etab.ETAB_ville} — ${etab.ETAB_nom}`;
    $('lbl-vt-etab-info').innerText = `${etab.ETAB_adresse || ''} ${etab.ETAB_codepostal || ''}`;

    $('liste-vt-etab-container').innerHTML = !(visites?.length)
        ? '<p class="p-4 text-center text-slate-400 text-sm">Aucune visite de tutelle enregistrée pour cet établissement.</p>'
        : visites.map(v => {
            const visiteurs = [v.VT_visiteur1, v.VT_visiteur2, v.VT_visiteur3, v.VT_visiteur4, v.VT_visiteur5, v.VT_visiteur6].filter(Boolean).map(id => personMap[id] || id).join(', ');
            return `<div class="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-50">
                <div>
                    <p class="font-bold text-slate-900">Du ${formatDateFR(v.VT_debut)} au ${formatDateFR(v.VT_fin)} — <span class="text-red-900">Prochaine : ${escapeHTML(v.VT_annéeprochaine || 'N/C')}</span></p>
                    <p class="text-xs text-slate-500">Visiteurs : ${escapeHTML(visiteurs || 'Non renseignés')}</p>
                </div>
                <button onclick='ouvrirFormulaireVt(${JSON.stringify(v).replace(/'/g, "&#39;")})' class="bg-amber-700 text-white px-3.5 py-1.5 rounded-lg text-xs hover:bg-amber-600">✏️ Modifier</button>
            </div>`;
        }).join('');
    $('zone-liste-vt-etab').classList.remove('hidden');
}

async function ouvrirFormulaireVt(visite) {
    vtEditingRecord = visite;
    $('titre-vt-etab').innerText = `${vtSelectedEtab.ETAB_ville} — ${vtSelectedEtab.ETAB_nom}`;

    const yCur = new Date().getFullYear();
    const anneesFuture = Array.from({ length: 12 }, (_, i) => `${yCur - 2 + i}-${yCur - 1 + i}`);
    $('VT_anneeprochaine').innerHTML = anneesFuture.map(a => `<option value="${a}">${a}</option>`).join('');

    const { data: tutellePers } = await supabaseClient.from('T_PERSONNES').select('PERS_id, PERS_NOM, PERS_Prenom').eq('PERS_Type', 'TUTELLE').order('PERS_NOM');
    const opts = '<option value="">-- Aucun --</option>' + (tutellePers || []).map(p => `<option value="${p.PERS_id}">${escapeHTML(p.PERS_NOM)} ${escapeHTML(p.PERS_Prenom)}</option>`).join('');
    [1, 2, 3, 4, 5, 6].forEach(i => $(`VT_visiteur${i}`).innerHTML = opts);

    if (visite) {
        $('badge-vt-mode').innerText = 'MODIFICATION VISITE DE TUTELLE';
        $('VT_derniere').value = visite.VT_dernière ? visite.VT_dernière.slice(0, 16) : '';
        $('VT_debut').value = visite.VT_debut ? visite.VT_debut.slice(0, 16) : '';
        $('VT_fin').value = visite.VT_fin ? visite.VT_fin.slice(0, 16) : '';
        $('VT_anneeprochaine').value = visite.VT_annéeprochaine || '';
        [1, 2, 3, 4, 5, 6].forEach(i => $(`VT_visiteur${i}`).value = visite[`VT_visiteur${i}`] || '');
    } else {
        $('badge-vt-mode').innerText = 'NOUVELLE VISITE DE TUTELLE';
        $('form-visite-tutelle').reset();
    }
    showView('view-vt-form');
}

function recalculerAnneeProchaineVt() {
    const debut = $('VT_debut').value;
    if (debut) $('VT_anneeprochaine').value = getAnneeScolaireFromDate(debut, 4);
}

async function sauvegarderVisiteTutelle(event) {
    event.preventDefault();
    const payload = {
        VT_etab: vtSelectedEtab.ETAB_id,
        VT_dernière: $('VT_derniere').value || null,
        VT_debut: $('VT_debut').value || null,
        VT_fin: $('VT_fin').value || null,
        VT_annéeprochaine: $('VT_anneeprochaine').value || null
    };
    [1, 2, 3, 4, 5, 6].forEach(i => payload[`VT_visiteur${i}`] = $(`VT_visiteur${i}`).value || null);

    const res = vtEditingRecord?.VT_key
        ? await supabaseClient.from('T_VT').update(payload).eq('VT_key', vtEditingRecord.VT_key)
        : await supabaseClient.from('T_VT').insert([payload]);

    if (res.error) return alert("Erreur : " + res.error.message);
    alert("✅ Visite de tutelle enregistrée !");
    await chargerVisitesEtablissement();
    showView('view-vt-select');
}

async function openVtMailView() {
    const { data: etabs } = await supabaseClient.from('T_ETABLISSEMENT').select('*').order('ETAB_ville');
    $('select-vt-mail-etab').innerHTML = '<option value="">-- Sélectionner un établissement --</option>' +
        (etabs || []).map(e => `<option value="${e.ETAB_id}">${escapeHTML(e.ETAB_ville)} — ${escapeHTML(e.ETAB_nom)}</option>`).join('');
    $('select-vt-mail-visite').innerHTML = '<option value="">-- Aucune visite --</option>';
    $('lbl-vt-mail-dest').innerText = "Aucun chef d'établissement sélectionné";
    await editerModeleBrutMailVt();
    showView('view-vt-mail');
}

async function editerModeleBrutMailVt() {
    const { data } = await supabaseClient.from('T_PARAM').select('PARAM_val').eq('PARAM_key', 'MODELE_MAIL_VT').maybeSingle();
    $('textarea-vt-mail-corps').value = data?.PARAM_val || DEFAULT_MODELE_MAIL_VT;
}

async function sauvegarderModeleMailVt() {
    const val = $('textarea-vt-mail-corps').value;
    const { data: existing } = await supabaseClient.from('T_PARAM').select('PARAM_key').eq('PARAM_key', 'MODELE_MAIL_VT').maybeSingle();
    const res = existing
        ? await supabaseClient.from('T_PARAM').update({ PARAM_val: val }).eq('PARAM_key', 'MODELE_MAIL_VT')
        : await supabaseClient.from('T_PARAM').insert([{ PARAM_key: 'MODELE_MAIL_VT', PARAM_val: val }]);
    alert(res.error ? "Erreur : " + res.error.message : "✅ Modèle de courriel enregistré dans T_PARAM !");
}

async function preparerMailVtEtablissement() {
    const etabId = $('select-vt-mail-etab').value;
    if (!etabId) return;
    const [{ data: etab }, { data: chefs }, { data: visites }] = await Promise.all([
        supabaseClient.from('T_ETABLISSEMENT').select('*').eq('ETAB_id', etabId).single(),
        supabaseClient.from('T_PERSONNES').select('*').eq('PERS_etab', etabId).eq('PERS_Type', "CHEF D'ETABLISSEMENT"),
        supabaseClient.from('T_VT').select('*').eq('VT_etab', etabId).order('VT_debut', { ascending: false })
    ]);
    vtCurrentMailEtab = etab;
    vtCurrentMailChefs = chefs || [];
    vtCurrentMailVisites = visites || [];

    const emails = vtCurrentMailChefs.map(c => c.PERS_courriel1).filter(Boolean).join('; ');
    $('lbl-vt-mail-dest').innerText = emails || "Aucun courriel renseigné pour le chef d'établissement";
    $('select-vt-mail-visite').innerHTML = '<option value="">-- Dernière / Aucune visite --</option>' +
        vtCurrentMailVisites.map((v, i) => `<option value="${i}">Visite du ${formatDateFR(v.VT_debut)} au ${formatDateFR(v.VT_fin)}</option>`).join('');
    await appliquerFusionMailVt();
}

async function appliquerFusionMailVt() {
    if (!vtCurrentMailEtab) return;
    const { data } = await supabaseClient.from('T_PARAM').select('PARAM_val').eq('PARAM_key', 'MODELE_MAIL_VT').maybeSingle();
    let msg = data?.PARAM_val || DEFAULT_MODELE_MAIL_VT;
    const personMap = await getPersonMap();

    const salutation = vtCurrentMailChefs.length
        ? vtCurrentMailChefs.map(c => `${c.PERS_Civilite || ''} ${c.PERS_NOM}`.trim()).join(' / ')
        : 'Madame, Monsieur';
    const vIdx = $('select-vt-mail-visite').value;
    const v = vIdx !== '' ? vtCurrentMailVisites[parseInt(vIdx, 10)] : vtCurrentMailVisites[0];
    const datesStr = v ? `du ${formatDateFR(v.VT_debut)} au ${formatDateFR(v.VT_fin)}` : '(dates à confirmer)';
    const visiteursStr = v ? [v.VT_visiteur1, v.VT_visiteur2, v.VT_visiteur3, v.VT_visiteur4, v.VT_visiteur5, v.VT_visiteur6].filter(Boolean).map(id => personMap[id] || id).join(', ') : '(équipe à préciser)';
    const limiteStr = $('input-vt-mail-limite').value ? formatDateFR($('input-vt-mail-limite').value) : '(date limite à préciser)';

    msg = msg.replace(/\{\{CHEF_SALUTATION\}\}/g, salutation)
             .replace(/\{\{ETAB_NOM\}\}/g, vtCurrentMailEtab.ETAB_nom || '')
             .replace(/\{\{ETAB_VILLE\}\}/g, vtCurrentMailEtab.ETAB_ville || '')
             .replace(/\{\{VT_DATES\}\}/g, datesStr)
             .replace(/\{\{VT_VISITEURS\}\}/g, visiteursStr)
             .replace(/\{\{DATE_LIMITE\}\}/g, limiteStr);
    $('textarea-vt-mail-corps').value = msg;
}

async function ouvrirMailVtDansOutlook() {
    const dest = $('lbl-vt-mail-dest').innerText;
    const body = $('textarea-vt-mail-corps').value;
    try { await navigator.clipboard.writeText(body); } catch {}
    const toParam = dest.includes('@') ? dest : '';
    window.location.href = `mailto:${encodeURIComponent(toParam)}?subject=${encodeURIComponent('visite de tutelle')}&body=${encodeURIComponent(body)}`;
}

async function genererEtatVisitesTutelle() {
    const [{ data: etabs }, { data: visites }] = await Promise.all([
        supabaseClient.from('T_ETABLISSEMENT').select('*').order('ETAB_ville'),
        supabaseClient.from('T_VT').select('*').order('VT_debut', { ascending: false })
    ]);

    exportStore.etat_visites_tutelle = [];
    $('tbody-vt-etat').innerHTML = (etabs || []).map(e => {
        const last = (visites || []).find(v => String(v.VT_etab) === String(e.ETAB_id));
        const anneeVisite = last?.VT_debut ? getAnneeScolaireFromDate(last.VT_debut) : '';
        const prochaine = last?.VT_annéeprochaine || (anneeVisite ? shiftAnneeScolaire(anneeVisite, 4) : 'À programmer');
        exportStore.etat_visites_tutelle.push({ Ville: e.ETAB_ville, Etablissement: e.ETAB_nom, Derniere_Visite: formatDateFR(last?.VT_debut), Annee_Visite: anneeVisite || 'Aucune', Prochaine_Visite: prochaine });
        return `<tr>
            <td class="p-3 font-bold">${escapeHTML(e.ETAB_ville || '')}</td>
            <td class="p-3">${escapeHTML(e.ETAB_nom || '')}</td>
            <td class="p-3 text-center font-mono">${formatDateFR(last?.VT_debut)}</td>
            <td class="p-3 text-center font-mono">${escapeHTML(anneeVisite || 'Aucune')}</td>
            <td class="p-3 text-center font-bold text-red-900 bg-red-50/40">${escapeHTML(prochaine)}</td>
        </tr>`;
    }).join('');
    showView('view-vt-etat');
}
