// =========================================================================
// 8. FACTURATION & TARIFS (T_TARIFS)
// =========================================================================
async function openGestionTarifs() {
    showView('view-tarifs-form');
    await loadTarifsForAnnee();
}

async function loadTarifsForAnnee() {
    const annee = $('TARIF_anneescolaire').value;
    const { data } = await supabaseClient.from('T_TARIFS').select('*').eq('TARIF_anneescolaire', annee).maybeSingle();
    appState.tarifsRecord = data || null;
    ['TARIF_ADH100', 'TARIF_ADH-300', 'TARIF_ADH+300', 'TARIFS_CE', 'TARIF_ECOLEUUR', 'TARIF_COLLEGEUUR', 'TARIF_LYCEEUUR', 'TARIF_ECOLEUSAM', 'TARIF_COLLEGEUSAM', 'TARIF_LYCEEUSAM']
        .forEach(id => { const el = $(id); if (el) el.value = data?.[id] ?? 0; });
}

async function saveTarifs(event) {
    event.preventDefault();
    const annee = $('TARIF_anneescolaire').value;
    const payload = { TARIF_anneescolaire: annee };
    ['TARIF_ADH100', 'TARIF_ADH-300', 'TARIF_ADH+300', 'TARIFS_CE', 'TARIF_ECOLEUUR', 'TARIF_COLLEGEUUR', 'TARIF_LYCEEUUR', 'TARIF_ECOLEUSAM', 'TARIF_COLLEGEUSAM', 'TARIF_LYCEEUSAM']
        .forEach(id => { payload[id] = parseFloat($(id).value) || 0; });

    const res = appState.tarifsRecord
        ? await supabaseClient.from('T_TARIFS').update(payload).eq('TARIF_anneescolaire', annee)
        : await supabaseClient.from('T_TARIFS').insert([payload]);

    if (res.error) return alert("Erreur : " + res.error.message);
    alert("✅ Grille tarifaire enregistrée !");
    showView('view-submenu-facturation');
}

async function openEditionFactures() {
    showView('view-factures-runner');
    await calculerFacturesReseau();
}

async function calculerFacturesReseau() {
    const annee = $('select-facture-annee').value;
    const [{ data: tarif }, { data: etabs }, { data: ups }, { data: effs }, { data: ogecs }, { data: persons }] = await Promise.all([
        supabaseClient.from('T_TARIFS').select('*').eq('TARIF_anneescolaire', annee).maybeSingle(),
        supabaseClient.from('T_ETABLISSEMENT').select('*').order('ETAB_ville'),
        supabaseClient.from('T_UNITE_PEDAGOGIQUE').select('*'),
        supabaseClient.from('T_EFFECTIF').select('*').eq('EFFECTIF_anneescolaire', annee),
        supabaseClient.from('T_OGEC').select('*'),
        supabaseClient.from('T_PERSONNES').select('PERS_id, PERS_NOM, PERS_Prenom, PERS_courriel1')
    ]);

    if (!tarif) {
        $('tbody-factures-list').innerHTML = `<tr><td colspan="9" class="p-4 text-center text-red-700 font-bold">Aucune grille tarifaire enregistrée pour l'année ${annee}.</td></tr>`;
        appState.factures = [];
        updateFacturesCount();
        return;
    }

    const ogecMap = Object.fromEntries((ogecs || []).map(o => [o.OGEC_id, o]));
    const persMap = Object.fromEntries((persons || []).map(p => [p.PERS_id, p]));
    const etabsFr = (etabs || []).filter(isFranceEtab);

    appState.factures = etabsFr.map(e => {
        const eff = (effs || []).find(x => String(x.EFFECTIF_etab || '').trim() === String(e.ETAB_id).trim()) || {};
        const nbEcole = Number(eff.EFFECTIF_ecole) || 0;
        const nbCollege = Number(eff.EFFECTIF_college) || 0;
        const nbLycee = (Number(eff['EFFECTIF_lyceegeneral et technologique'] || eff.EFFECTIF_lycee_general) || 0) +
                        (Number(eff.EFFECTIF_lyceeprofessionnel) || 0) +
                        (Number(eff.EFFECTIF_btsprepa) || 0) +
                        (Number(eff.EFFECTIF_fcfa) || 0);
        const totEleves = nbEcole + nbCollege + nbLycee;

        const adhPM = totEleves < 100 ? (tarif.TARIF_ADH100 || 0) : totEleves < 300 ? (tarif['TARIF_ADH-300'] || 0) : (tarif['TARIF_ADH+300'] || 0);
        const eUps = (ups || []).filter(u => String(u.UP_etablissement || '').trim() === String(e.ETAB_id).trim());
        const distinctCEs = new Set(eUps.map(u => u.UP_chefetablissement).filter(Boolean));
        const adhCE = (distinctCEs.size || 1) * (tarif.TARIFS_CE || 0);

        const isUUR = (e.ETAB_facturation || '').toUpperCase() === 'UUR';
        const cotEcole = nbEcole * (isUUR ? (tarif.TARIF_ECOLEUUR || 0) : (tarif.TARIF_ECOLEUSAM || 0));
        const cotCollege = nbCollege * (isUUR ? (tarif.TARIF_COLLEGEUUR || 0) : (tarif.TARIF_COLLEGEUSAM || 0));
        const cotLycee = nbLycee * (isUUR ? (tarif.TARIF_LYCEEUUR || 0) : (tarif.TARIF_LYCEEUSAM || 0));
        const total = adhPM + adhCE + cotEcole + cotCollege + cotLycee;

        const ogec = ogecMap[e.ETAB_OGEC] || {};
        const pdt = persMap[ogec.OGEC_président] || {};
        const destEmail = pdt.PERS_courriel1 || e.ETAB_courriel || '';

        return {
            etab: e, ogec, annee, type: isUUR ? 'UUR' : 'USAM',
            nbEcole, nbCollege, nbLycee, totEleves,
            adhPM, adhCE, cotEcole, cotCollege, cotLycee, total, destEmail
        };
    });

    $('lbl-factures-total').innerText = appState.factures.length;
    $('tbody-factures-list').innerHTML = appState.factures.map((f, i) => `
        <tr class="hover:bg-slate-50">
            <td class="p-3 text-center"><input type="checkbox" checked data-idx="${i}" onchange="updateFacturesCount()" class="fact-checkbox w-4 h-4 text-red-900 rounded"></td>
            <td class="p-3"><strong>${escapeHTML(f.etab.ETAB_ville)}</strong> — ${escapeHTML(f.etab.ETAB_nom)}<br><span class="text-[11px] text-slate-400">${escapeHTML(f.destEmail || 'Sans email')}</span></td>
            <td class="p-3 font-semibold">${f.type}</td>
            <td class="p-3 text-right font-mono">${fmtCurrency(f.adhPM)}</td>
            <td class="p-3 text-right font-mono">${fmtCurrency(f.adhCE)}</td>
            <td class="p-3 text-right font-mono">${fmtCurrency(f.cotEcole)}</td>
            <td class="p-3 text-right font-mono">${fmtCurrency(f.cotCollege)}</td>
            <td class="p-3 text-right font-mono">${fmtCurrency(f.cotLycee)}</td>
            <td class="p-3 text-right font-mono font-bold text-red-900 bg-red-50/40">${fmtCurrency(f.total)}</td>
        </tr>`).join('');
    updateFacturesCount();
}

function updateFacturesCount() {
    $('lbl-factures-selected').innerText = document.querySelectorAll('.fact-checkbox:checked').length;
}

function getSelectedFactures() {
    return [...document.querySelectorAll('.fact-checkbox:checked')].map(cb => appState.factures[parseInt(cb.dataset.idx, 10)]);
}

function buildFactureHTML(f) {
    return `<div style="font-family:Arial,sans-serif;max-width:750px;margin:0 auto 40px auto;padding:24px;border:1px solid #cbd5e1;page-break-after:always;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #7f1d1d;padding-bottom:12px;">
            <div><h2 style="color:#7f1d1d;margin:0;">TUTELLE MÉRICIENNE (${f.type})</h2><p style="margin:4px 0 0;font-size:12px;color:#475569;">Appel à cotisation — Année scolaire ${escapeHTML(f.annee)}</p></div>
            <div style="text-align:right;font-size:12px;">Date : ${new Date().toLocaleDateString('fr-FR')}</div>
        </div>
        <div style="margin:20px 0;padding:12px;background:#f8fafc;border-radius:6px;font-size:13px;">
            <strong>Destinataire :</strong> ${escapeHTML(f.ogec.OGEC_nom || f.etab.ETAB_nom)}<br>
            ${escapeHTML(f.ogec.OGEC_adresse || f.etab.ETAB_adresse || '')}<br>
            ${escapeHTML(f.ogec.OGEC_codepostal || f.etab.ETAB_codepostal || '')} ${escapeHTML(f.ogec.OGEC_ville || f.etab.ETAB_ville || '')}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;">
            <thead><tr style="background:#7f1d1d;color:#fff;"><th style="padding:8px;text-align:left;">Désignation</th><th style="padding:8px;text-align:right;">Effectif</th><th style="padding:8px;text-align:right;">Montant</th></tr></thead>
            <tbody>
                <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">Adhésion Personne Morale</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${f.totEleves} élèves</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmtCurrency(f.adhPM)}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">Adhésion Chef(s) d'Établissement</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">—</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmtCurrency(f.adhCE)}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">Cotisation École</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${f.nbEcole}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmtCurrency(f.cotEcole)}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">Cotisation Collège</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${f.nbCollege}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmtCurrency(f.cotCollege)}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">Cotisation Lycée &amp; Post-Bac</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${f.nbLycee}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmtCurrency(f.cotLycee)}</td></tr>
            </tbody>
            <tfoot><tr style="background:#fef2f2;font-weight:bold;font-size:15px;"><td colspan="2" style="padding:10px;text-align:right;color:#7f1d1d;">TOTAL NET À PAYER :</td><td style="padding:10px;text-align:right;color:#7f1d1d;">${fmtCurrency(f.total)}</td></tr></tfoot>
        </table>
    </div>`;
}

function toutImprimerFactures() {
    const list = getSelectedFactures();
    if (!list.length) return alert("Veuillez sélectionner au moins une facture.");
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Factures Tutelle Méricienne</title></head><body>${list.map(buildFactureHTML).join('')}</body></html>`);
    win.document.close();
    win.print();
}

function imprimerRecapitulatifPDF() {
    const list = getSelectedFactures();
    if (!list.length) return alert("Veuillez sélectionner au moins une facture.");
    const totGlobal = list.reduce((s, f) => s + f.total, 0);
    const rows = list.map(f => `<tr><td style="padding:6px;border:1px solid #cbd5e1;">${escapeHTML(f.etab.ETAB_ville)} — ${escapeHTML(f.etab.ETAB_nom)}</td><td style="padding:6px;border:1px solid #cbd5e1;">${f.type}</td><td style="padding:6px;border:1px solid #cbd5e1;text-align:right;">${fmtCurrency(f.total)}</td></tr>`).join('');
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Récapitulatif Facturation</title></head><body style="font-family:Arial,sans-serif;padding:20px;"><h2 style="color:#7f1d1d;">Récapitulatif des Cotisations (${list[0].annee})</h2><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#7f1d1d;color:#fff;"><th style="padding:8px;text-align:left;">Établissement</th><th style="padding:8px;">Type</th><th style="padding:8px;text-align:right;">Total Net</th></tr></thead><tbody>${rows}</tbody><tfoot><tr style="font-weight:bold;background:#f1f5f9;"><td colspan="2" style="padding:8px;text-align:right;">TOTAL GÉNÉRAL :</td><td style="padding:8px;text-align:right;">${fmtCurrency(totGlobal)}</td></tr></tfoot></table></body></html>`);
    win.document.close();
    win.print();
}

function exporterRecapitulatifExcel() {
    const list = getSelectedFactures();
    if (!list.length) return alert("Veuillez sélectionner au moins une facture.");
    const rows = list.map(f => ({
        Ville: f.etab.ETAB_ville, Etablissement: f.etab.ETAB_nom, Type: f.type,
        Adhesion_PM: f.adhPM, Adhesion_CE: f.adhCE, Cotis_Ecole: f.cotEcole,
        Cotis_College: f.cotCollege, Cotis_Lycee: f.cotLycee, Total_Net: f.total
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Facturation");
    XLSX.writeFile(wb, `recap_facturation_${list[0].annee}.xlsx`);
}

async function envoyerFacturesSelectionneesResend() {
    const list = getSelectedFactures().filter(f => f.destEmail);
    if (!list.length) return alert("Aucune facture sélectionnée ne dispose d'une adresse courriel.");
    if (!confirm(`Envoyer ${list.length} appel(s) à cotisation par courriel via Resend ?`)) return;

    let okCount = 0;
    for (const f of list) {
        const html = buildFactureHTML(f);
        const { error } = await supabaseClient.functions.invoke('send-email', {
            body: { to: f.destEmail, subject: `Tutelle Méricienne — Appel à cotisation ${f.annee} (${f.etab.ETAB_nom})`, html }
        });
        if (!error) okCount++;
        await sleep(500);
    }
    alert(`✅ Envoi terminé : ${okCount} / ${list.length} facture(s) envoyée(s).`);
}
