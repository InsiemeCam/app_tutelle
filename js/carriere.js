// =========================================================================
// 10. MODULE CARRIÈRE CE (AVENANTS, CONTRATS WORD, RÉMUNÉRATIONS, MODÈLES)
// =========================================================================
let carriereSelectedChef = null, carriereEditingAvenant = null, currentDocType = 'avenant', currentModeleTab = 'avenant';

const DEFAULT_MODELES_WORD = {
    avenant: `<div style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5;">
        <h2 style="text-align:center; color:#7f1d1d;">AVENANT FINANCIER N° {{REMCE_NUMAVENANT}} AU CONTRAT DE TRAVAIL</h2>
        <p style="text-align:center;"><strong>Date d'effet : {{REMCE_date}}</strong></p>
        <p><strong>ENTRE LES SOUSSIGNÉS :</strong></p>
        <p>L'organisme de gestion <strong>{{OGEC_nom}}</strong>, situé {{OGEC_adresse}}, représenté par {{OGEC_president}}, en qualité de Président(e), ci-après dénommé « l'Employeur »,</p>
        <p><strong>D'UNE PART,</strong></p>
        <p><strong>ET :</strong></p>
        <p><strong>{{PERS_Civilite}} {{PERS_Prenom}} {{PERS_NOM}}</strong>, Chef d'Établissement de {{ETAB_nom}} ({{ETAB_ville}}), ci-après dénommé(e) « le Salarié »,</p>
        <p><strong>D'AUTRE PART.</strong></p>
        <p><strong>IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :</strong></p>
        <p>En application du statut du Chef d'Établissement de l'Enseignement Catholique, la rémunération est fixée sur la base de <strong>{{REMCE_TOTALPOINTS}} points</strong> :</p>
        <ul>
            <li>Indice Éducation Nationale : {{REMCE_INDICEEN}} pts</li>
            <li>Augmentations triennales CE2 : {{REMCE_AUGTRI}} pts</li>
            <li>Indemnité de fonction : {{REMCE_IF}} pts</li>
            <li>Validation formation : {{REMCE_FORM}} pts</li>
            <li>Avancements triennaux : {{REMCE_AVTRI}} pts</li>
            <li>Indemnité de responsabilité (Catégorie {{REMCE_IRTYPE}}) : {{REMCE_IR}} pts</li>
            <li>Indemnité de logement : {{REMCE_IL}} pts</li>
        </ul>
        <p>Rémunération brute annuelle OGEC correspondante : <strong>{{REMCE_BRUTANN}} €</strong> (Rémunération brute annuelle État : {{REMCE_BRUTMEN}} €).</p>
        <p style="margin-top:30px;">Fait à {{ETAB_ville}}, le {{DATE_JOUR}}.</p>
        <table style="width:100%; margin-top:40px;"><tr><td><strong>Le Président de l'OGEC</strong></td><td style="text-align:right;"><strong>Le Chef d'Établissement</strong></td></tr></table>
    </div>`,
    contrat: `<div style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5;">
        <h2 style="text-align:center; color:#7f1d1d;">CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE — CHEF D'ÉTABLISSEMENT</h2>
        <p style="text-align:center; font-size:10pt;">Modèle SGEC/2023/570a</p>
        <p><strong>ENTRE :</strong> L'OGEC <strong>{{OGEC_nom}}</strong> ({{OGEC_adresse}}), représenté par {{OGEC_president}},</p>
        <p><strong>ET :</strong> <strong>{{PERS_Civilite}} {{PERS_Prenom}} {{PERS_NOM}}</strong>, né(e) le {{PERS_Datedenaissance}} à {{PERS_lieunaissance}}, demeurant {{PERS_adresse}}.</p>
        <p><strong>Article 1 — Engagement et Mission :</strong> Suite à la lettre de mission de la Tutelle Méricienne en date du <strong>{{DATE_MISSION}}</strong>, {{PERS_Civilite}} {{PERS_NOM}} est engagé(e) en qualité de Chef d'Établissement de <strong>{{ETAB_nom}}</strong> à compter du <strong>{{DATE_FONCTION}}</strong>.</p>
        <p><strong>Article 2 — Période d'essai :</strong> {{CLAUSE_ESSAI}}</p>
        <p><strong>Article 3 — Rémunération :</strong> La rémunération globale est fixée à <strong>{{REMCE_TOTALPOINTS}} points</strong> (Brut annuel OGEC : {{REMCE_BRUTANN}} €).</p>
        <p><strong>Article 4 — Congés payés :</strong> Le salarié bénéficie de <strong>{{NB_CONGES}} semaines</strong> de congés payés par an.</p>
        <p style="margin-top:30px;">Fait en double exemplaire à {{ETAB_ville}}, le {{DATE_JOUR}}.</p>
    </div>`,
    cr_triennal: `<div style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5;">
        <h2 style="text-align:center; color:#7f1d1d;">COMPTE-RENDU D'ENTRETIEN TRIENNAL (TUT003)</h2>
        <p><strong>Chef d'Établissement :</strong> {{PERS_Civilite}} {{PERS_Prenom}} {{PERS_NOM}}</p>
        <p><strong>Établissement :</strong> {{ETAB_nom}} ({{ETAB_ville}}) — <strong>Année scolaire :</strong> {{ET_ANNEE}}</p>
        <p><strong>Date de l'entretien :</strong> {{ET_DATE}} à {{ET_HEURE}} | <strong>Jury :</strong> {{ET_JURY1}} et {{ET_JURY2}}</p>
        <hr>
        <h3>1. Dimension managériale et relationnelle</h3><p>{{ET_DMR}}</p>
        <h3>2. Dimension éducative et pastorale</h3><p>{{ET_DEP}}</p>
        <h3>3. Dimension pédagogique</h3><p>{{ET_DP}}</p>
        <h3>4. Dimension gestion et administration</h3><p>{{ET_DGA}}</p>
        <h3>5. Engagements institutionnels</h3><p>{{ET_EI}}</p>
        <h3>6. Avis du service de tutelle (Points attribués : {{ET_PTT}})</h3><p>{{ET_AST}}</p>
    </div>`
};

const BALISES_FUSION_WORD = [
    '{{PERS_Civilite}}', '{{PERS_NOM}}', '{{PERS_Prenom}}', '{{PERS_Datedenaissance}}', '{{PERS_lieunaissance}}',
    '{{PERS_adresse}}', '{{ETAB_nom}}', '{{ETAB_ville}}', '{{OGEC_nom}}', '{{OGEC_adresse}}', '{{OGEC_president}}',
    '{{REMCE_NUMAVENANT}}', '{{REMCE_date}}', '{{REMCE_TOTALPOINTS}}', '{{REMCE_BRUTANN}}', '{{REMCE_BRUTMEN}}',
    '{{REMCE_INDICEEN}}', '{{REMCE_AUGTRI}}', '{{REMCE_IF}}', '{{REMCE_FORM}}', '{{REMCE_AVTRI}}', '{{REMCE_IRTYPE}}', '{{REMCE_IR}}', '{{REMCE_IL}}',
    '{{DATE_MISSION}}', '{{DATE_FONCTION}}', '{{CLAUSE_ESSAI}}', '{{NB_CONGES}}', '{{DATE_JOUR}}',
    '{{ET_ANNEE}}', '{{ET_DATE}}', '{{ET_HEURE}}', '{{ET_JURY1}}', '{{ET_JURY2}}', '{{ET_PTT}}',
    '{{ET_DMR}}', '{{ET_DEP}}', '{{ET_DP}}', '{{ET_DGA}}', '{{ET_EI}}', '{{ET_AST}}'
];

async function getChefsEtablissementList() {
    const [{ data: chefs }, { data: etabs }, { data: ogecs }] = await Promise.all([
        supabaseClient.from('T_PERSONNES').select('*').eq('PERS_Type', "CHEF D'ETABLISSEMENT").order('PERS_NOM'),
        supabaseClient.from('T_ETABLISSEMENT').select('*'),
        supabaseClient.from('T_OGEC').select('*')
    ]);
    const etabMap = Object.fromEntries((etabs || []).map(e => [e.ETAB_id, e]));
    const ogecMap = Object.fromEntries((ogecs || []).map(o => [o.OGEC_id, o]));
    return (chefs || []).map(c => {
        const etab = etabMap[c.PERS_etab] || {};
        const ogec = ogecMap[etab.ETAB_OGEC] || {};
        return { ...c, etab, ogec };
    });
}

async function openCarriereGestionSelect() {
    const chefs = await getChefsEtablissementList();
    $('select-carriere-ce').innerHTML = '<option value="">-- Sélectionner un chef d\'établissement --</option>' +
        chefs.map(c => `<option value="${c.PERS_id}">${escapeHTML(c.PERS_NOM)} ${escapeHTML(c.PERS_Prenom)} (${escapeHTML(c.etab.ETAB_ville || 'N/C')})</option>`).join('');
    $('zone-liste-avenants-ce').classList.add('hidden');
    showView('view-carriere-ce-select');
}

async function chargerAvenantsChef() {
    const persId = $('select-carriere-ce').value;
    if (!persId) return $('zone-liste-avenants-ce').classList.add('hidden');
    const chefs = await getChefsEtablissementList();
    carriereSelectedChef = chefs.find(c => String(c.PERS_id) === String(persId));

    $('lbl-carriere-ce-nom').innerText = `${carriereSelectedChef.PERS_Civilite || ''} ${carriereSelectedChef.PERS_NOM} ${carriereSelectedChef.PERS_Prenom}`;
    $('lbl-carriere-ce-etab').innerText = `${carriereSelectedChef.etab.ETAB_nom || ''} (${carriereSelectedChef.etab.ETAB_ville || ''}) — OGEC : ${carriereSelectedChef.ogec.OGEC_nom || 'Non rattaché'}`;

    const { data: avenants } = await supabaseClient.from('T_REMCE').select('*').eq('REMCE_id', persId).order('REMCE_NUMAVENANT', { ascending: false });
    $('liste-avenants-ce-container').innerHTML = !(avenants?.length)
        ? '<p class="p-4 text-center text-slate-400 text-sm">Aucun avenant enregistré pour ce chef d\'établissement.</p>'
        : avenants.map(av => `
            <div class="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-50">
                <div>
                    <p class="font-bold text-slate-900">Avenant N° ${av.REMCE_NUMAVENANT} — <span class="text-red-900">${formatDateFR(av.REMCE_date)}</span></p>
                    <p class="text-xs text-slate-500">Total Points : <strong>${av.REMCE_TOTALPOINTS || 0}</strong> | Brut OGEC : <strong>${fmtCurrency(av.REMCE_BRUTANN)}</strong> | Brut État : <strong>${fmtCurrency(av.REMCE_BRUTMEN)}</strong></p>
                </div>
                <button onclick='ouvrirFormulaireAvenant(${JSON.stringify(av).replace(/'/g, "&#39;")})' class="bg-amber-700 text-white px-3.5 py-1.5 rounded-lg text-xs hover:bg-amber-600">✏️ Modifier</button>
            </div>`).join('');
    $('zone-liste-avenants-ce').classList.remove('hidden');
}

function ouvrirFormulaireAvenant(avenant) {
    carriereEditingAvenant = avenant;
    $('titre-avenant-ce').innerText = `${carriereSelectedChef.PERS_Civilite || ''} ${carriereSelectedChef.PERS_NOM} ${carriereSelectedChef.PERS_Prenom}`;
    $('sous-titre-avenant-ogec').innerText = `OGEC : ${carriereSelectedChef.ogec.OGEC_nom || 'N/C'}`;

    if (avenant) {
        $('badge-avenant-mode').innerText = `MODIFICATION AVENANT N° ${avenant.REMCE_NUMAVENANT}`;
        $('bloc-champs-non-modifiables').classList.remove('hidden');
        $('REMCE_key').value = avenant.REMCE_key || '';
        $('REMCE_id_readonly').value = avenant.REMCE_id || '';
        $('REMCE_OGEC_readonly').value = avenant.REMCE_OGEC || '';
        $('REMCE_TOTALPOINTS').value = avenant.REMCE_TOTALPOINTS || 0;
        $('REMCE_BRUTANN').value = avenant.REMCE_BRUTANN || 0;
        Object.entries(avenant).forEach(([k, v]) => {
            const el = $(k);
            if (el && el.type === 'checkbox') el.checked = !!v;
            else if (el) el.value = v ?? '';
        });
    } else {
        $('badge-avenant-mode').innerText = 'NOUVEL AVENANT TRIENNAL';
        $('bloc-champs-non-modifiables').classList.add('hidden');
        $('form-avenant-remce').reset();
        $('REMCE_Edition').checked = true;
    }
    showView('view-carriere-avenant-form');
}

async function sauvegarderAvenantCE(event) {
    event.preventDefault();
    const numFields = ['REMCE_NUMAVENANT', 'REMCE_INDICEEN', 'REMCE_AUGTRI', 'REMCE_IF', 'REMCE_FORM', 'REMCE_AVTRI', 'REMCE_IR', 'REMCE_IL', 'REMCE_SPEC1', 'REMCE_SPEC2', 'REMCE_EXCEP1', 'REMCE_EXCEP2', 'REMCE_DED', 'REMCE_BRUTMEN'];
    const strFields = ['REMCE_date', 'REMCE_IRTYPE', 'REMCE_SPEC1LIB', 'REMCE_SPEC2lib', 'REMCE_EXCEP1lib', 'REMCE_EXCEP2lib'];
    const payload = {
        REMCE_id: carriereSelectedChef.PERS_id,
        REMCE_OGEC: carriereSelectedChef.ogec.OGEC_id || null,
        REMCE_Edition: $('REMCE_Edition').checked
    };
    numFields.forEach(f => payload[f] = parseFloat($(f).value) || 0);
    strFields.forEach(f => payload[f] = $(f).value || null);

    const res = carriereEditingAvenant
        ? await supabaseClient.from('T_REMCE').update(payload).eq('REMCE_key', carriereEditingAvenant.REMCE_key)
        : await supabaseClient.from('T_REMCE').insert([payload]);

    if (res.error) return alert("Erreur : " + res.error.message);
    alert("✅ Avenant enregistré avec succès !");
    await chargerAvenantsChef();
    showView('view-carriere-ce-select');
}

async function openCarriereDocFilter(docType) {
    currentDocType = docType;
    $('titre-carriere-doc-filter').innerText = docType === 'avenant' ? 'Génération Avenant Triennal (Word)' : 'Génération Contrat de Travail CDI (Word)';
    $('bloc-options-contrat-doc').classList.toggle('hidden', docType !== 'contrat');
    const chefs = await getChefsEtablissementList();
    $('select-doc-ce').innerHTML = chefs.map(c => `<option value="${c.PERS_id}">${escapeHTML(c.PERS_NOM)} ${escapeHTML(c.PERS_Prenom)} (${escapeHTML(c.etab.ETAB_ville || '')})</option>`).join('');
    await chargerAvenantsPourEditionDoc();
    showView('view-carriere-doc-filter');
}

async function chargerAvenantsPourEditionDoc() {
    const persId = $('select-doc-ce').value;
    const { data } = await supabaseClient.from('T_REMCE').select('*').eq('REMCE_id', persId).order('REMCE_NUMAVENANT', { ascending: false });
    $('select-doc-avenant').innerHTML = !(data?.length)
        ? '<option value="">Aucun avenant disponible</option>'
        : data.map(a => `<option value="${a.REMCE_key}">Avenant N° ${a.REMCE_NUMAVENANT} — ${formatDateFR(a.REMCE_date)} (${a.REMCE_TOTALPOINTS || 0} pts)</option>`).join('');
}

async function getModeleWordContent(type) {
    const { data } = await supabaseClient.from('T_PARAM').select('PARAM_val').eq('PARAM_key', `MODELE_WORD_${type.toUpperCase()}`).maybeSingle();
    return data?.PARAM_val || DEFAULT_MODELES_WORD[type];
}

function downloadAsWordDoc(htmlContent, filename) {
    const fullHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>${htmlContent}</body></html>`;
    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

async function genererDocumentWordCE() {
    const persId = $('select-doc-ce').value;
    const remKey = $('select-doc-avenant').value;
    const chefs = await getChefsEtablissementList();
    const chef = chefs.find(c => String(c.PERS_id) === String(persId));
    const personMap = await getPersonMap();
    const { data: av } = remKey ? await supabaseClient.from('T_REMCE').select('*').eq('REMCE_key', remKey).maybeSingle() : { data: {} };
    const avData = av || {};

    const clausesEssai = {
        a: "Le salarié ayant déjà exercé les fonctions de Chef d'Établissement, il n'est pas prévu de période d'essai.",
        b: "Le présent contrat est soumis à une période d'essai de 4 mois.",
        c: "S'agissant d'une première nomination en qualité de Chef d'Établissement, la période d'essai est fixée à 4 mois."
    };

    const vars = {
        '{{PERS_Civilite}}': chef.PERS_Civilite || '',
        '{{PERS_NOM}}': chef.PERS_NOM || '',
        '{{PERS_Prenom}}': chef.PERS_Prenom || '',
        '{{PERS_Datedenaissance}}': formatDateFR(chef.PERS_Datedenaissance),
        '{{PERS_lieunaissance}}': chef.PERS_lieunaissance || '',
        '{{PERS_adresse}}': `${chef.PERS_adressepersonnelle || ''} ${chef.PERS_Codepostal || ''} ${chef.PERS_VILLE || ''}`.trim(),
        '{{ETAB_nom}}': chef.etab.ETAB_nom || '',
        '{{ETAB_ville}}': chef.etab.ETAB_ville || '',
        '{{OGEC_nom}}': chef.ogec.OGEC_nom || '',
        '{{OGEC_adresse}}': `${chef.ogec.OGEC_adresse || ''} ${chef.ogec.OGEC_codepostal || ''} ${chef.ogec.OGEC_ville || ''}`.trim(),
        '{{OGEC_president}}': personMap[chef.ogec.OGEC_président] || `${chef.ogec.OGEC_pdttitre || ''} ${chef.ogec.OGEC_pdtNOM || ''}`.trim(),
        '{{REMCE_NUMAVENANT}}': avData.REMCE_NUMAVENANT ?? '',
        '{{REMCE_date}}': formatDateFR(avData.REMCE_date),
        '{{REMCE_TOTALPOINTS}}': avData.REMCE_TOTALPOINTS ?? 0,
        '{{REMCE_BRUTANN}}': avData.REMCE_BRUTANN ?? 0,
        '{{REMCE_BRUTMEN}}': avData.REMCE_BRUTMEN ?? 0,
        '{{REMCE_INDICEEN}}': avData.REMCE_INDICEEN ?? 0,
        '{{REMCE_AUGTRI}}': avData.REMCE_AUGTRI ?? 0,
        '{{REMCE_IF}}': avData.REMCE_IF ?? 0,
        '{{REMCE_FORM}}': avData.REMCE_FORM ?? 0,
        '{{REMCE_AVTRI}}': avData.REMCE_AVTRI ?? 0,
        '{{REMCE_IRTYPE}}': avData.REMCE_IRTYPE || '',
        '{{REMCE_IR}}': avData.REMCE_IR ?? 0,
        '{{REMCE_IL}}': avData.REMCE_IL ?? 0,
        '{{DATE_MISSION}}': formatDateFR($('contrat-date-mission').value),
        '{{DATE_FONCTION}}': formatDateFR($('contrat-date-fonction').value),
        '{{CLAUSE_ESSAI}}': clausesEssai[$('contrat-periode-essai').value] || '',
        '{{NB_CONGES}}': $('contrat-conges').value || '6',
        '{{DATE_JOUR}}': new Date().toLocaleDateString('fr-FR')
    };

    let template = await getModeleWordContent(currentDocType);
    Object.entries(vars).forEach(([k, v]) => { template = template.split(k).join(escapeHTML(String(v))); });
    downloadAsWordDoc(template, `${currentDocType}_${chef.PERS_NOM}_${new Date().toISOString().split('T')[0]}.doc`);
}

async function genererTableauRemunerationsCE() {
    const [chefs, { data: allAvenants }] = await Promise.all([
        getChefsEtablissementList(),
        supabaseClient.from('T_REMCE').select('*').order('REMCE_NUMAVENANT', { ascending: false })
    ]);

    const rows = chefs.map(c => {
        const lastAv = (allAvenants || []).find(a => String(a.REMCE_id) === String(c.PERS_id)) || {};
        const brutOgec = Number(lastAv.REMCE_BRUTANN) || 0;
        const brutEtat = Number(lastAv.REMCE_BRUTMEN) || 0;
        return {
            nom: `${c.PERS_Civilite || ''} ${c.PERS_NOM} ${c.PERS_Prenom}`.trim(),
            etab: `${c.etab.ETAB_ville || ''} — ${c.etab.ETAB_nom || ''}`,
            numAv: lastAv.REMCE_NUMAVENANT || '-',
            points: Number(lastAv.REMCE_TOTALPOINTS) || 0,
            brutOgec, brutEtat, total: brutOgec + brutEtat
        };
    }).sort((a, b) => a.total - b.total);

    exportStore.remunerations_ce = rows.map(r => ({ Chef_Etablissement: r.nom, Etablissement: r.etab, Avenant: r.numAv, Total_Points: r.points, Brut_OGEC: r.brutOgec, Brut_Etat: r.brutEtat, Total_Cumule: r.total }));
    $('tbody-remunerations-ce').innerHTML = rows.map(r => `
        <tr>
            <td class="p-3 font-bold">${escapeHTML(r.nom)}</td>
            <td class="p-3 text-xs">${escapeHTML(r.etab)}</td>
            <td class="p-3 text-center font-mono">${r.numAv}</td>
            <td class="p-3 text-right font-mono">${r.points}</td>
            <td class="p-3 text-right font-mono">${fmtCurrency(r.brutOgec)}</td>
            <td class="p-3 text-right font-mono">${fmtCurrency(r.brutEtat)}</td>
            <td class="p-3 text-right font-mono font-bold text-red-900 bg-red-50/40">${fmtCurrency(r.total)}</td>
        </tr>`).join('');
    showView('view-carriere-tableau-rem');
}

async function openCarriereModelesEditor() {
    $('palette-balises-fusion').innerHTML = BALISES_FUSION_WORD.map(b =>
        `<button type="button" onmousedown="event.preventDefault()" onclick="insererBaliseModele('${b}')" class="px-2 py-1 bg-white border rounded font-mono hover:bg-red-50 hover:border-red-900">${b}</button>`
    ).join('');
    showView('view-carriere-modeles');
    await switchModeleEditor('avenant');
}

async function switchModeleEditor(type) {
    currentModeleTab = type;
    ['avenant', 'contrat', 'cr_triennal'].forEach(t => {
        const btn = $(`btn-tab-mod-${t}`);
        btn.className = t === type ? 'px-5 py-2.5 rounded-lg font-bold text-sm bg-red-900 text-white' : 'px-5 py-2.5 rounded-lg font-semibold text-sm bg-slate-200 text-slate-700';
    });
    $('editor-modele-wysiwyg').innerHTML = await getModeleWordContent(type);
}

function insererBaliseModele(balise) {
    const ed = $('editor-modele-wysiwyg');
    ed.focus();
    document.execCommand('insertText', false, balise);
}

function reinitialiserModeleParDefaut() {
    if (!confirm("Restaurer le modèle d'origine ? Vos modifications non enregistrées seront remplacées.")) return;
    $('editor-modele-wysiwyg').innerHTML = DEFAULT_MODELES_WORD[currentModeleTab];
}

async function sauvegarderModeleWord() {
    const key = `MODELE_WORD_${currentModeleTab.toUpperCase()}`;
    const val = $('editor-modele-wysiwyg').innerHTML;
    const { data: existing } = await supabaseClient.from('T_PARAM').select('PARAM_key').eq('PARAM_key', key).maybeSingle();
    const res = existing
        ? await supabaseClient.from('T_PARAM').update({ PARAM_val: val }).eq('PARAM_key', key)
        : await supabaseClient.from('T_PARAM').insert([{ PARAM_key: key, PARAM_val: val }]);
    alert(res.error ? "Erreur : " + res.error.message : "✅ Modèle enregistré avec succès !");
}

// =========================================================================
// 11. SOUS-MODULE ENTRETIENS TRIENNAUX (T_TRIENNAL)
// =========================================================================
let triennalSelectedChef = null, triennalEditingRecord = null;

async function openTriennalSaisieSelect() {
    const chefs = await getChefsEtablissementList();
    $('select-triennal-ce').innerHTML = '<option value="">-- Sélectionner un chef d\'établissement --</option>' +
        chefs.map(c => `<option value="${c.PERS_id}">${escapeHTML(c.PERS_NOM)} ${escapeHTML(c.PERS_Prenom)} (${escapeHTML(c.etab.ETAB_ville || '')})</option>`).join('');
    $('zone-liste-triennaux-ce').classList.add('hidden');
    showView('view-triennal-select');
}

async function chargerEntretiensChef() {
    const persId = $('select-triennal-ce').value;
    if (!persId) return $('zone-liste-triennaux-ce').classList.add('hidden');
    const chefs = await getChefsEtablissementList();
    triennalSelectedChef = chefs.find(c => String(c.PERS_id) === String(persId));
    $('lbl-triennal-ce-nom').innerText = `${triennalSelectedChef.PERS_Civilite || ''} ${triennalSelectedChef.PERS_NOM} ${triennalSelectedChef.PERS_Prenom}`;
    $('lbl-triennal-ce-info').innerText = `${triennalSelectedChef.etab.ETAB_nom || ''} (${triennalSelectedChef.etab.ETAB_ville || ''})`;

    const [{ data: list }, personMap] = await Promise.all([
        supabaseClient.from('T_TRIENNAL').select('*').eq('ET_id', persId).order('ET_DATE', { ascending: false }),
        getPersonMap()
    ]);

    $('liste-triennaux-ce-container').innerHTML = !(list?.length)
        ? '<p class="p-4 text-center text-slate-400 text-sm">Aucun entretien triennal enregistré.</p>'
        : list.map(et => `
            <div class="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-50">
                <div>
                    <p class="font-bold text-slate-900">Entretien du ${formatDateFR(et.ET_DATE)} (${escapeHTML(et.ET_ANNEE || '')})</p>
                    <p class="text-xs text-slate-500">Jury : ${escapeHTML(personMap[et.ET_JURY1] || 'N/C')} / ${escapeHTML(personMap[et.ET_JURY2] || 'N/C')} — Points tutelle : <strong>${et.ET_PTT || 0}</strong></p>
                </div>
                <button onclick='ouvrirFormulaireTriennal(${JSON.stringify(et).replace(/'/g, "&#39;")})' class="bg-amber-700 text-white px-3.5 py-1.5 rounded-lg text-xs hover:bg-amber-600">✏️ Modifier</button>
            </div>`).join('');
    $('zone-liste-triennaux-ce').classList.remove('hidden');
}

async function ouvrirFormulaireTriennal(record) {
    triennalEditingRecord = record;
    $('titre-triennal-ce').innerText = `${triennalSelectedChef.PERS_Civilite || ''} ${triennalSelectedChef.PERS_NOM} ${triennalSelectedChef.PERS_Prenom}`;
    $('ET_ANNEE').innerHTML = (appState.cacheAnnees || ['2025-2026', '2024-2025']).map(a => `<option value="${a}">${a}</option>`).join('');

    const { data: tutellePers } = await supabaseClient.from('T_PERSONNES').select('PERS_id, PERS_NOM, PERS_Prenom').eq('PERS_Type', 'TUTELLE').order('PERS_NOM');
    const juryOpts = '<option value="">-- Choisir --</option>' + (tutellePers || []).map(p => `<option value="${p.PERS_id}">${escapeHTML(p.PERS_NOM)} ${escapeHTML(p.PERS_Prenom)}</option>`).join('');
    $('ET_JURY1').innerHTML = juryOpts;
    $('ET_JURY2').innerHTML = juryOpts;

    if (record) {
        $('badge-triennal-mode').innerText = 'MODIFICATION ENTRETIEN TRIENNAL';
        Object.entries(record).forEach(([k, v]) => { const el = $(k); if (el) el.value = v ?? ''; });
    } else {
        $('badge-triennal-mode').innerText = 'NOUVEL ENTRETIEN TRIENNAL';
        $('form-entretien-triennal').reset();
    }
    showView('view-triennal-form');
}

async function sauvegarderEntretienTriennal(event) {
    event.preventDefault();
    const fields = ['ET_ANNEE', 'ET_DERNIER', 'ET_PTT', 'ET_DATE', 'ET_HEURE', 'ET_JURY1', 'ET_JURY2', 'ET_DMR', 'ET_DEP', 'ET_DP', 'ET_DGA', 'ET_EI', 'ET_AST'];
    const payload = { ET_id: triennalSelectedChef.PERS_id };
    fields.forEach(f => {
        const val = $(f).value;
        payload[f] = f === 'ET_PTT' ? (parseInt(val, 10) || 0) : (val || null);
    });

    const res = triennalEditingRecord?.ET_key
        ? await supabaseClient.from('T_TRIENNAL').update(payload).eq('ET_key', triennalEditingRecord.ET_key)
        : await supabaseClient.from('T_TRIENNAL').insert([payload]);

    if (res.error) return alert("Erreur : " + res.error.message);
    alert("✅ Entretien triennal enregistré !");
    await chargerEntretiensChef();
    showView('view-triennal-select');
}

async function genererEtatEntretiensTriennaux() {
    const [chefs, { data: allEt }] = await Promise.all([
        getChefsEtablissementList(),
        supabaseClient.from('T_TRIENNAL').select('*').order('ET_DATE', { ascending: false })
    ]);

    exportStore.etat_triennaux = [];
    $('tbody-triennal-etat').innerHTML = chefs.map(c => {
        const last = (allEt || []).find(e => String(e.ET_id) === String(c.PERS_id));
        const anneeEnt = last?.ET_ANNEE || (last?.ET_DATE ? getAnneeScolaireFromDate(last.ET_DATE) : '');
        const prochain = anneeEnt ? shiftAnneeScolaire(anneeEnt, 3) : 'À programmer';
        const nom = `${c.PERS_Civilite || ''} ${c.PERS_NOM} ${c.PERS_Prenom}`.trim();
        const etab = `${c.etab.ETAB_ville || ''} — ${c.etab.ETAB_nom || ''}`;
        exportStore.etat_triennaux.push({ Chef: nom, Etablissement: etab, Dernier_Entretien: formatDateFR(last?.ET_DATE), Annee_Entretien: anneeEnt || 'Aucun', Prochain_Entretien: prochain });
        return `<tr>
            <td class="p-3 font-bold">${escapeHTML(nom)}</td>
            <td class="p-3 text-xs">${escapeHTML(etab)}</td>
            <td class="p-3 text-center font-mono">${formatDateFR(last?.ET_DATE)}</td>
            <td class="p-3 text-center font-mono">${escapeHTML(anneeEnt || 'Aucun')}</td>
            <td class="p-3 text-center font-bold text-red-900 bg-red-50/40">${escapeHTML(prochain)}</td>
        </tr>`;
    }).join('');
    showView('view-triennal-etat');
}

async function openTriennalOrganisationFilter() {
    $('select-triennal-org-annee').innerHTML = (appState.cacheAnnees || ['2025-2026', '2024-2025']).map(a => `<option value="${a}">${a}</option>`).join('');
    showView('view-triennal-organisation');
    await chargerOrganisationTriennaleAnnee();
}

async function chargerOrganisationTriennaleAnnee() {
    const annee = $('select-triennal-org-annee').value;
    const [{ data: list }, chefs, personMap] = await Promise.all([
        supabaseClient.from('T_TRIENNAL').select('*').eq('ET_ANNEE', annee).order('ET_DATE'),
        getChefsEtablissementList(),
        getPersonMap()
    ]);
    const chefMap = Object.fromEntries(chefs.map(c => [String(c.PERS_id), c]));
    exportStore.org_triennaux = [];

    $('tbody-triennal-org').innerHTML = !(list?.length)
        ? '<tr><td colspan="6" class="p-4 text-center text-slate-400">Aucun entretien planifié pour cette année scolaire.</td></tr>'
        : list.map(et => {
            const c = chefMap[String(et.ET_id)] || { etab: {} };
            const chefNom = `${c.PERS_Civilite || ''} ${c.PERS_NOM || ''} ${c.PERS_Prenom || ''}`.trim();
            const etabNom = `${c.etab?.ETAB_ville || ''} — ${c.etab?.ETAB_nom || ''}`;
            const j1 = personMap[et.ET_JURY1] || '—', j2 = personMap[et.ET_JURY2] || '—';
            exportStore.org_triennaux.push({ Date: formatDateFR(et.ET_DATE), Horaire: et.ET_HEURE || '', Chef: chefNom, Etablissement: etabNom, Jury1: j1, Jury2: j2 });
            return `<tr><td class="p-3 font-mono">${formatDateFR(et.ET_DATE)}</td><td class="p-3 font-mono">${escapeHTML(et.ET_HEURE || '—')}</td><td class="p-3 font-bold">${escapeHTML(chefNom)}</td><td class="p-3 text-xs">${escapeHTML(etabNom)}</td><td class="p-3 text-xs">${escapeHTML(j1)}</td><td class="p-3 text-xs">${escapeHTML(j2)}</td></tr>`;
        }).join('');
}

async function openTriennalCrFilter() {
    const chefs = await getChefsEtablissementList();
    $('select-cr-ce').innerHTML = chefs.map(c => `<option value="${c.PERS_id}">${escapeHTML(c.PERS_NOM)} ${escapeHTML(c.PERS_Prenom)}</option>`).join('');
    await chargerEntretiensPourCR();
    showView('view-triennal-cr-filter');
}

async function chargerEntretiensPourCR() {
    const persId = $('select-cr-ce').value;
    const { data } = await supabaseClient.from('T_TRIENNAL').select('*').eq('ET_id', persId).order('ET_DATE', { ascending: false });
    $('select-cr-entretien').innerHTML = !(data?.length)
        ? '<option value="">Aucun entretien enregistré</option>'
        : data.map(e => `<option value="${e.ET_key}">Entretien du ${formatDateFR(e.ET_DATE)} (${e.ET_ANNEE || ''})</option>`).join('');
}

async function genererWordCompteRenduTriennal() {
    const persId = $('select-cr-ce').value;
    const etKey = $('select-cr-entretien').value;
    if (!etKey) return alert("Veuillez sélectionner un entretien.");
    const [chefs, personMap, { data: et }] = await Promise.all([
        getChefsEtablissementList(), getPersonMap(),
        supabaseClient.from('T_TRIENNAL').select('*').eq('ET_key', etKey).single()
    ]);
    const chef = chefs.find(c => String(c.PERS_id) === String(persId));
    const vars = {
        '{{PERS_Civilite}}': chef.PERS_Civilite || '', '{{PERS_NOM}}': chef.PERS_NOM || '', '{{PERS_Prenom}}': chef.PERS_Prenom || '',
        '{{ETAB_nom}}': chef.etab.ETAB_nom || '', '{{ETAB_ville}}': chef.etab.ETAB_ville || '',
        '{{ET_ANNEE}}': et.ET_ANNEE || '', '{{ET_DATE}}': formatDateFR(et.ET_DATE), '{{ET_HEURE}}': et.ET_HEURE || '',
        '{{ET_JURY1}}': personMap[et.ET_JURY1] || '', '{{ET_JURY2}}': personMap[et.ET_JURY2] || '',
        '{{ET_PTT}}': et.ET_PTT ?? 0, '{{ET_DMR}}': et.ET_DMR || '', '{{ET_DEP}}': et.ET_DEP || '',
        '{{ET_DP}}': et.ET_DP || '', '{{ET_DGA}}': et.ET_DGA || '', '{{ET_EI}}': et.ET_EI || '', '{{ET_AST}}': et.ET_AST || ''
    };
    let tpl = await getModeleWordContent('cr_triennal');
    Object.entries(vars).forEach(([k, v]) => { tpl = tpl.split(k).join(escapeHTML(String(v)).replace(/\n/g, '<br>')); });
    downloadAsWordDoc(tpl, `CR_Triennal_${chef.PERS_NOM}_${et.ET_ANNEE || ''}.doc`);
}
