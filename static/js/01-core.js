/* MRL — Giao diện Phòng Lab Công nghiệp (Carbon & Amber) */
const state = {
  activeWorkspace: null,
  activeTab: 'repairs',
  sidebarCollapsed: false,
  sidebarUserToggled: false,
  splitMode: null, // null | 'vertical' | 'horizontal'
  splitRatio: 50,
  activePane: 'primary', // 'primary' | 'secondary'
  editorTabs: [],
  pane2: { group: 'scratchpad', id: null, ws: 'plc', drillKey: null, browserOpen: false, browserQuery: '' },
  workspaceMemory: { mrl: null, plc: null, network: null, english: null },
  drillSessions: {},
  navHistory: [],
  navHistoryIndex: -1,
  _navRestoring: false,
  metadata: {},
  workspaceCategories: {},
  inlineChipEdit: null,
  catMgr: { open: false, scope: null, items: [], deletedWithCount: 0, fallbackKey: null },
  appLang: localStorage.getItem('mrl-app-lang') === 'en' ? 'en' : 'vi',
  enMode: localStorage.getItem('mrl-en-mode') !== '0',
  enGlossary: [],
  enVocabulary: [],
  englishVocab: [],
  englishQuizzes: [],
  englishCards: [],
  englishCombatDrills: [],
  englishStreak: null,
  srsCounts: null,
  hasGeminiKey: false,
  geminiModel: 'gemini-2.0-flash',
  selectedEnglishVocabId: null,
  enBankListCollapsed: false,
  enBankListPinned: false,
  enBankFilters: { category: 'ALL', status: 'ALL', q: '' },
  openQuiz: {
    showGenPanel: false,
    studyMode: 'flashcard', // 'flashcard' | 'mcq' | 'cloze' | 'dictation'
    srsFilter: 'due_now',   // 'due_now' | 'learning' | 'new' | 'mastered' | 'ALL'
    cardIdx: 0,
    cardFlipped: false,
    sourceMode: 'database',
    typeFilter: 'ALL',
    categoryFilter: 'ALL',
    deck: [],
    index: 0,
    answers: {},
    clozeInputs: {},
    dictationInputs: {},
    dictationGraded: {},
    stats: { correct: 0, wrong: 0 },
  },
  enCoach: {
    drillId: '',
    mode: 'speaking', // 'speaking' | 'translation' | 'interview' | 'reading'
    promptId: null,
    viPrompt: '',
    referenceEn: '',
    sourceRef: '',
    category: 'ALL',
    targetKeywords: [],
    customMode: false,
    userEn: '',
    recording: false,
    result: null,
    loading: false,
  },
  enReading: {
    data: null,
    loading: false,
    showVi: false,
    answers: {},
    activeWord: null,
  },
  enIngest: {
    drawerOpen: false,
    subTab: 'magic', // 'magic' | 'scan' | 'manual'
    loading: false,
    magicTerm: '',
    magicResult: null,
    scanData: null,
    selectedScanCards: {},
    selectedScanDrills: {},
    manualText: '',
    extractData: null,
    selectedExtractTerms: {},
  },
  bilingualSections: {},
  repairCases: [],
  knowledgeItems: [],
  plcNotes: [],
  networkNotes: [],
  scratchpads: {},
  reviewProgress: {},
  inlineSectionEdit: null,
  uniInlineEdit: null,
  repairInlineEdit: null,
  repairTagAdd: null,
  repairDraftSteps: {},
  repairDraftColdRows: {},
  repairDraftBlocks: {},
  tagsDictionary: { component_tags: [], fault_codes: [] },
  selectedRepairId: null,
  selectedKnowledgeId: null,
  selectedPlcId: null,
  selectedNetworkId: null,
  repairsListCollapsed: false,
  repairsListPinned: false,
  knowledgeListCollapsed: false,
  knowledgeListPinned: false,
  plcListCollapsed: false,
  plcListPinned: false,
  networkListCollapsed: false,
  networkListPinned: false,
  repairFilters: { category: 'ALL', status: 'ALL', q: '' },
  knowledgeFilters: { group: 'ALL', mode: 'ALL', category: 'ALL', status: 'ALL', q: '' },
  plcFilters: { category: 'ALL', status: 'ALL', q: '' },
  networkFilters: { protocol: 'ALL', status: 'ALL', q: '' },
  sopChecked: {},
  flashcard: {
    deck: [],
    index: 0,
    flipped: false,
    mode: 'deep',
    statusFilter: 'ACTIVE',
    typeFilter: 'ALL',
    focusItem: null,
    unsolidOnly: false,
    showDraftBox: true,
    drafts: {},
    evaluations: {},
    followUps: {},
    supplementSaved: {},
    editingDraftOnBack: false,
    autoAiGrade: localStorage.getItem('mrl-fc-auto-ai') === '1',
    quizAnswers: {},
    showHint: false,
    showContext: false,
  },
};
const codeBufferMap = {};
const sectionRawTextMap = {};

let PLC_CATEGORIES = [
  { key: 'ALL', label: 'TẤT CẢ' },
  { key: 'Khối hàm (FB/FC/OB)', label: 'KHỐI HÀM FB/FC/OB' },
  { key: 'Vùng nhớ (DB/UDT)', label: 'VÙNG NHỚ DB/UDT' },
  { key: 'Analog & PID', label: 'ANALOG & PID' },
  { key: 'Đấu nối & Bản vẽ', label: 'ĐẤU NỐI & BẢN VẼ' },
];

let NETWORK_PROTOCOLS = [
  { key: 'ALL', label: 'TẤT CẢ' },
  { key: 'Modbus RTU/TCP', label: 'MODBUS RTU/TCP' },
  { key: 'EtherCAT', label: 'ETHERCAT' },
  { key: 'CANbus / CANopen', label: 'CANBUS / CANOPEN' },
  { key: 'Profibus / Profinet', label: 'PROFIBUS / PROFINET' },
  { key: 'USS / RS485', label: 'USS / RS485' },
];

let REPAIR_CATEGORIES = [
  { key: 'ALL', label: 'TẤT CẢ' },
  { key: 'VFD', label: 'VFD' },
  { key: 'Circuit_Board', label: 'BO MẠCH' },
  { key: 'Screen', label: 'HMI / MÀN HÌNH' },
  { key: 'Servo', label: 'SERVO' },
  { key: 'PLC', label: 'PLC' },
  { key: 'Sensors', label: 'CẢM BIẾN' },
];
let CATEGORY_LABELS = Object.fromEntries(REPAIR_CATEGORIES.map((c) => [c.key, c.label]));

let KNOWLEDGE_GROUPS = [
  { key: 'ALL', label: 'TẤT CẢ' },
  { key: 'Knowledge', label: 'KIẾN THỨC ĐO & SỬA' },
  { key: 'Automation', label: 'TỰ ĐỘNG HÓA' },
  { key: 'Errors', label: 'MÃ LỖI NHANH' },
];
let GROUP_LABELS = Object.fromEntries(KNOWLEDGE_GROUPS.map((g) => [g.key, g.label]));

let ENGLISH_CATEGORIES = [
  { key: 'ALL', label: 'TẤT CẢ' },
  { key: 'Giao tiếp & Hội thoại', label: 'GIAO TIẾP & HỘI THOẠI' },
  { key: 'Lexical Chunks (Cụm từ nối)', label: 'LEXICAL CHUNKS' },
  { key: 'Biến tần & Phần cứng', label: 'BIẾN TẦN & PHẦN CỨNG' },
  { key: 'PLC & Tự động hóa', label: 'PLC & TỰ ĐỘNG HÓA' },
  { key: 'Mạng truyền thông', label: 'MẠNG TRUYỀN THÔNG' },
  { key: 'Giao tiếp Phỏng vấn', label: 'GIAO TIẾP PHỎNG VẤN' },
];

function _syncSelectOptions(selId, items) {
  const sel = document.getElementById(selId);
  if (!sel || !items.length) return;
  const prev = sel.value;
  sel.innerHTML = items.map((it) => `<option value="${escapeHtml(it.key)}">${escapeHtml(chipDisplayLabel(it))}</option>`).join('');
  if (items.some((it) => it.key === prev)) sel.value = prev;
  else sel.value = items[0].key;
}

function syncWorkspaceCategoriesFromState(wsCats) {
  const cats = wsCats || {};
  if (Array.isArray(cats.repair) && cats.repair.length) {
    REPAIR_CATEGORIES = [{ key: 'ALL', label: 'TẤT CẢ' }, ...cats.repair];
    CATEGORY_LABELS = Object.fromEntries(REPAIR_CATEGORIES.map((c) => [c.key, c.label]));
    _syncSelectOptions('rep-form-category', cats.repair);
  }
  if (Array.isArray(cats.knowledge) && cats.knowledge.length) {
    KNOWLEDGE_GROUPS = [{ key: 'ALL', label: 'TẤT CẢ' }, ...cats.knowledge];
    GROUP_LABELS = Object.fromEntries(KNOWLEDGE_GROUPS.map((g) => [g.key, g.label]));
    _syncSelectOptions('knw-form-group', cats.knowledge);
  }
  if (Array.isArray(cats.plc) && cats.plc.length) {
    PLC_CATEGORIES = [{ key: 'ALL', label: 'TẤT CẢ' }, ...cats.plc];
    _syncSelectOptions('plc-form-category', cats.plc);
  }
  if (Array.isArray(cats.network) && cats.network.length) {
    NETWORK_PROTOCOLS = [{ key: 'ALL', label: 'TẤT CẢ' }, ...cats.network];
    _syncSelectOptions('net-form-protocol', cats.network);
  }
  if (Array.isArray(cats.english) && cats.english.length) {
    ENGLISH_CATEGORIES = [{ key: 'ALL', label: 'TẤT CẢ' }, ...cats.english];
    _syncSelectOptions('ev-form-category', cats.english);
  }
}

const KNOWLEDGE_MODES = [
  { key: 'ALL', label: 'TẤT CẢ CHẾ ĐỘ' },
  { key: 'SOP', label: 'QUY TRÌNH ĐO / SOP' },
  { key: 'CONCEPT_WHY', label: 'NGUYÊN LÝ & TẠI SAO' },
];

const STATUS_META = {
  mastered: { label: 'ĐÃ LÀM CHỦ' },
  review: { label: 'CẦN XEM LẠI' },
  researching: { label: 'ĐANG NGHIÊN CỨU' },
  unclassified: { label: 'CHƯA PHÂN LOẠI' },
};
const STATUS_META_EN = {
  mastered: { label: 'MASTERED' },
  review: { label: 'NEEDS REVIEW' },
  researching: { label: 'RESEARCHING' },
  unclassified: { label: 'UNCLASSIFIED' },
};
const STATUS_ORDER = ['mastered', 'review', 'researching', 'unclassified'];

const CATEGORY_LABELS_EN = {
  ALL: 'ALL',
  VFD: 'VFD',
  Circuit_Board: 'CIRCUIT BOARD',
  Screen: 'HMI / SCREEN',
  Servo: 'SERVO',
  PLC: 'PLC',
  Sensors: 'SENSORS',
  Knowledge: 'MEASUREMENT & REPAIR',
  Automation: 'AUTOMATION',
  Errors: 'QUICK FAULT CODES',
  SOP: 'MEASUREMENT SOP',
  CONCEPT_WHY: 'CONCEPT & WHY',
  'Khối hàm (FB/FC/OB)': 'FUNCTION BLOCKS (FB/FC/OB)',
  'Vùng nhớ (DB/UDT)': 'MEMORY AREAS (DB/UDT)',
  'Analog & PID': 'ANALOG & PID',
  'Đấu nối & Bản vẽ': 'WIRING & SCHEMATICS',
  'Modbus RTU/TCP': 'MODBUS RTU/TCP',
  EtherCAT: 'ETHERCAT',
  'CANbus / CANopen': 'CANBUS / CANOPEN',
  'Profibus / Profinet': 'PROFIBUS / PROFINET',
  'USS / RS485': 'USS / RS485',
  'Mạch & Biến tần': 'CIRCUITS & VFD',
  'PLC & Mạng': 'PLC & NETWORK',
  'Cụm từ nối Lexical Chunks': 'LEXICAL CHUNKS',
  'Biến tần & Phần cứng': 'VFD & POWER HARDWARE',
  'PLC & Tự động hóa': 'PLC & AUTOMATION',
  'Mạng truyền thông': 'INDUSTRIAL NETWORKS',
  'Lexical Chunks (Cụm từ nối)': 'LEXICAL CHUNKS',
  'Giao tiếp & Hội thoại': 'DAILY & WORKPLACE SPEAKING',
  'GIAO TIẾP & HỘI THOẠI': 'DAILY & WORKPLACE SPEAKING',
  'Giao tiếp Phỏng vấn': 'INTERVIEW ENGLISH',
  'PHỎNG VẤN KỸ SƯ': 'INTERVIEW ENGLISH',
  'GIAO TIẾP PHỎNG VẤN': 'INTERVIEW ENGLISH',
};

window._MRL_CAT_EN_CACHE = window._MRL_CAT_EN_CACHE || (() => {
  try { return JSON.parse(localStorage.getItem('mrl-cat-en-cache') || '{}') || {}; } catch (e) { return {}; }
})();

function _saveDynamicCatEn(viRaw, enTxt) {
  const k = String(viRaw || '').trim();
  const v = String(enTxt || '').trim();
  if (!k || !v) return;
  window._MRL_CAT_EN_CACHE[k] = v;
  window._MRL_CAT_EN_CACHE[k.toLowerCase()] = v;
  try { localStorage.setItem('mrl-cat-en-cache', JSON.stringify(window._MRL_CAT_EN_CACHE)); } catch (e) { /* ignore */ }
}

function _lookupDynamicCategoryEn(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (CATEGORY_LABELS_EN[s]) return CATEGORY_LABELS_EN[s];
  if (CATEGORY_LABELS_EN[s.toLowerCase()]) return CATEGORY_LABELS_EN[s.toLowerCase()];
  const hit = (window._MRL_CAT_EN_CACHE && (window._MRL_CAT_EN_CACHE[s] || window._MRL_CAT_EN_CACHE[s.toLowerCase()]))
    || (window._clientViToEnCache && (window._clientViToEnCache.get(s) || window._clientViToEnCache.get(s.toLowerCase())));
  if (!hit) return '';
  return (s === s.toUpperCase() && /[A-ZÀ-Ỹ]/.test(s)) ? String(hit).toUpperCase() : String(hit);
}

function chipDisplayLabel(item) {
  if (!item) return '';
  if (state.appLang === 'en') {
    return CATEGORY_LABELS_EN[item.key]
      || CATEGORY_LABELS_EN[item.label]
      || _lookupDynamicCategoryEn(item.label)
      || _lookupDynamicCategoryEn(item.key)
      || item.label;
  }
  return item.label;
}

function statusLabelForLang(code) {
  const c = STATUS_META[code] ? code : 'unclassified';
  return state.appLang === 'en' ? STATUS_META_EN[c].label : STATUS_META[c].label;
}

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeRegExp(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function stripEmoji(s) {
  return String(s || '').replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F\u200D]/gu, '').trim();
}
function pad2(n) { return String(n).padStart(2, '0'); }
function categoryLabel(cat) {
  if (state.appLang === 'en') return CATEGORY_LABELS_EN[cat] || _lookupDynamicCategoryEn(cat) || CATEGORY_LABELS[cat] || String(cat || '').toUpperCase();
  return CATEGORY_LABELS[cat] || String(cat || '').toUpperCase();
}
function groupLabel(grp) {
  if (state.appLang === 'en') return CATEGORY_LABELS_EN[grp] || _lookupDynamicCategoryEn(grp) || GROUP_LABELS[grp] || String(grp || '').toUpperCase();
  return GROUP_LABELS[grp] || String(grp || '').toUpperCase();
}

function ledHtml(code) {
  const c = STATUS_META[code] ? code : 'unclassified';
  return `<span class="led-wrap lbl-${c}"><span class="led led-${c}"></span>${statusLabelForLang(c)}</span>`;
}
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 260); }, 3200);
}

function applyInlineMarkdownBold(html) {
  if (!html || !html.includes('**')) return html;
  return String(html).replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
}

function highlightTagsHtml(text, compTags = [], faultCodes = []) {
  const safe = escapeHtml(String(text || '').trim());
  if (!safe) return '';
  const finalize = (html) => (typeof decorateTechnicalTermsInHtml === 'function' ? decorateTechnicalTermsInHtml(html) : html);
  const tokenMap = new Map();
  (faultCodes || []).forEach((t) => { if (t) tokenMap.set(t.toUpperCase(), { raw: t, kind: 'fault' }); });
  (compTags || []).forEach((t) => { if (t && !tokenMap.has(t.toUpperCase())) tokenMap.set(t.toUpperCase(), { raw: t, kind: 'comp' }); });
  if (tokenMap.size === 0) return finalize(applyInlineMarkdownBold(safe));
  const sorted = Array.from(tokenMap.values()).sort((a, b) => b.raw.length - a.raw.length);
  const pattern = sorted.map((t) => escapeRegExp(escapeHtml(t.raw))).join('|');
  const regex = new RegExp(`(?<![A-Za-z0-9_])(${pattern})(?![A-Za-z0-9_])`, 'gi');
  const tagged = safe.replace(regex, (m) => {
    const meta = tokenMap.get(m.toUpperCase());
    if (!meta) return m;
    const canon = escapeHtml(meta.raw);
    return `<button type="button" class="itag itag-${meta.kind}" onclick="event.stopPropagation(); openCrossRefDrawer('${canon}')" title="Tra cứu liên kết chéo: ${canon}">${m}</button>`;
  });
  return finalize(applyInlineMarkdownBold(tagged));
}

function renderTagPills(compTags = [], faultCodes = [], limit = null) {
  const comps = limit ? compTags.slice(0, limit) : compTags;
  const faults = limit ? faultCodes.slice(0, limit) : faultCodes;
  const f = faults.map((x) => `<button type="button" class="tag tag-fault" onclick="event.stopPropagation(); openCrossRefDrawer('${escapeHtml(x)}')" title="Mã lỗi ${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('');
  const c = comps.map((x) => `<button type="button" class="tag tag-comp" onclick="event.stopPropagation(); openCrossRefDrawer('${escapeHtml(x)}')" title="Linh kiện ${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('');
  return f + c;
}

function renderStatusSwitcher(parentType, id, currentCode) {
  return `<div class="seg">${STATUS_ORDER.filter((c) => c !== 'unclassified').map((code) => `
    <button type="button" class="${code === currentCode ? 'on' : ''}" onclick="quickUpdateStatus('${parentType}', '${escapeHtml(id)}', '${code}')">
      <span class="led led-${code}"></span>${statusLabelForLang(code)}
    </button>`).join('')}</div>`;
}

function isSopCategory(category) { return /Kỹ thuật Đo|Kỹ thuật Sửa|Workflow kiểm tra nhanh/i.test(category || ''); }

function parseSopSteps(text) {
  if (!text) return [];
  const raw = text.trim();
  const parts = raw.split(/(?:^|\n)\s*(\d+)\s*[\.\)]\s*/);
  if (parts.length > 1) {
    const items = [];
    if (parts[0].trim()) items.push({ num: '--', text: parts[0].trim() });
    for (let i = 1; i < parts.length; i += 2) {
      const content = (parts[i + 1] || '').trim();
      if (content) items.push({ num: pad2(parts[i]), text: content });
    }
    return items;
  }
  return raw.split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => ({ num: pad2(i + 1), text: l }));
}

async function copyCodeBlock(btn, bufferKey) {
  const code = codeBufferMap[bufferKey] || '';
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(code);
    } else {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    const orig = btn.textContent;
    btn.textContent = 'Đã copy ✓';
    showToast('Đã sao chép vào Clipboard', 'success');
    setTimeout(() => { btn.textContent = orig; }, 1600);
  } catch (err) {
    showToast('Không thể sao chép tự động', 'error');
  }
}

function renderTagChipsPlain(tags = []) {
  if (!tags || !tags.length) return '';
  return tags.map((x) => `<button type="button" class="tag tag-comp" onclick="event.stopPropagation(); openCrossRefDrawer('${escapeHtml(x)}')">${escapeHtml(x)}</button>`).join('');
}

