// =========================================================================
// 5. ÉDITIONS & ANNUAIRES
// =========================================================================
async function generateAnnuairePersonnes() {
    const selectedType = $('filter-pers-type').value;
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
    $('annuaire-pers-title').innerText = selectedType ? `Annuaire des Personnes - Type : ${selectedType}` : "Annuaire complet des Personnes";

    const photoEntries = await Promise.all((persons || []).map(async p => {
        try {
            const { data: blob } = await supabaseClient.storage.from('Photos_personnes').download(p.PERS_photo || `${p.PERS_id}.jpg`);
            return blob ? [p.PERS_id, URL.createObjectURL(blob)] : null;
        } catch { return null; }
    }));
    const photoMap = Object.fromEntries(photoEntries.filter(Boolean));

    $('annuaire-pers-container').innerHTML = !(persons?.length) ? `<p class="text-center text-slate-500 py-6">Aucune personne trouvée.</p>` : persons.map(p => {
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

        let affHtml = upList.length ? `<div class="mt-2 space-y-1"><span class="font-semibold text-xs text-red-900 uppercase">Unités Pédagogiques dirigées :</span>${upList.map(u => `<p class="text-sm text-slate-700 bg-slate-50 p-2 rounded border-l-4 border-red-950"><strong>${escapeHTML(u.UP_NOM)}</strong> — ${escapeHTML(u.UP_ville || '')}</p>`).join('')}</div>` : '';
        if (mandats.length) affHtml += `<div class="mt-2 space-y-1"><span class="font-semibold text-xs text-red-900 uppercase">Fonctions OGEC / APEL :</span>${mandats.map(m => `<p class="text-sm text-slate-700 bg-slate-50 p-2 rounded border-l-4 border-red-800"><strong>${escapeHTML(m.poste)}</strong> — ${escapeHTML(m.structure)}</p>`).join('')}</div>`;
        if (!affHtml) affHtml = `<p class="text-sm text-slate-600 mt-2">Affectation : <span class="font-medium">${escapeHTML(affectText)}</span></p>`;

        const photoHtml = photoMap[p.PERS_id] ? `<img src="${photoMap[p.PERS_id]}" class="w-24 h-32 object-cover rounded border shadow-sm">` : `<div class="w-24 h-32 bg-slate-100 border rounded flex items-center justify-center text-xs text-slate-400">Pas de photo</div>`;
        return `<div class="bg-white border rounded-xl p-5 shadow-sm flex flex-col md:flex-row gap-6 items-start">
            <div class="flex-shrink-0 mx-auto md:mx-0">${photoHtml}</div>
            <div class="flex-grow space-y-2">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2">
                    <h3 class="text-lg font-bold text-red-900 uppercase">${escapeHTML(p.PERS_Civilite || '')} ${escapeHTML(p.PERS_NOM || '')} ${escapeHTML(p.PERS_Prenom || '')}</h3>
                    <span class="text-xs font-semibold bg-red-100 text-red-800 px-2.5 py-1 rounded-full">${escapeHTML(badge)}</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600">
                    <p><strong>Courriel :</strong> <a href="mailto:${escapeHTML(p.PERS_courriel1 || '')}" class="text-blue-800 underline">${escapeHTML(p.PERS_courriel1 || 'N/c')}</a></p>
                    <p><strong>Téléphone :</strong> ${escapeHTML(p.PERS_Telephoneportable || p.PERS_Telephonebureau || 'N/c')}</p>
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
    $('annuaire-etabs-container').innerHTML = (etabs || []).map(e => {
        const eUps = (ups || []).filter(u => u.UP_etablissement === e.ETAB_id);
        exportStore.etablissements.push({ Ville: e.ETAB_ville || '', Etablissement: e.ETAB_nom || '', Adresse: `${e.ETAB_adresse || ''} ${e.ETAB_codepostal || ''}`, Courriel: e.ETAB_courriel || '', Telephone: e.ETAB_telephone || '', Site: e.ETAB_siteinternet || '', NbUP: eUps.length });
        const upsHtml = eUps.length ? `<div class="mt-4 border-t pt-3 grid grid-cols-1 md:grid-cols-2 gap-3">${eUps.map(u => `<div class="bg-slate-50 border p-3 rounded-lg text-sm"><p class="font-bold text-red-900">${escapeHTML(u.UP_NOM)} (${escapeHTML(u.UP_type || 'N/C')})</p><p class="text-xs text-slate-600"><strong>Chef :</strong> ${escapeHTML(personMap[u.UP_chefetablissement] || 'Non renseigné')}</p></div>`).join('')}</div>` : '';
        return `<div class="bg-white border rounded-xl p-6 shadow-sm"><span class="text-xs font-semibold bg-red-900 text-white px-2.5 py-1 rounded uppercase">${escapeHTML(e.ETAB_ville || '')}</span><h3 class="text-xl font-bold text-slate-900 mt-1">${escapeHTML(e.ETAB_nom || '')}</h3><p class="text-sm text-slate-600 mt-2">${escapeHTML(e.ETAB_adresse || '')} ${escapeHTML(e.ETAB_codepostal || '')} ${escapeHTML(e.ETAB_ville || '')} — Tél : ${escapeHTML(e.ETAB_telephone || 'N/c')}</p>${upsHtml}</div>`;
    }).join('');
    showView('view-annuaire-etabs-result');
}

async function generateAnnuaireOGEC() {
    const [{ data: ogecs }, personMap] = await Promise.all([supabaseClient.from('T_OGEC').select('*').order('OGEC_ville'), getPersonMap()]);
    exportStore.ogec = [];
    $('annuaire-ogec-container').innerHTML = (ogecs || []).map(o => {
        const pdt = personMap[o.OGEC_président] || (o.OGEC_pdtNOM ? `${o.OGEC_pdttitre || ''} ${o.OGEC_pdtNOM} ${o.OGEC_pdtprenom || ''}` : 'N/c');
        const vp = personMap[o.OGEC_vicepresident] || 'N/c', tres = personMap[o.OGEC_tresorier] || 'N/c', sec = personMap[o.OGEC_secretaire] || 'N/c';
        exportStore.ogec.push({ Ville: o.OGEC_ville || '', Nom: o.OGEC_nom || '', Siret: o.OGEC_siret || '', Adresse: `${o.OGEC_adresse || ''} ${o.OGEC_codepostal || ''} ${o.OGEC_ville || ''}`, President: pdt, VicePresident: vp, Tresorier: tres, Secretaire: sec });
        return `<div class="bg-white border rounded-xl p-6 shadow-sm"><div class="flex justify-between border-b pb-2 mb-3"><div><span class="text-xs font-semibold bg-red-900 text-white px-2.5 py-1 rounded uppercase">${escapeHTML(o.OGEC_ville || '')}</span><h3 class="text-xl font-bold mt-1">${escapeHTML(o.OGEC_nom || '')}</h3></div><span class="text-xs font-mono">SIRET : ${escapeHTML(o.OGEC_siret || 'N/c')}</span></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm"><div>${escapeHTML(o.OGEC_adresse || '')}<br>${escapeHTML(o.OGEC_codepostal || '')} ${escapeHTML(o.OGEC_ville || '')}</div><div class="bg-slate-50 p-3 rounded border"><p><strong>Président :</strong> ${escapeHTML(pdt)}</p><p><strong>VP :</strong> ${escapeHTML(vp)} | <strong>Trés. :</strong> ${escapeHTML(tres)} | <strong>Sec. :</strong> ${escapeHTML(sec)}</p></div></div></div>`;
    }).join('');
    showView('view-annuaire-ogec-result');
}

async function generateAnnuaireAPEL() {
    const [{ data: apels }, personMap] = await Promise.all([supabaseClient.from('T_APEL').select('*').order('APEL_ville'), getPersonMap()]);
    exportStore.apel = [];
    $('annuaire-apel-container').innerHTML = (apels || []).map(a => {
        const pdt = personMap[a.APEL_president] || 'N/c', vp = personMap[a.APEL_vicepresident] || 'N/c', tres = personMap[a.APEL_tresorier] || 'N/c', sec = personMap[a.APEL_secretaire] || 'N/c';
        exportStore.apel.push({ Ville: a.APEL_ville || '', Nom: a.APEL_nom || '', President: pdt, VicePresident: vp, Tresorier: tres, Secretaire: sec });
        return `<div class="bg-white border rounded-xl p-6 shadow-sm"><span class="text-xs font-semibold bg-red-900 text-white px-2.5 py-1 rounded uppercase">${escapeHTML(a.APEL_ville || '')}</span><h3 class="text-xl font-bold mt-1 mb-3">${escapeHTML(a.APEL_nom || '')}</h3><div class="bg-slate-50 p-3 rounded border text-sm grid grid-cols-2 gap-2"><p><strong>Président :</strong> ${escapeHTML(pdt)}</p><p><strong>VP :</strong> ${escapeHTML(vp)}</p><p><strong>Trésorier :</strong> ${escapeHTML(tres)}</p><p><strong>Secrétaire :</strong> ${escapeHTML(sec)}</p></div></div>`;
    }).join('');
    showView('view-annuaire-apel-result');
}

async function generateAnnuaireDioceses() {
    const { data: dioceses } = await supabaseClient.from('T_DIOCESE').select('*').order('DIO_NOM');
    exportStore.dioceses = [];
    $('annuaire-dioceses-container').innerHTML = (dioceses || []).map(d => {
        const ev = `${d.DIO_EV_PRE || ''} ${d.DIO_EV_NOM || ''}`.trim() || 'N/c';
        const dd = `${d.DIO_DD_TITRE || ''} ${d.DIO_DD_PRE || ''} ${d.DIO_DD_NOM || ''}`.trim() || 'N/c';
        exportStore.dioceses.push({ Diocese: d.DIO_NOM || '', Pays: d.DIO_PAYS || 'FRANCE', Eveque: ev, EvequeMail: d.DIO_EV_MAIL || '', EvequeTel: d.DIO_EV_TEL || '', EvequeAdr: `${d.DIO_EV_ADR || ''} ${d.DIO_EV_CP || ''} ${d.DIO_EV_VILLE || ''}`, Directeur: dd, DirecteurMail: d.DIO_DD_MAIL || '', DirecteurMob: d.DIO_DD_MOB || '', DirecteurTel: d.DIO_DD_TEL || '', DirecteurAdr: `${d.DIO_DD_ADR || ''} ${d.DIO_DD_CP || ''} ${d.DIO_DD_VILLE || ''}` });
        return `<div class="bg-white border rounded-xl p-6 shadow-sm"><h3 class="text-xl font-bold text-red-900 border-b pb-2 mb-3">${escapeHTML(d.DIO_NOM || '')}</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"><div class="bg-slate-50 p-3 rounded border"><p class="font-bold text-red-900">Évêque : Mgr ${escapeHTML(ev)}</p><p>${escapeHTML(d.DIO_EV_MAIL || '')} | ${escapeHTML(d.DIO_EV_TEL || '')}</p></div><div class="bg-slate-50 p-3 rounded border"><p class="font-bold text-red-900">Directeur : ${escapeHTML(dd)}</p><p>${escapeHTML(d.DIO_DD_MAIL || '')} | ${escapeHTML(d.DIO_DD_MOB || '')}</p></div></div></div>`;
    }).join('');
    showView('view-annuaire-dioceses-result');
}

// =========================================================================
// 6. SYNTHÈSE ÉCONOMIQUE, EFFECTIFS & EMPRUNTS
// =========================================================================
async function loadAnneesScolairesSelect() {
    const { data } = await supabaseClient.from('T_ANNEESCOLAIRE').select('*');
    let annees = (data || []).map(a => a.ANNEESCOLAIRE || a.annee).filter(Boolean);
    if (!annees.length) annees = ['2025-2026', '2024-2025', '2023-2024', '2022-2023', '2021-2022'];
    annees.sort((a, b) => b.localeCompare(a));
    appState.cacheAnnees = annees;
    const target = `${new Date().getFullYear() - 2}-${new Date().getFullYear() - 1}`;
    const html = annees.map(a => `<option value="${a}" ${a === target ? 'selected' : ''}>${a}</option>`).join('');
    ['select-eco-annee', 'select-effpers-annee-ref', 'select-effectifs-annee-ref', 'TARIF_anneescolaire', 'select-facture-annee'].forEach(id => {
        const el = $(id); if (el) el.innerHTML = html;
    });
}

async function generateSyntheseEco() {
    const etabId = $('select-eco-etab').value;
    const anneeN = $('select-eco-annee').value;
    const yN = parseInt(anneeN.split('-')[0], 10);
    const annees = [`${yN - 2}-${yN - 1}`, `${yN - 1}-${yN}`, anneeN];

    const [{ data: etab, error: e1 }, { data: ecos, error: e2 }, { data: effs, error: e3 }] = await Promise.all([
        supabaseClient.from('T_ETABLISSEMENT').select('*').eq('ETAB_id', etabId).maybeSingle(),
        supabaseClient.from('T_ECO').select('*').eq('ECO_id', etabId),
        supabaseClient.from('T_EFFECTIF').select('*').eq('EFFECTIF_etab', etabId)
    ]);

    if (e1 || e2 || e3) return alert("Erreur lors du chargement des données économiques : " + (e1?.message || e2?.message || e3?.message));

    $('lbl-eco-ville').innerText = etab?.ETAB_ville || '';
    $('lbl-eco-etab-nom').innerText = etab?.ETAB_nom || '';
    $('lbl-eco-annee-ref').innerText = anneeN;
    ['th-annee-n2', 'th-annee-n1', 'th-annee-n'].forEach((id, i) => $(id).innerText = annees[i]);

    const metrics = annees.map(an => {
        const r = (ecos || []).find(x => String(x.ECO_EXERCICE || x.ECO_exercice || '').trim() === an) || {};
        const e = (effs || []).find(x => String(x.EFFECTIF_anneescolaire || x.ANNEESCOLAIRE || '').trim() === an) || {};
        const cc = r.ECO_CC || 0, prod = r.ECO_PROFONC || 0, inv = r.ECO_INVIMM || 0, caf = r.ECO_CAF || 0;
        const msal = r.ECO_MSAL || 0, fdr = r.ECO_FDR || 0, dette = r.ECO_DETTE || 0, fact = r.ECO_FACTFAM || 0, imp = r.ECO_IMPFAM || 0;
        return { cc, prod, inv, pctInv: cc ? inv / cc : null, caf, pctCaf: prod ? caf / prod : null, mna: caf - (r.ECO_ANNEMP || 0), msal, pctMsal: prod ? msal / prod : null, fdr, fdrJ: cc ? (fdr / cc) * 365 : null, dette, remb: caf ? dette / caf : null, effTot: sumTotalEleves(e), fact, imp, pctImp: fact ? imp / fact : null, repas: r.ECO_NBREPAS || 0 };
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
    $('tb-eco-body').innerHTML = rowsDef.map(([label, key, bold, type]) => `
        <tr class="${bold ? 'bg-slate-100 font-bold' : ''}"><td class="p-2.5">${label}</td>
        <td class="p-2.5 text-right font-mono">${fmt(metrics[0][key], type)}</td>
        <td class="p-2.5 text-right font-mono">${fmt(metrics[1][key], type)}</td>
        <td class="p-2.5 text-right font-mono font-bold bg-red-50/50">${fmt(metrics[2][key], type)}</td></tr>`
    ).join('');
    showView('view-synthese-eco-result');
}

async function generateTableauEffectifs() {
    const anneeRef = $('select-effectifs-annee-ref').value;
    const perimetre = $('select-effectifs-perimetre').value;
    $('lbl-effectifs-annee-ref').innerText = anneeRef;
    const yRef = parseInt(anneeRef.split('-')[0], 10);
    const periodes = Array.from({ length: 6 }, (_, i) => `${yRef - 5 + i}-${yRef - 4 + i}`);

    let [{ data: etabs }, { data: allEffs }] = await Promise.all([
        supabaseClient.from('T_ETABLISSEMENT').select('*').order('ETAB_ville'),
        supabaseClient.from('T_EFFECTIF').select('*')
    ]);
    if (perimetre === 'france_uniquement') etabs = (etabs || []).filter(isFranceEtab);

    exportStore.effectifs_6ans = [];
    $('container-effectifs-villes').innerHTML = (etabs || []).map(e => {
        const eEffs = (allEffs || []).filter(r => String(r.EFFECTIF_etab || r.EFFECTIF_id || '').trim() === String(e.ETAB_id).trim());
        let prevTot = 0;
        const rowsHtml = periodes.map((p, idx) => {
            const r = eEffs.find(x => String(x.EFFECTIF_anneescolaire || x.ANNEESCOLAIRE || '').trim() === p) || {};
            const tot = sumTotalEleves(r);
            const evol = idx > 0 && prevTot > 0 ? (((tot - prevTot) / prevTot) * 100).toFixed(1) + ' %' : '-';
            prevTot = tot;
            exportStore.effectifs_6ans.push({ Ville: e.ETAB_ville, Etablissement: e.ETAB_nom, Periode: p, Total: tot, Evolution: evol });
            return `<tr class="${p === anneeRef ? 'bg-amber-50 font-bold' : ''}"><td class="p-2 border">${p}</td><td class="p-2 text-right border font-mono">${r.EFFECTIF_ecole || '-'}</td><td class="p-2 text-right border font-mono">${r.EFFECTIF_college || '-'}</td><td class="p-2 text-right border font-mono font-bold bg-slate-100">${tot || '-'}</td><td class="p-2 text-right border font-mono">${evol}</td></tr>`;
        }).join('');
        return `<div class="bg-white border rounded-xl shadow-sm p-4 mb-6"><div class="bg-red-900 text-white p-2.5 rounded-t-lg font-bold uppercase">${escapeHTML(e.ETAB_ville)} — ${escapeHTML(e.ETAB_nom)}</div><table class="w-full text-xs border-collapse mt-2"><thead><tr class="bg-slate-100"><th class="p-2 border">Période</th><th class="p-2 text-right border">École</th><th class="p-2 text-right border">Collège</th><th class="p-2 text-right border">Total</th><th class="p-2 text-right border">Évol %</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
    }).join('');
    showView('view-effectifs-result');
}

function openEmprunteurForm() {
    $('input-emprunteur-date').value = new Date().toISOString().split('T')[0];
    showView('view-emprunteur-filter');
}

async function generateEtatEmprunteur() {
    const etabId = $('select-emprunteur-etab').value;
    const dateEtat = new Date($('input-emprunteur-date').value);
    $('lbl-emp-date-ref').innerText = dateEtat.toLocaleDateString('fr-FR');

    const [{ data: etab }, { data: emprunts }] = await Promise.all([
        supabaseClient.from('T_ETABLISSEMENT').select('*').eq('ETAB_id', etabId).maybeSingle(),
        supabaseClient.from('T_EMPRUNT').select('*').eq('T_EMPRUNT_ETAB', etabId)
    ]);
    $('lbl-emp-etab-ville').innerText = etab?.ETAB_ville || '';
    $('lbl-emp-etab-nom').innerText = etab?.ETAB_nom || '';

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
        const dateFin = emp.T_EMPRUNT_DATEFIN || '';
        exportStore.emprunteur.push({ Date: emp.T_EMPRUNT_DATE, DateFin: dateFin, Motif: emp.T_EMPRUNT_MOTIF, Duree: (duree / 12).toFixed(1), Taux: (taux * 100).toFixed(2) + '%', Capital: cap, Annuite: ann, RestantDu: crd.toFixed(2) });
        return `<tr><td class="p-3 border font-mono">${emp.T_EMPRUNT_DATE}</td><td class="p-3 border font-mono">${dateFin}</td><td class="p-3 border">${escapeHTML(emp.T_EMPRUNT_MOTIF || 'Emprunt')}</td><td class="p-3 border text-right font-mono">${fmtCurrency(cap)}</td><td class="p-3 border text-right font-mono">${fmtCurrency(ann)}</td><td class="p-3 border text-right font-mono font-bold bg-red-50/30">${fmtCurrency(crd)}</td></tr>`;
    }).join('');

    $('container-emprunteur-table').innerHTML = `<table class="w-full text-sm border-collapse"><thead><tr class="bg-red-900 text-white"><th class="p-3 border">Date</th><th class="p-3 border">Date de fin</th><th class="p-3 border">Motif</th><th class="p-3 border text-right">Capital</th><th class="p-3 border text-right">Annuité</th><th class="p-3 border text-right">Restant Dû</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="bg-slate-100 font-bold"><td colspan="3" class="p-3 text-right">TOTAL :</td><td class="p-3 text-right font-mono">${fmtCurrency(totCap)}</td><td class="p-3 text-right font-mono">${fmtCurrency(totAnn)}</td><td class="p-3 text-right font-mono bg-red-100">${fmtCurrency(totCrd)}</td></tr></tfoot></table>`;
    showView('view-emprunteur-result');
}

async function generateTableauEffectifPersonnel() {
    const etabId = $('select-effpers-etab').value;
    const anneeRef = $('select-effpers-annee-ref').value;
    const yRef = parseInt(anneeRef.split('-')[0], 10);
    const periodes = Array.from({ length: 6 }, (_, i) => `${yRef - 5 + i}-${yRef - 4 + i}`);

    const [{ data: etab }, { data: recs }, { data: effEleves }] = await Promise.all([
        supabaseClient.from('T_ETABLISSEMENT').select('*').eq('ETAB_id', etabId).maybeSingle(),
        supabaseClient.from('T_EFFPERSONNEL').select('*').eq('EFF_id', etabId),
        supabaseClient.from('T_EFFECTIF').select('*').eq('EFFECTIF_etab', etabId)
    ]);

    $('lbl-effpers-ville').innerText = etab?.ETAB_ville || '';
    $('lbl-effpers-etab-nom').innerText = etab?.ETAB_nom || '';
    $('lbl-effpers-annee-ref').innerText = anneeRef;
    $('tr-effpers-headers').innerHTML = `<th class="p-3">Catégorie</th>` + periodes.map(p => `<th class="p-3 text-right">${p}</th>`).join('');

    const cats = [
        ['EFF_DIRTOT', 'EFF_DIRETP', 'Direction'], ['EFF_ENSSCTOT', 'EFF_ENSSCETP', 'Enseignants sous contrat'],
        ['EFF_ENSHCTOT', 'EFF_ENHSCETP', 'Enseignants hors contrat'], ['EFF_PVSTOT', 'EFF_PVSETP', 'Vie scolaire / ASEM'],
        ['EFF_GAITOT', 'EFF_GAIETP', 'Administration / Gestion'], ['EFF_ENTTOT', 'EFF_ENTETP', 'Entretien'],
        ['EFF_PASTOTOT', 'EFF_PASTOETP', 'Pastorale'], ['EFF_AUTTOT', 'EFF_AUTETP', 'Autres']
    ];

    exportStore.eff_personnel = [];
    const rowsHtml = cats.map(([kTot, kEtp, label]) => {
        const rowExp = { Categorie: label };
        const cells = periodes.map(p => {
            const r = (recs || []).find(x => String(x.EFF_exercice || x.EFF_ANNEE || '').trim() === p) || {};
            rowExp[p] = `${r[kTot] || 0} (${r[kEtp] || 0} ETP)`;
            return `<td class="p-2.5 text-right font-mono">${r[kTot] || '-'} <span class="text-xs text-slate-400">(${r[kEtp] || 0})</span></td>`;
        }).join('');
        exportStore.eff_personnel.push(rowExp);
        return `<tr><td class="p-2.5 font-medium">${label}</td>${cells}</tr>`;
    }).join('');

    const totPersExp = { Categorie: "TOTAL PERSONNEL (ETP)" }, totElevesExp = { Categorie: "TOTAL ELEVES" }, tauxEncExp = { Categorie: "Taux encadrement (Eleves / ETP)" };
    const totPersCells = [], totElevesCells = [], tauxEncCells = [];

    periodes.forEach(p => {
        const rPers = (recs || []).find(x => String(x.EFF_exercice || x.EFF_ANNEE || '').trim() === p) || {};
        const rEleves = (effEleves || []).find(x => String(x.EFFECTIF_anneescolaire || x.ANNEESCOLAIRE || '').trim() === p) || {};
        let sumPers = 0, sumEtp = 0;
        cats.forEach(([kTot, kEtp]) => { sumPers += Number(rPers[kTot]) || 0; sumEtp += Number(rPers[kEtp]) || 0; });
        const sumEleves = sumTotalEleves(rEleves);
        const ratio = (sumEtp > 0 && sumEleves > 0) ? (sumEleves / sumEtp).toFixed(2) : '-';

        totPersExp[p] = `${sumPers} (${sumEtp.toFixed(2)} ETP)`;
        totElevesExp[p] = sumEleves || '-';
        tauxEncExp[p] = ratio !== '-' ? `${ratio} eleves/ETP` : '-';

        totPersCells.push(`<td class="p-2.5 text-right font-mono">${sumPers || '-'} <span class="text-xs text-slate-500">(${sumEtp.toFixed(2)})</span></td>`);
        totElevesCells.push(`<td class="p-2.5 text-right font-mono">${sumEleves || '-'}</td>`);
        tauxEncCells.push(`<td class="p-2.5 text-right font-mono text-red-900">${ratio !== '-' ? ratio + ' el./ETP' : '-'}</td>`);
    });

    exportStore.eff_personnel.push(totPersExp, totElevesExp, tauxEncExp);
    $('tb-effpers-body').innerHTML = rowsHtml + `
        <tr class="bg-slate-100 font-bold border-t-2 border-slate-300"><td class="p-2.5">TOTAL PERSONNEL (dont ETP)</td>${totPersCells.join('')}</tr>
        <tr class="bg-slate-50 font-semibold"><td class="p-2.5">Effectif total élèves</td>${totElevesCells.join('')}</tr>
        <tr class="bg-red-50 font-bold text-red-900 border-t border-red-200"><td class="p-2.5">Taux d'encadrement (Élèves / ETP)</td>${tauxEncCells.join('')}</tr>`;
    showView('view-effectif-personnel-result');
}

async function generateSyntheseReseauFrance() {
    const [{ data: allEtabs, error: e1 }, { data: allEffs, error: e2 }, { data: allPers, error: e3 }, { data: allEcos, error: e4 }, { data: allAnnees }] = await Promise.all([
        supabaseClient.from('T_ETABLISSEMENT').select('ETAB_id, ETAB_nom, ETAB_ville, ETAB_pays'),
        supabaseClient.from('T_EFFECTIF').select('*'),
        supabaseClient.from('T_EFFPERSONNEL').select('*'),
        supabaseClient.from('T_ECO').select('*'),
        supabaseClient.from('T_ANNEESCOLAIRE').select('*')
    ]);

    if (e1 || e2 || e3 || e4) return alert("Erreur lors du chargement des données réseau : " + (e1?.message || e2?.message || e3?.message || e4?.message));

    const etabsFrance = (allEtabs || []).filter(isFranceEtab);
    const validEtabIds = new Set(etabsFrance.map(e => String(e.ETAB_id).trim()));
    $('lbl-reseau-nb-etabs').innerText = etabsFrance.length;

    const anneesSet = new Set((allAnnees || []).map(a => String(a.ANNEESCOLAIRE || a.annee || '').trim()).filter(Boolean));
    (allEffs || []).forEach(r => { const a = String(r.EFFECTIF_anneescolaire || r.ANNEESCOLAIRE || '').trim(); if (a) anneesSet.add(a); });
    (allPers || []).forEach(r => { const a = String(r.EFF_exercice || r.EFF_ANNEE || '').trim(); if (a) anneesSet.add(a); });
    (allEcos || []).forEach(r => { const a = String(r.ECO_EXERCICE || r.ECO_exercice || '').trim(); if (a) anneesSet.add(a); });

    const annees = [...anneesSet].sort((a, b) => a.localeCompare(b));
    const sum = (arr, fn) => arr.reduce((acc, item) => acc + (Number(fn(item)) || 0), 0);

    const statsByAnnee = annees.map(an => {
        const effRows = (allEffs || []).filter(r => validEtabIds.has(String(r.EFFECTIF_etab || r.EFFECTIF_id || '').trim()) && String(r.EFFECTIF_anneescolaire || r.ANNEESCOLAIRE || '').trim() === an);
        const persRows = (allPers || []).filter(r => validEtabIds.has(String(r.EFF_id || '').trim()) && String(r.EFF_exercice || r.EFF_ANNEE || '').trim() === an);
        const ecoRows = (allEcos || []).filter(r => validEtabIds.has(String(r.ECO_id || '').trim()) && String(r.ECO_EXERCICE || r.ECO_exercice || '').trim() === an);

        const ecole = sum(effRows, r => r.EFFECTIF_ecole);
        const college = sum(effRows, r => r.EFFECTIF_college);
        const lgt = sum(effRows, r => r['EFFECTIF_lyceegeneral et technologique'] || r.EFFECTIF_lycee_general);
        const lp = sum(effRows, r => r.EFFECTIF_lyceeprofessionnel);
        const bts = sum(effRows, r => r.EFFECTIF_btsprepa);
        const fcfa = sum(effRows, r => r.EFFECTIF_fcfa);

        const ensEff = sum(persRows, r => (Number(r.EFF_ENSSCTOT) || 0) + (Number(r.EFF_ENSHCTOT) || 0));
        const ensEtp = sum(persRows, r => (Number(r.EFF_ENSSCETP) || 0) + (Number(r.EFF_ENHSCETP) || 0));
        const ogecEff = sum(persRows, r => (Number(r.EFF_DIRTOT) || 0) + (Number(r.EFF_PVSTOT) || 0) + (Number(r.EFF_GAITOT) || 0) + (Number(r.EFF_ENTTOT) || 0) + (Number(r.EFF_PASTOTOT) || 0) + (Number(r.EFF_AUTTOT) || 0));
        const ogecEtp = sum(persRows, r => (Number(r.EFF_DIRETP) || 0) + (Number(r.EFF_PVSETP) || 0) + (Number(r.EFF_GAIETP) || 0) + (Number(r.EFF_ENTETP) || 0) + (Number(r.EFF_PASTOETP) || 0) + (Number(r.EFF_AUTETP) || 0));

        return {
            annee: an, ecole, college, lgt, lp, bts, fcfa,
            totEleves: ecole + college + lgt + lp + bts + fcfa,
            ensEff, ensEtp, ogecEff, ogecEtp,
            totPersEff: ensEff + ogecEff, totPersEtp: ensEtp + ogecEtp,
            cc: sum(ecoRows, r => r.ECO_CC), prod: sum(ecoRows, r => r.ECO_PROFONC),
            inv: sum(ecoRows, r => r.ECO_INVIMM), caf: sum(ecoRows, r => r.ECO_CAF),
            msal: sum(ecoRows, r => r.ECO_MSAL), fdr: sum(ecoRows, r => r.ECO_FDR),
            dette: sum(ecoRows, r => r.ECO_DETTE), fact: sum(ecoRows, r => r.ECO_FACTFAM),
            imp: sum(ecoRows, r => r.ECO_IMPFAM), repas: sum(ecoRows, r => r.ECO_NBREPAS)
        };
    });

    $('tr-reseau-headers').innerHTML = `<th class="p-3 min-w-[270px] sticky left-0 bg-red-900 z-10">Rubriques / Indicateurs consolidés</th>` +
        statsByAnnee.map(s => `<th class="p-3 text-right whitespace-nowrap">${escapeHTML(s.annee)}</th>`).join('');

    const fmtVal = (v, type) => {
        if (!v || Math.abs(v) < 0.0001) return '-';
        if (type === 'cur') return fmtCurrency(v);
        if (type === 'etp') return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return Math.round(v).toLocaleString('fr-FR');
    };

    const sections = [
        { title: '1. EFFECTIFS ÉLÈVES PAR UNITÉ PÉDAGOGIQUE', rows: [['École (Maternelle & Élémentaire)', 'ecole', 'int', false], ['Collège', 'college', 'int', false], ['Lycée Général et Technologique', 'lgt', 'int', false], ['Lycée Professionnel', 'lp', 'int', false], ['BTS & Classes Préparatoires', 'bts', 'int', false], ['Formation Continue / Apprentissage (FC/FA)', 'fcfa', 'int', false], ['TOTAL ÉLÈVES RÉSEAU FRANCE', 'totEleves', 'int', true]] },
        { title: '2. EFFECTIFS DU PERSONNEL (PERSONNEL ENSEIGNANT & PERSONNEL OGEC)', rows: [['Personnel Enseignant — Effectif physique', 'ensEff', 'int', false], ['Personnel Enseignant — Équivalent Temps Plein (ETP)', 'ensEtp', 'etp', false], ['Personnel OGEC (Dir., Vie scol., Admin., Ent., Pasto., Autres) — Effectif', 'ogecEff', 'int', false], ['Personnel OGEC — Équivalent Temps Plein (ETP)', 'ogecEtp', 'etp', false], ['TOTAL PERSONNEL — Effectif physique cumulé', 'totPersEff', 'int', true], ['TOTAL PERSONNEL — ETP cumulés', 'totPersEtp', 'etp', true]] },
        { title: '3. DONNÉES ÉCONOMIQUES ET FINANCIÈRES CUMULÉES', rows: [['Charges de fonctionnement courant', 'cc', 'cur', false], ['Produits de fonctionnement courant', 'prod', 'cur', false], ['Investissements immobiliers de l\'exercice', 'inv', 'cur', false], ['Capacité d\'Autofinancement (CAF)', 'caf', 'cur', true], ['Masse salariale globale', 'msal', 'cur', false], ['Fonds de Roulement (FDR)', 'fdr', 'cur', true], ['Capital restant dû des emprunts', 'dette', 'cur', false], ['Facturation aux familles', 'fact', 'cur', false], ['Montant des impayés familles', 'imp', 'cur', false], ['Nombre total de repas servis', 'repas', 'int', false]] }
    ];

    exportStore.synthese_reseau = [];
    let tbodyHtml = '';
    sections.forEach(sec => {
        tbodyHtml += `<tr class="bg-red-950 text-white font-bold text-xs uppercase tracking-wider"><td colspan="${statsByAnnee.length + 1}" class="p-2.5">${sec.title}</td></tr>`;
        sec.rows.forEach(([label, key, type, isBold]) => {
            const expRow = { Rubrique: label };
            statsByAnnee.forEach(s => { expRow[s.annee] = type === 'cur' ? Number((s[key] || 0).toFixed(2)) : type === 'etp' ? Number((s[key] || 0).toFixed(2)) : Math.round(s[key] || 0); });
            exportStore.synthese_reseau.push(expRow);
            tbodyHtml += `<tr class="${isBold ? 'bg-amber-50/80 font-bold text-slate-900 border-t border-slate-300' : 'hover:bg-slate-50'}"><td class="p-2.5 sticky left-0 ${isBold ? 'bg-amber-50' : 'bg-white'} border-r">${label}</td>${statsByAnnee.map(s => `<td class="p-2.5 text-right font-mono whitespace-nowrap">${fmtVal(s[key], type)}</td>`).join('')}</tr>`;
        });
    });

    $('tb-reseau-body').innerHTML = tbodyHtml;
    showView('view-synthese-reseau-result');
}

function exportDataToExcel(storeKey) {
    const data = exportStore[storeKey];
    if (!data?.length) return alert("Aucune donnée à exporter.");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Export");
    XLSX.writeFile(wb, `export_${storeKey}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
