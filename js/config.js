// =========================================================================
// 1. CONFIGURATION & ÉTAT GLOBAL
// =========================================================================
const SUPABASE_URL = 'https://ugrmpawukiyiutjufizb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVncm1wYXd1a2l5aXV0anVmaXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxODE1MDMsImV4cCI6MjEwMzc1NzUwM30.XhxxvEoEhYlvh-rekBXhAREUtYuljwES2fAyM7TwJvo';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const ENTITY_CONFIG = {
    personnes: { table: 'T_PERSONNES', pk: 'PERS_id', labelField: 'PERS_NOM', searchFields: ['PERS_NOM', 'PERS_Prenom'] },
    etablissements: { table: 'T_ETABLISSEMENT', pk: 'ETAB_id', labelField: 'ETAB_nom', searchFields: ['ETAB_nom', 'ETAB_ville'] },
    unites_pedagogiques: { table: 'T_UNITE_PEDAGOGIQUE', pk: 'UP_id', labelField: 'UP_NOM', searchFields: ['UP_NOM', 'UP_ville'] },
    ogec: { table: 'T_OGEC', pk: 'OGEC_id', labelField: 'OGEC_nom', searchFields: ['OGEC_nom', 'OGEC_ville'] },
    apel: { table: 'T_APEL', pk: 'APEL_id', labelField: 'APEL_nom', searchFields: ['APEL_nom', 'APEL_ville'] },
    dioceses: { table: 'T_DIOCESE', pk: 'DIO_id', labelField: 'DIO_NOM', searchFields: ['DIO_NOM'] }
};

const ENQUETES_CONFIG = {
    economique: { url: 'https://insiemecam.github.io/app_tutelle/enqueteeconomique.html', limite: '28 février', paramKey: 'ECO_id', titre: 'Enquête Données Économiques', objetLibelle: 'économique' },
    effectif_eleves: { url: 'https://insiemecam.github.io/app_tutelle/enqueteeffectifeleve', limite: '15 septembre', paramKey: 'EFFECTIF_etab', titre: 'Enquête Effectifs Élèves', objetLibelle: 'effectif élève' },
    effectif_personnel: { url: 'https://insiemecam.github.io/app_tutelle/enqueteeffectifpersonnel', limite: '15 septembre', paramKey: 'EFF_id', titre: 'Enquête Effectifs Personnel', objetLibelle: 'effectif personnel' }
};

const PERSON_SELECT_MAP = {
    "CHEF D'ETABLISSEMENT": ['UP_chefetablissement'],
    'ADJOINT': ['UP_adjoint'],
    'APS': ['UP_APS'],
    'SECRETAIRE': ['UP_secretaire'],
    'OGEC': ['OGEC_président', 'OGEC_vicepresident', 'OGEC_tresorier', 'OGEC_secretaire'],
    'APEL': ['APEL_president', 'APEL_vicepresident', 'APEL_tresorier', 'APEL_secretaire']
};

const appState = {
    role: '',
    userId: null,
    entity: 'personnes',
    mode: 'create',
    selectedId: null,
    allRecords: [],
    pendingMfaFactorId: null,
    campagneType: '',
    chefsCampagne: [],
    personnesCollectif: [],
    tarifsRecord: null,
    factures: [],
    cachePersonMap: null,
    cacheAnnees: null
};

const exportStore = {
    personnes: [], etablissements: [], ogec: [], apel: [], dioceses: [],
    synthese_eco: [], eff_personnel: [], effectifs_6ans: [], emprunteur: [],
    synthese_reseau: [], remunerations_ce: [], etat_triennaux: [],
    org_triennaux: [], etat_visites_tutelle: []
};

// =========================================================================
// 2. UTILITAIRES GÉNÉRIQUES (DOM, DATES, CALCULS, FICHIERS)
// =========================================================================
const $ = (id) => document.getElementById(id);

const showView = (viewId) => {
    document.querySelectorAll('.app-view').forEach(el => el.classList.add('hidden'));
    $(viewId)?.classList.remove('hidden');
};

const openSubMenu = (menu) => {
    const map = {
        'saisie-consultation': 'view-submenu-saisie',
        'editions': 'view-submenu-editions',
        'courriels-enquetes': 'view-courriels-enquetes',
        'carriere-ce': 'view-carriere',
        'parametres': 'view-parametres',
        'facturation': 'view-submenu-facturation',
        'visites-tutelle': 'view-vt-menu'
    };
    if (map[menu]) showView(map[menu]);
};

const toggleModal = (id, show) => $(id)?.classList.toggle('hidden', !show);

const toggleCheckboxes = (selector, checked, callback) => {
    document.querySelectorAll(selector).forEach(cb => cb.checked = checked);
    if (callback) callback();
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fmtCurrency = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v || 0);

const isFranceEtab = (e) => !((e.ETAB_ville || '') + ' ' + (e.ETAB_nom || '') + ' ' + (e.ETAB_pays || '')).toUpperCase().match(/MONS|BELGIQUE/);

const sumTotalEleves = (r) => !r ? 0 : (
    (Number(r.EFFECTIF_ecole) || 0) +
    (Number(r.EFFECTIF_college) || 0) +
    (Number(r['EFFECTIF_lyceegeneral et technologique'] || r.EFFECTIF_lycee_general) || 0) +
    (Number(r.EFFECTIF_lyceeprofessionnel) || 0) +
    (Number(r.EFFECTIF_btsprepa) || 0) +
    (Number(r.EFFECTIF_fcfa) || 0)
);

const shiftAnneeScolaire = (anneeStr, deltaYears) => {
    const m = String(anneeStr || '').match(/^(\d{4})\s*-\s*(\d{4})$/);
    if (m) return `${parseInt(m[1], 10) + deltaYears}-${parseInt(m[2], 10) + deltaYears}`;
    const y = parseInt(String(anneeStr || '').slice(0, 4), 10);
    return !isNaN(y) ? `${y + deltaYears}-${y + deltaYears + 1}` : '';
};

const getAnneeScolaireFromDate = (dateStr, offsetYears = 0) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const y = (d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1) + offsetYears;
    return `${y}-${y + 1}`;
};

const getAnneeScolaireCourante = () => getAnneeScolaireFromDate(new Date());

const formatDateFR = (dateStr) => {
    if (!dateStr) return '—';
    const parts = String(dateStr).split('T')[0].split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
};

const escapeHTML = (str) => str == null ? '' : String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve({ filename: file.name, content: reader.result.split(',')[1] });
    reader.onerror = reject;
});

async function getPersonMap(forceRefresh = false) {
    if (appState.cachePersonMap && !forceRefresh) return appState.cachePersonMap;
    const { data } = await supabaseClient.from('T_PERSONNES').select('PERS_id, PERS_Civilite, PERS_NOM, PERS_Prenom');
    appState.cachePersonMap = Object.fromEntries((data || []).map(p => [p.PERS_id, `${p.PERS_Civilite || ''} ${p.PERS_NOM} ${p.PERS_Prenom}`.trim()]));
    return appState.cachePersonMap;
}

function execRichCmd(editorId, cmd) {
    const ed = $(editorId);
    if (ed) { ed.focus(); document.execCommand(cmd, false, null); }
}
