// ---------------------------------------------------------------------------
// Khởi tạo dữ liệu
// ---------------------------------------------------------------------------
function applyBootstrapData(data, preserveSelection = true) {
  state.metadata = data.metadata || {};
  state.repairCases = data.repair_cases || [];
  state.knowledgeItems = data.knowledge_items || [];
  state.plcNotes = data.plc_notes || [];
  state.networkNotes = data.network_notes || [];
  state.scratchpads = data.scratchpads || state.scratchpads || {};
  state.reviewProgress = data.review_progress || {};
  state.tagsDictionary = data.tags_dictionary || { component_tags: [], fault_codes: [] };
  if (data.workspace_categories) {
    state.workspaceCategories = data.workspace_categories;
    syncWorkspaceCategoriesFromState(state.workspaceCategories);
  }
  if (Array.isArray(data.en_glossary)) state.enGlossary = data.en_glossary;
  if (Array.isArray(data.english_vocab)) state.englishVocab = data.english_vocab;
  if (Array.isArray(data.english_quizzes)) state.englishQuizzes = data.english_quizzes;
  if (Array.isArray(data.english_cards)) state.englishCards = data.english_cards;
  if (Array.isArray(data.english_combat_drills)) state.englishCombatDrills = data.english_combat_drills;
  if (data.english_streak) state.englishStreak = data.english_streak;
  if (data.srs_counts) state.srsCounts = data.srs_counts;
  if (typeof data.has_gemini_key === 'boolean') state.hasGeminiKey = data.has_gemini_key;
  if (data.gemini_model) state.geminiModel = data.gemini_model;
  if (Array.isArray(data.en_vocabulary)) state.enVocabulary = data.en_vocabulary;
  else if (state.englishVocab.length) state.enVocabulary = state.englishVocab;
  if (typeof syncEnUiState === 'function') syncEnUiState();
  if (typeof _syncAiKeyButtons === 'function') _syncAiKeyButtons();
  const cardSource = state.englishCards.length ? state.englishCards : state.englishVocab;
  if (!preserveSelection || !cardSource.some((v) => String(v.id) === String(state.selectedEnglishVocabId))) {
    state.selectedEnglishVocabId = cardSource.length ? cardSource[0].id : null;
  }
  if (state.enBankFilters.category !== 'ALL' && !ENGLISH_CATEGORIES.some((c) => c.key === state.enBankFilters.category)) {
    state.enBankFilters.category = 'ALL';
  }
  if (state.repairFilters.category !== 'ALL' && !REPAIR_CATEGORIES.some((c) => c.key === state.repairFilters.category)) {
    state.repairFilters.category = 'ALL';
  }
  if (state.knowledgeFilters.group !== 'ALL' && !KNOWLEDGE_GROUPS.some((g) => g.key === state.knowledgeFilters.group)) {
    state.knowledgeFilters.group = 'ALL';
  }
  if (state.plcFilters.category !== 'ALL' && !PLC_CATEGORIES.some((c) => c.key === state.plcFilters.category)) {
    state.plcFilters.category = 'ALL';
  }
  if (state.networkFilters.protocol !== 'ALL' && !NETWORK_PROTOCOLS.some((p) => p.key === state.networkFilters.protocol)) {
    state.networkFilters.protocol = 'ALL';
  }
  if (!preserveSelection || !state.repairCases.some((c) => c.id === state.selectedRepairId)) {
    state.selectedRepairId = state.repairCases.length ? state.repairCases[0].id : null;
  }
  if (!preserveSelection || !state.knowledgeItems.some((k) => k.id === state.selectedKnowledgeId)) {
    state.selectedKnowledgeId = state.knowledgeItems.length ? state.knowledgeItems[0].id : null;
  }
  if (!preserveSelection || !state.plcNotes.some((p) => p.id === state.selectedPlcId)) {
    state.selectedPlcId = state.plcNotes.length ? state.plcNotes[0].id : null;
  }
  if (!preserveSelection || !state.networkNotes.some((n) => n.id === state.selectedNetworkId)) {
    state.selectedNetworkId = state.networkNotes.length ? state.networkNotes[0].id : null;
  }
  renderHeaderStats();
  populateKnowledgeCategorySelect();
  syncFlashcardFilterOptions();
  renderAllViews();
  if (state.appLang === 'en' && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

async function fetchBootstrap(preserveSelection = true) {
  try {
    const res = await fetch('/api/bootstrap');
    if (!res.ok) throw new Error('Không thể tải dữ liệu từ server');
    const data = await res.json();
    applyBootstrapData(data, preserveSelection);
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Lỗi kết nối backend', 'error');
  }
}

const WORKSPACE_META = {
  mrl: {
    brand: 'MRL',
    sub: 'BẢO TRÌ & SỬA CHỮA',
    statsTitle: 'THỐNG KÊ PHÂN HỆ MRL',
    defaultTab: 'repairs',
    allowedTabs: ['repairs', 'knowledge', 'dictionary', 'flashcards', 'scratchpad'],
  },
  plc: {
    brand: 'PLC',
    sub: 'LẬP TRÌNH PLC',
    statsTitle: 'THỐNG KÊ PHÂN HỆ PLC',
    defaultTab: 'plc',
    allowedTabs: ['plc', 'flashcards', 'scratchpad'],
  },
  network: {
    brand: 'NET',
    sub: 'INDUSTRIAL NETWORK',
    statsTitle: 'THỐNG KÊ MẠNG TRUYỀN THÔNG',
    defaultTab: 'network',
    allowedTabs: ['network', 'flashcards', 'scratchpad'],
  },
  english: {
    brand: 'ENG',
    sub: 'OPENQUIZ AI v2',
    statsTitle: 'TIẾN ĐỘ TIẾNG ANH SRS',
    defaultTab: 'en-quiz',
    allowedTabs: ['en-quiz', 'en-coach', 'en-reading', 'en-vocab-bank', 'en-ingest', 'flashcards', 'scratchpad'],
  },
};

function _countStatus(arr) {
  const s = { total: arr.length, mastered: 0, review: 0, researching: 0, unclassified: 0 };
  arr.forEach((x) => {
    const code = STATUS_META[x.status_code] ? x.status_code : 'unclassified';
    s[code] += 1;
  });
  s.needReview = s.review + s.researching;
  return s;
}

function computeClientSrsCounts(cards) {
  const list = Array.isArray(cards) ? cards : [];
  const nowStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace('T', ' ');
  let due_now = 0, learning = 0, newCnt = 0, review = 0, mastered = 0;
  list.forEach((c) => {
    const st = String(c.srs_stage || 'new').toLowerCase();
    const nxt = String(c.next_review_at || '').trim();
    if (st === 'learning') learning += 1;
    else if (st === 'review') review += 1;
    else if (st === 'mastered') mastered += 1;
    else newCnt += 1;
    if ((st === 'learning' || st === 'review') && (!nxt || nxt <= nowStr)) due_now += 1;
  });
  return { total: list.length, due_now, learning, new: newCnt, review, mastered };
}

function renderStreakBadges() {
  const st = state.englishStreak || { current_streak: 0, longest_streak: 0, daily_goal: 15, today_done: 0, goal_reached: false };
  const days = Number(st.current_streak || 0);
  const done = Number(st.today_done || 0);
  const goal = Number(st.daily_goal || 15);
  const pct = Math.min(100, Math.round((done * 100) / Math.max(1, goal)));
  const reached = done >= goal;
  const isEn = state.appLang === 'en';

  const portalBadge = document.getElementById('portal-streak-badge');
  if (portalBadge) {
    portalBadge.classList.toggle('streak-goal-reached', reached);
    const dEl = portalBadge.querySelector('[data-streak-days]');
    const gEl = portalBadge.querySelector('[data-streak-goal]');
    const bEl = portalBadge.querySelector('[data-streak-bar]');
    if (dEl) dEl.textContent = isEn ? `${days}-day streak` : `${days} ngày liên tiếp`;
    if (gEl) gEl.textContent = isEn ? `Today: ${done}/${goal} cards` : `Hôm nay: ${done}/${goal} thẻ`;
    if (bEl) bEl.style.width = `${pct}%`;
  }

  const wsBadge = document.getElementById('workspace-streak-badge');
  if (wsBadge) {
    wsBadge.classList.toggle('streak-goal-reached', reached);
    const dEl = wsBadge.querySelector('[data-streak-days]');
    const gEl = wsBadge.querySelector('[data-streak-goal]');
    const bEl = wsBadge.querySelector('[data-streak-bar]');
    if (dEl) dEl.textContent = isEn ? `${days}d streak` : `${days} ngày`;
    if (gEl) gEl.textContent = `${done}/${goal}`;
    if (bEl) bEl.style.width = `${pct}%`;
  }
}

function computeWorkspaceStats() {
  const mrlItems = [...state.repairCases, ...state.knowledgeItems];
  const mrl = _countStatus(mrlItems);
  mrl.repairCount = state.repairCases.length;
  mrl.knowledgeCount = state.knowledgeItems.length;
  mrl.tagCount = (state.tagsDictionary.component_tags?.length || 0) + (state.tagsDictionary.fault_codes?.length || 0);

  const plc = _countStatus(state.plcNotes);
  plc.catCounts = {};
  state.plcNotes.forEach((p) => { plc.catCounts[p.category] = (plc.catCounts[p.category] || 0) + 1; });

  const network = _countStatus(state.networkNotes);
  network.protoCounts = {};
  state.networkNotes.forEach((n) => { network.protoCounts[n.protocol] = (network.protoCounts[n.protocol] || 0) + 1; });

  const cards = state.englishCards && state.englishCards.length ? state.englishCards : (state.englishVocab || []);
  const srs = state.englishCards && state.englishCards.length ? computeClientSrsCounts(state.englishCards) : (state.srsCounts || { total: cards.length, due_now: 0, learning: 0, new: cards.length, review: 0, mastered: 0 });
  const english = {
    total: cards.length,
    mastered: srs.mastered,
    review: srs.learning + srs.review,
    researching: srs.new,
    unclassified: 0,
    srs,
    vocabCount: cards.length,
    quizCount: (state.englishQuizzes || []).filter((q) => q.quiz_type !== 'translate').length,
    combatCount: (state.englishCombatDrills || []).length || (state.englishQuizzes || []).filter((q) => q.quiz_type === 'translate').length,
    catCounts: {},
  };
  cards.forEach((v) => {
    english.catCounts[v.category] = (english.catCounts[v.category] || 0) + 1;
  });

  return { mrl, plc, network, english, grandTotal: mrl.total + plc.total + network.total + english.vocabCount };
}

function renderPortalScreen() {
  document.title = 'NC38';
  const stats = computeWorkspaceStats();
  const isEn = state.appLang === 'en';

  const brandSubEl = document.getElementById('portal-brand-sub');
  if (brandSubEl) {
    delete brandSubEl.dataset.viTextOrig;
    brandSubEl.textContent = isEn ? `WORKBENCH · ${stats.grandTotal} ITEMS` : `WORKBENCH · ${stats.grandTotal} MỤC`;
  }
  const metaEl = document.getElementById('portal-global-meta');
  if (metaEl) {
    delete metaEl.dataset.viTextOrig;
    metaEl.textContent = isEn ? `${stats.grandTotal} ITEMS` : `${stats.grandTotal} MỤC`;
  }
  const grid = document.getElementById('portal-grid');
  if (!grid) return;

  const ledBar = (s) => `
    <div class="portal-led-bar">
      <span class="portal-led-item"><span class="led led-mastered"></span>${isEn ? 'Mastered' : 'Làm chủ'} <b>${s.mastered}</b></span>
      <span class="portal-led-item"><span class="led led-review"></span>${isEn ? 'Review' : 'Xem lại'} <b>${s.review}</b></span>
      <span class="portal-led-item"><span class="led led-researching"></span>${isEn ? 'Research' : 'Nghiên cứu'} <b>${s.researching}</b></span>
    </div>`;

  const plcFbCount = stats.plc.catCounts['Khối hàm (FB/FC/OB)'] ?? stats.plc.catCounts['KIẾN THỨC CẦN HIỂU'] ?? stats.plc.total ?? 0;
  const plcDbCount = stats.plc.catCounts['Vùng nhớ (DB/UDT)'] ?? stats.plc.catCounts['BÀI TẬP THỰC HÀNH'] ?? 0;
  const plcPidCount = stats.plc.catCounts['Analog & PID'] || 0;
  const plcWiringCount = stats.plc.catCounts['Đấu nối & Bản vẽ'] || 0;
  const plcPidFilter = PLC_CATEGORIES.some((c) => c.key === 'Analog & PID') ? 'Analog & PID' : 'ALL';
  const plcWiringFilter = PLC_CATEGORIES.some((c) => c.key === 'Đấu nối & Bản vẽ') ? 'Đấu nối & Bản vẽ' : 'ALL';

  const netModbusCount = stats.network.protoCounts['Modbus RTU/TCP'] || 0;
  const netEthercatCount = stats.network.protoCounts['EtherCAT'] || 0;
  const netCanCount = stats.network.protoCounts['CANbus / CANopen'] || 0;
  const netCfgCount = netModbusCount + netEthercatCount + netCanCount;

  const imgUnit = isEn ? 'imgs' : 'ảnh';

  grid.innerHTML = `
    <article class="portal-card ws-mrl">
      <div class="portal-card-head">
        <div class="portal-idx-row">
          <span class="portal-idx">01 // REPAIR</span>
          <span class="portal-badge">${stats.mrl.total} ${isEn ? 'records' : 'bản ghi'}</span>
        </div>
        <h2 class="portal-title">${isEn ? 'Master Repair Logbook' : 'Nhật ký Sửa chữa Phần cứng'}</h2>
        <p class="portal-desc">${isEn ? 'Repair logs for VFD, PCBA, HMI & Servo; SOP diagnostics and component/fault code dictionary.' : 'Nhật ký ca sửa chữa biến tần, bo mạch, HMI, Servo; Kiến thức đo kiểm SOP & Từ điển linh kiện / mã lỗi.'}</p>
      </div>
      <div class="portal-stats">
        <div class="portal-stat-row"><span>${isEn ? 'Equipment Repair Cases' : 'Ca sửa chữa thiết bị'}</span><b>${stats.mrl.repairCount}</b></div>
        <div class="portal-stat-row"><span>${isEn ? 'Knowledge & SOP' : 'Kiến thức & Quy trình SOP'}</span><b>${stats.mrl.knowledgeCount}</b></div>
        <div class="portal-stat-row"><span>${isEn ? 'Components & Fault Codes' : 'Linh kiện & Mã lỗi tra cứu'}</span><b>${stats.mrl.tagCount}</b></div>
        ${ledBar(stats.mrl)}
      </div>
      <div class="portal-links">
        <div class="portal-links-lbl">${isEn ? 'REPAIR MODULES' : 'NỘI DUNG BÊN TRONG REPAIR'}</div>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('mrl', 'repairs')">
          <span class="lk-left"><span class="lk-idx">01</span><span>${isEn ? 'Repair Case Log' : 'Nhật ký ca sửa chữa'}</span></span><span class="lk-cnt">${stats.mrl.repairCount}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('mrl', 'knowledge')">
          <span class="lk-left"><span class="lk-idx">02</span><span>${isEn ? 'Knowledge & SOP' : 'Kiến thức & SOP'}</span></span><span class="lk-cnt">${stats.mrl.knowledgeCount}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('mrl', 'dictionary')">
          <span class="lk-left"><span class="lk-idx">03</span><span>${isEn ? 'Components & Faults' : 'Linh kiện & mã lỗi'}</span></span><span class="lk-cnt">${stats.mrl.tagCount}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('mrl', 'flashcards')">
          <span class="lk-left"><span class="lk-idx">04</span><span>${isEn ? 'MRL Flashcard Drill' : 'Ôn tập Flashcard MRL'}</span></span><span class="lk-cnt">${stats.mrl.needReview}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('mrl', 'scratchpad')">
          <span class="lk-left"><span class="lk-idx">05</span><span>${isEn ? 'MRL Scratchpad' : 'Vở Nháp ghi chú (MRL)'}</span></span><span class="lk-cnt">${(state.scratchpads?.mrl?.images_json?.length || 0)} ${imgUnit}</span>
        </button>
      </div>
      <div class="portal-card-foot">
        <button type="button" class="btn btn-primary portal-enter-btn" onclick="enterWorkspace('mrl', 'repairs')">${isEn ? 'OPEN REPAIR →' : 'VÀO PHÂN HỆ REPAIR →'}</button>
        <button type="button" class="btn" onclick="openRepairModal()">${isEn ? '+ Repair' : '+ Ca sửa'}</button>
      </div>
    </article>

    <article class="portal-card ws-plc">
      <div class="portal-card-head">
        <div class="portal-idx-row">
          <span class="portal-idx">02 // PLC</span>
          <span class="portal-badge">${stats.plc.total} ${isEn ? 'lessons' : 'bài học'}</span>
        </div>
        <h2 class="portal-title">${isEn ? 'PLC & Automation Control' : 'Lập trình PLC & Tự động hóa'}</h2>
        <p class="portal-desc">${isEn ? 'PLC Programming & TIA Portal: FB/FC/OB blocks, DB/UDT memory, 4-20mA Analog & PID, Physical Wiring.' : 'Lập trình & Hệ thống PLC Siemens TIA Portal: khối hàm FB/FC/OB, vùng nhớ DB/UDT, Analog 4-20mA & PID, Đấu nối.'}</p>
      </div>
      <div class="portal-stats">
        <div class="portal-stat-row"><span>${isEn ? 'FB / FC / OB Blocks' : 'Khối hàm FB / FC / OB'}</span><b>${plcFbCount}</b></div>
        <div class="portal-stat-row"><span>${isEn ? 'DB / UDT Memory' : 'Vùng nhớ DB / UDT'}</span><b>${plcDbCount}</b></div>
        <div class="portal-stat-row"><span>${isEn ? 'Analog & PID Processing' : 'Xử lý Analog & PID'}</span><b>${plcPidCount}</b></div>
        ${ledBar(stats.plc)}
      </div>
      <div class="portal-links">
        <div class="portal-links-lbl">${isEn ? 'PLC MODULES' : 'NỘI DUNG BÊN TRONG PLC'}</div>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('plc', 'plc', { plcCategory: 'ALL' })">
          <span class="lk-left"><span class="lk-idx">01</span><span>${isEn ? 'PLC Lessons & Function Blocks' : 'Bài học & Khối hàm PLC'}</span></span><span class="lk-cnt">${stats.plc.total}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('plc', 'plc', { plcCategory: '${escapeHtml(plcPidFilter)}' })">
          <span class="lk-left"><span class="lk-idx">02</span><span>${isEn ? 'Analog Scaling & PID Control' : 'Xử lý Tín hiệu Analog & PID'}</span></span><span class="lk-cnt">${plcPidCount}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('plc', 'plc', { plcCategory: '${escapeHtml(plcWiringFilter)}' })">
          <span class="lk-left"><span class="lk-idx">03</span><span>${isEn ? 'Wiring & Electrical Schematics' : 'Đấu nối & Đọc Bản vẽ Điện'}</span></span><span class="lk-cnt">${plcWiringCount}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('plc', 'flashcards')">
          <span class="lk-left"><span class="lk-idx">04</span><span>${isEn ? 'PLC Flashcard Drill' : 'Ôn tập Flashcard PLC'}</span></span><span class="lk-cnt">${stats.plc.needReview}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('plc', 'scratchpad')">
          <span class="lk-left"><span class="lk-idx">05</span><span>${isEn ? 'PLC Scratchpad (Notes & Images)' : 'Vở Nháp PLC (Viết & Dán ảnh)'}</span></span><span class="lk-cnt">${(state.scratchpads?.plc?.images_json?.length || 0)} ${imgUnit}</span>
        </button>
      </div>
      <div class="portal-card-foot">
        <button type="button" class="btn btn-primary portal-enter-btn" onclick="enterWorkspace('plc', 'plc')">${isEn ? 'OPEN PLC →' : 'VÀO PHÂN HỆ PLC →'}</button>
        <button type="button" class="btn" onclick="openPlcModal()">${isEn ? '+ PLC Note' : '+ Bài PLC'}</button>
      </div>
    </article>

    <article class="portal-card ws-network">
      <div class="portal-card-head">
        <div class="portal-idx-row">
          <span class="portal-idx">03 // NETWORK</span>
          <span class="portal-badge">${stats.network.total} ${isEn ? 'configs' : 'cấu hình'}</span>
        </div>
        <h2 class="portal-title">${isEn ? 'Industrial Networks' : 'Mạng Truyền thông Công nghiệp'}</h2>
        <p class="portal-desc">${isEn ? 'Industrial Networks: Modbus RTU/TCP, EtherCAT, CANbus/CANopen, Profibus/Profinet, 120Ω wiring & Register maps.' : 'Mạng Truyền thông Công nghiệp: Modbus RTU/TCP, EtherCAT, CANbus/CANopen, Profibus/Profinet, đấu nối 120Ω & thanh ghi.'}</p>
      </div>
      <div class="portal-stats">
        <div class="portal-stat-row"><span>${isEn ? 'Modbus RTU / TCP Protocol' : 'Giao thức Modbus RTU / TCP'}</span><b>${netModbusCount}</b></div>
        <div class="portal-stat-row"><span>${isEn ? 'EtherCAT & Servo Network' : 'Mạng EtherCAT & Servo'}</span><b>${netEthercatCount}</b></div>
        <div class="portal-stat-row"><span>${isEn ? 'CANbus / CANopen Network' : 'Mạng CANbus / CANopen'}</span><b>${netCanCount}</b></div>
        ${ledBar(stats.network)}
      </div>
      <div class="portal-links">
        <div class="portal-links-lbl">${isEn ? 'NETWORK MODULES' : 'NỘI DUNG BÊN TRONG NETWORK'}</div>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('network', 'network', { netProtocol: 'ALL' })">
          <span class="lk-left"><span class="lk-idx">01</span><span>${isEn ? 'Protocols & Register Maps' : 'Giao thức & Bản đồ Thanh ghi'}</span></span><span class="lk-cnt">${stats.network.total}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('network', 'network', { netProtocol: 'Modbus RTU/TCP' })">
          <span class="lk-left"><span class="lk-idx">02</span><span>${isEn ? 'Modbus / EtherCAT / CAN Configs' : 'Cấu hình Modbus / EtherCAT / CAN'}</span></span><span class="lk-cnt">${netCfgCount}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('network', 'network', { netProtocol: 'EtherCAT' })">
          <span class="lk-left"><span class="lk-idx">03</span><span>${isEn ? 'Test Scripts & Diagnostics' : 'Script Test & Bắt lỗi Mạng'}</span></span><span class="lk-cnt">${stats.network.total}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('network', 'flashcards')">
          <span class="lk-left"><span class="lk-idx">04</span><span>${isEn ? 'Network Flashcard Drill' : 'Ôn tập Mạng truyền thông'}</span></span><span class="lk-cnt">${stats.network.needReview}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('network', 'scratchpad')">
          <span class="lk-left"><span class="lk-idx">05</span><span>${isEn ? 'Network Scratchpad' : 'Vở Nháp Mạng (Viết & Dán ảnh)'}</span></span><span class="lk-cnt">${(state.scratchpads?.network?.images_json?.length || 0)} ${imgUnit}</span>
        </button>
      </div>
      <div class="portal-card-foot">
        <button type="button" class="btn btn-primary portal-enter-btn" onclick="enterWorkspace('network', 'network')">${isEn ? 'OPEN NETWORK →' : 'VÀO PHÂN HỆ NETWORK →'}</button>
        <button type="button" class="btn" onclick="openNetworkModal()">${isEn ? '+ Network' : '+ Cấu hình'}</button>
      </div>
    </article>

    <article class="portal-card ws-english">
      <div class="portal-card-head">
        <div class="portal-idx-row">
          <span class="portal-idx">04 // ENGLISH</span>
          <span class="portal-badge">${stats.english.vocabCount} ${isEn ? 'SRS cards' : 'thẻ SRS'}</span>
        </div>
        <h2 class="portal-title">${isEn ? 'Technical English & Quiz' : 'Tiếng Anh Kỹ thuật & OpenQuiz'}</h2>
        <p class="portal-desc">${isEn ? 'Active output & instant correction: SM-2 Spaced Repetition, 1-on-1 Combat Translation & Speaking Drill, Contextual Manual Reading, and 1-Click AI Auto-Fill.' : 'Học từ nào nói từ đó - Sai đến đâu sửa đến đó: Lặp lại ngắt quãng SM-2, Thực chiến dịch câu & phản xạ phỏng vấn, Đọc hiểu Manual và Tự động điền từ bằng AI.'}</p>
      </div>
      <div class="portal-stats">
        <div class="portal-stat-row"><span>${isEn ? 'Cards Due Today' : 'Thẻ cần ôn hôm nay'}</span><b class="portal-due-val">${stats.english.srs.due_now}</b></div>
        <div class="portal-stat-row"><span>${isEn ? 'Vocab & Lexical Chunks' : 'Kho Từ vựng & Lexical Chunks'}</span><b>${stats.english.vocabCount}</b></div>
        <div class="portal-stat-row"><span>${isEn ? 'Combat Translation & Drills' : 'Bài tập Thực chiến Dịch & Nói'}</span><b>${stats.english.combatCount}</b></div>
        <div class="portal-led-bar">
          <span class="portal-led-item"><span class="led led-mastered"></span>${isEn ? 'Mastered' : 'Đã thuộc'} <b>${stats.english.mastered}</b></span>
          <span class="portal-led-item"><span class="led led-review"></span>${isEn ? 'Due' : 'Cần ôn'} <b>${stats.english.srs.due_now}</b></span>
          <span class="portal-led-item"><span class="led led-researching"></span>${isEn ? 'New' : 'Từ mới'} <b>${stats.english.srs.new}</b></span>
        </div>
      </div>
      <div class="portal-links">
        <div class="portal-links-lbl">${isEn ? 'ENGLISH HUB MODULES' : 'NỘI DUNG BÊN TRONG ENGLISH'}</div>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('english', 'en-quiz')">
          <span class="lk-left"><span class="lk-idx">01</span><span>${isEn ? 'Multi-Mode SRS Study' : 'Ôn tập SRS Đa chế độ'}</span></span><span class="lk-cnt">${stats.english.srs.due_now} ${isEn ? 'due' : 'thẻ'}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('english', 'en-coach', { coachMode: 'speaking' })">
          <span class="lk-left"><span class="lk-idx">02</span><span>${isEn ? 'Combat Translation & Speaking' : 'Thực chiến Dịch & Phản xạ Nói'}</span></span><span class="lk-cnt">${stats.english.combatCount}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('english', 'en-coach', { coachMode: 'reading' })">
          <span class="lk-left"><span class="lk-idx">03</span><span>${isEn ? 'AI Manual Reading & Quiz' : 'Đọc hiểu Manual & Tạo đề AI'}</span></span><span class="lk-cnt">AI</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('english', 'en-vocab-bank')">
          <span class="lk-left"><span class="lk-idx">04</span><span>${isEn ? 'Vocab Bank & Lexical Chunks' : 'Kho Từ vựng & Lexical Chunks'}</span></span><span class="lk-cnt">${stats.english.vocabCount}</span>
        </button>
        <button type="button" class="portal-link-btn" onclick="enterWorkspace('english', 'en-vocab-bank', { openIngest: 'magic' })">
          <span class="lk-left"><span class="lk-idx">05</span><span>${isEn ? '1-Click AI Fill & MRL Scanner' : 'Tự động Điền từ & Quét Kho MRL'}</span></span><span class="lk-cnt">${isEn ? '+Add' : '+Nạp'}</span>
        </button>
      </div>
      <div class="portal-card-foot">
        <button type="button" class="btn btn-indigo portal-enter-btn" onclick="enterWorkspace('english', 'en-quiz')">${isEn ? 'OPEN ENGLISH HUB →' : 'VÀO PHÂN HỆ ENGLISH →'}</button>
        <button type="button" class="btn" onclick="openEnVocabEditorModal()">${isEn ? '+ Add Card / Chunk' : '+ Thêm Từ / Chunk'}</button>
      </div>
    </article>`;
  renderStreakBadges();
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

function _getWorkspaceScrollEl(ws, tab) {
  if (tab === 'repairs') return document.getElementById('repair-detail');
  if (tab === 'knowledge') return document.getElementById('knowledge-detail');
  if (tab === 'plc') return document.getElementById('plc-detail');
  if (tab === 'network') return document.getElementById('network-detail');
  if (tab === 'flashcards') return document.querySelector('#view-flashcards .scroll-view');
  if (tab === 'dictionary') return document.getElementById('view-dictionary');
  if (tab === 'scratchpad') return document.querySelector('#view-scratchpad .scratchpad-wrap');
  if (tab === 'en-quiz') return document.getElementById('view-en-quiz');
  if (tab === 'en-coach') return document.getElementById('view-en-coach');
  if (tab === 'en-vocab-bank') return document.getElementById('en-bank-detail');
  return null;
}

function _getWorkspaceListEl(ws, tab) {
  if (tab === 'repairs') return document.getElementById('repair-list');
  if (tab === 'knowledge') return document.getElementById('knowledge-list');
  if (tab === 'plc') return document.getElementById('plc-list');
  if (tab === 'network') return document.getElementById('network-list');
  if (tab === 'en-vocab-bank') return document.getElementById('en-vocab-bank-list');
  return null;
}

function saveWorkspaceMemory(ws) {
  if (!ws || !WORKSPACE_META[ws]) return null;
  if (!state.workspaceMemory) state.workspaceMemory = {};
  if (typeof flushPendingDrillDraft === 'function') flushPendingDrillDraft();
  const prev = state.workspaceMemory[ws] || {};
  const isCurrent = state.activeWorkspace === ws;
  const curTab = isCurrent ? state.activeTab : (prev.activeTab || WORKSPACE_META[ws].defaultTab);
  const mem = {
    ...prev,
    activeTab: curTab,
    scrollTop: isCurrent ? (_getWorkspaceScrollEl(ws, curTab)?.scrollTop || 0) : (prev.scrollTop || 0),
    listScrollTop: isCurrent ? (_getWorkspaceListEl(ws, curTab)?.scrollTop || 0) : (prev.listScrollTop || 0),
  };

  if (ws === 'mrl') {
    mem.repairFilters = { ...state.repairFilters };
    mem.knowledgeFilters = { ...state.knowledgeFilters };
    mem.selectedRepairId = state.selectedRepairId;
    mem.selectedKnowledgeId = state.selectedKnowledgeId;
    mem.repairsListCollapsed = state.repairsListCollapsed;
    mem.knowledgeListCollapsed = state.knowledgeListCollapsed;
  } else if (ws === 'plc') {
    mem.plcFilters = { ...state.plcFilters };
    mem.selectedPlcId = state.selectedPlcId;
    mem.plcListCollapsed = state.plcListCollapsed;
  } else if (ws === 'network') {
    mem.networkFilters = { ...state.networkFilters };
    mem.selectedNetworkId = state.selectedNetworkId;
    mem.networkListCollapsed = state.networkListCollapsed;
  } else if (ws === 'english') {
    mem.enBankFilters = { ...state.enBankFilters };
    mem.selectedEnglishVocabId = state.selectedEnglishVocabId;
    mem.enBankListCollapsed = state.enBankListCollapsed;
    mem.enCoachMode = state.enCoach.mode;
    mem.enQuizState = {
      studyMode: state.openQuiz.studyMode,
      srsFilter: state.openQuiz.srsFilter,
      cardIdx: state.openQuiz.cardIdx,
      cardFlipped: state.openQuiz.cardFlipped,
      categoryFilter: state.openQuiz.categoryFilter,
      index: state.openQuiz.index,
    };
  }

  if (isCurrent && curTab === 'flashcards' && typeof saveCurrentDrillSession === 'function') {
    const snap = saveCurrentDrillSession();
    if (snap) {
      mem.lastDrillKey = snap.key;
      mem.drillSnapshot = snap;
    }
  }
  state.workspaceMemory[ws] = mem;
  return mem;
}

function _applyWorkspaceFilterDom(ws) {
  if (ws === 'mrl') {
    const rs = document.getElementById('repair-status-filter');
    if (rs) rs.value = state.repairFilters.status || 'ALL';
    const rq = document.getElementById('repair-search-input');
    if (rq) rq.value = state.repairFilters.q || '';
    document.getElementById('repair-search-clear')?.classList.toggle('hidden', !state.repairFilters.q);
    const kc = document.getElementById('knowledge-category-filter');
    if (kc) kc.value = state.knowledgeFilters.category || 'ALL';
    const ks = document.getElementById('knowledge-status-filter');
    if (ks) ks.value = state.knowledgeFilters.status || 'ALL';
    const kq = document.getElementById('knowledge-search-input');
    if (kq) kq.value = state.knowledgeFilters.q || '';
    document.getElementById('knowledge-search-clear')?.classList.toggle('hidden', !state.knowledgeFilters.q);
  } else if (ws === 'plc') {
    const ps = document.getElementById('plc-status-filter');
    if (ps) ps.value = state.plcFilters.status || 'ALL';
    const pq = document.getElementById('plc-search-input');
    if (pq) pq.value = state.plcFilters.q || '';
    document.getElementById('plc-search-clear')?.classList.toggle('hidden', !state.plcFilters.q);
  } else if (ws === 'network') {
    const ns = document.getElementById('network-status-filter');
    if (ns) ns.value = state.networkFilters.status || 'ALL';
    const nq = document.getElementById('network-search-input');
    if (nq) nq.value = state.networkFilters.q || '';
    document.getElementById('network-search-clear')?.classList.toggle('hidden', !state.networkFilters.q);
  } else if (ws === 'english') {
    const es = document.getElementById('en-bank-status-filter');
    if (es) es.value = state.enBankFilters.status || 'ALL';
    const eq = document.getElementById('en-bank-search-input');
    if (eq) eq.value = state.enBankFilters.q || '';
    document.getElementById('en-bank-search-clear')?.classList.toggle('hidden', !state.enBankFilters.q);
  }
}

function _restoreWorkspaceMemoryFields(ws, mem, opts = {}) {
  if (!mem) return;
  if (ws === 'mrl') {
    if (mem.repairFilters && !opts.skipFilters) state.repairFilters = { ...mem.repairFilters };
    if (mem.knowledgeFilters && !opts.skipFilters) state.knowledgeFilters = { ...mem.knowledgeFilters };
    if (opts.selectedId) {
      if (mem.activeTab === 'knowledge') state.selectedKnowledgeId = opts.selectedId;
      else state.selectedRepairId = opts.selectedId;
    } else {
      if (mem.selectedRepairId) state.selectedRepairId = mem.selectedRepairId;
      if (mem.selectedKnowledgeId) state.selectedKnowledgeId = mem.selectedKnowledgeId;
    }
    if (typeof mem.repairsListCollapsed === 'boolean') state.repairsListCollapsed = mem.repairsListCollapsed;
    if (typeof mem.knowledgeListCollapsed === 'boolean') state.knowledgeListCollapsed = mem.knowledgeListCollapsed;
  } else if (ws === 'plc') {
    if (mem.plcFilters && opts.plcCategory === undefined && !opts.skipFilters) state.plcFilters = { ...mem.plcFilters };
    if (opts.selectedId) state.selectedPlcId = opts.selectedId;
    else if (mem.selectedPlcId) state.selectedPlcId = mem.selectedPlcId;
    if (typeof mem.plcListCollapsed === 'boolean' && opts.plcCategory === undefined) state.plcListCollapsed = mem.plcListCollapsed;
  } else if (ws === 'network') {
    if (mem.networkFilters && opts.netProtocol === undefined && !opts.skipFilters) state.networkFilters = { ...mem.networkFilters };
    if (opts.selectedId) state.selectedNetworkId = opts.selectedId;
    else if (mem.selectedNetworkId) state.selectedNetworkId = mem.selectedNetworkId;
    if (typeof mem.networkListCollapsed === 'boolean' && opts.netProtocol === undefined) state.networkListCollapsed = mem.networkListCollapsed;
  } else if (ws === 'english') {
    if (mem.enBankFilters && opts.enCategory === undefined && !opts.skipFilters) state.enBankFilters = { ...mem.enBankFilters };
    if (opts.selectedId) state.selectedEnglishVocabId = opts.selectedId;
    else if (mem.selectedEnglishVocabId) state.selectedEnglishVocabId = mem.selectedEnglishVocabId;
    if (typeof mem.enBankListCollapsed === 'boolean' && opts.enCategory === undefined) state.enBankListCollapsed = mem.enBankListCollapsed;
    if (mem.enCoachMode && opts.coachMode === undefined) state.enCoach.mode = mem.enCoachMode;
    if (mem.enQuizState) {
      Object.assign(state.openQuiz, mem.enQuizState);
    }
  }
  _applyWorkspaceFilterDom(ws);
}

// ---------------------------------------------------------------------------
// IDE-style Navigation History (Lùi / Tiến Alt+← Alt+→ Mouse 4/5)
// ---------------------------------------------------------------------------
function _selectedItemIdFor(ws, section) {
  if (section === 'repairs') return state.selectedRepairId || null;
  if (section === 'knowledge') return state.selectedKnowledgeId || null;
  if (section === 'plc') return state.selectedPlcId || null;
  if (section === 'network') return state.selectedNetworkId || null;
  if (section === 'en-vocab-bank') return state.selectedEnglishVocabId || null;
  return null;
}

function captureNavSnapshot() {
  if (!state.activeWorkspace) return null;
  const ws = state.activeWorkspace;
  const section = state.activeTab;
  const p1 = typeof getPrimaryTargetMeta === 'function' ? getPrimaryTargetMeta() : null;
  const itemId = _selectedItemIdFor(ws, section);
  let drillState = null;
  if (section === 'flashcards' && typeof saveCurrentDrillSession === 'function') {
    drillState = saveCurrentDrillSession();
  }
  const label = p1 ? `${p1.badge}${p1.title ? ' · ' + p1.title : ''}` : section;
  return {
    workspace: ws,
    section,
    tabKey: p1?.key || `${section}:${ws}`,
    itemId,
    label,
    drillState: drillState ? { ...drillState } : null,
  };
}

function _sameNavContext(a, b) {
  if (!a || !b) return false;
  return (
    a.workspace === b.workspace &&
    a.section === b.section &&
    a.tabKey === b.tabKey &&
    String(a.itemId || '') === String(b.itemId || '')
  );
}

function updateCurrentNavHistorySnapshot() {
  if (!state.activeWorkspace || !Array.isArray(state.navHistory)) return;
  if (state.navHistoryIndex < 0 || state.navHistoryIndex >= state.navHistory.length) return;
  const cur = captureNavSnapshot();
  if (!cur) return;
  const existing = state.navHistory[state.navHistoryIndex];
  if (_sameNavContext(existing, cur)) {
    state.navHistory[state.navHistoryIndex] = cur;
  }
}

function updateNavHistoryButtons() {
  const hist = state.navHistory || [];
  const idx = typeof state.navHistoryIndex === 'number' ? state.navHistoryIndex : -1;
  const canBack = idx > 0;
  const canFwd = idx >= 0 && idx < hist.length - 1;
  const isEn = state.appLang === 'en';
  const prevSnap = canBack ? hist[idx - 1] : null;
  const nextSnap = canFwd ? hist[idx + 1] : null;
  const backTitle = canBack && prevSnap?.label
    ? (isEn ? `Back: ${prevSnap.label} (Alt + ←)` : `Quay lại: ${prevSnap.label} (Alt + ←)`)
    : (isEn ? 'Back (Alt + ←)' : 'Quay lại (Alt + ←)');
  const fwdTitle = canFwd && nextSnap?.label
    ? (isEn ? `Forward: ${nextSnap.label} (Alt + →)` : `Đi tiếp: ${nextSnap.label} (Alt + →)`)
    : (isEn ? 'Forward (Alt + →)' : 'Đi tiếp (Alt + →)');

  document.querySelectorAll('.nav-hist-back-btn').forEach((btn) => {
    btn.disabled = !canBack;
    btn.title = backTitle;
    btn.setAttribute('aria-label', backTitle);
  });
  document.querySelectorAll('.nav-hist-fwd-btn').forEach((btn) => {
    btn.disabled = !canFwd;
    btn.title = fwdTitle;
    btn.setAttribute('aria-label', fwdTitle);
  });
}

function pushNavHistory(opts = {}) {
  if (state._navRestoring || opts?.fromHistory || !state.activeWorkspace) return;
  if (!Array.isArray(state.navHistory)) state.navHistory = [];
  const snap = captureNavSnapshot();
  if (!snap) return;

  const idx = state.navHistoryIndex;
  const cur = idx >= 0 ? state.navHistory[idx] : null;
  if (_sameNavContext(cur, snap)) {
    state.navHistory[idx] = snap;
    updateNavHistoryButtons();
    return;
  }

  if (idx < state.navHistory.length - 1) {
    state.navHistory = state.navHistory.slice(0, idx + 1);
  }
  state.navHistory.push(snap);
  if (state.navHistory.length > 30) {
    state.navHistory.shift();
  }
  state.navHistoryIndex = state.navHistory.length - 1;
  updateNavHistoryButtons();
}

function _applyNavSnapshot(snap) {
  if (!snap) return;
  state._navRestoring = true;
  try {
    if (snap.section === 'flashcards') {
      enterWorkspace(snap.workspace, 'flashcards', {
        keepFocusItem: true,
        drillKey: snap.tabKey,
        drillSnapshot: snap.drillState || null,
        preserveDrillState: true,
        targetCardKey: snap.drillState?.cardKey || null,
        fromHistory: true,
      });
    } else {
      if (snap.section === 'repairs' && snap.itemId) {
        state.selectedRepairId = snap.itemId;
        if (typeof getFilteredRepairCases === 'function' && !getFilteredRepairCases().some((x) => x.id === snap.itemId)) {
          state.repairFilters = { category: 'ALL', status: 'ALL', q: '' };
          _applyWorkspaceFilterDom('mrl');
        }
      } else if (snap.section === 'knowledge' && snap.itemId) {
        state.selectedKnowledgeId = snap.itemId;
        if (typeof getFilteredKnowledgeItems === 'function' && !getFilteredKnowledgeItems().some((x) => x.id === snap.itemId)) {
          state.knowledgeFilters = { group: 'ALL', mode: 'ALL', category: 'ALL', status: 'ALL', q: '' };
          _applyWorkspaceFilterDom('mrl');
        }
      } else if (snap.section === 'plc' && snap.itemId) {
        state.selectedPlcId = snap.itemId;
        if (typeof getFilteredPlcNotes === 'function' && !getFilteredPlcNotes().some((x) => x.id === snap.itemId)) {
          state.plcFilters = { category: 'ALL', status: 'ALL', q: '' };
          _applyWorkspaceFilterDom('plc');
        }
      } else if (snap.section === 'network' && snap.itemId) {
        state.selectedNetworkId = snap.itemId;
        if (typeof getFilteredNetworkNotes === 'function' && !getFilteredNetworkNotes().some((x) => x.id === snap.itemId)) {
          state.networkFilters = { protocol: 'ALL', status: 'ALL', q: '' };
          _applyWorkspaceFilterDom('network');
        }
      } else if (snap.section === 'en-vocab-bank' && snap.itemId) {
        state.selectedEnglishVocabId = snap.itemId;
        if (typeof getFilteredEnVocab === 'function' && !getFilteredEnVocab().some((x) => String(x.id) === String(snap.itemId))) {
          state.enBankFilters = { category: 'ALL', status: 'ALL', q: '' };
          _applyWorkspaceFilterDom('english');
        }
      }
      enterWorkspace(snap.workspace, snap.section, {
        fromHistory: true,
        preserveSelectionOnHistory: true,
      });
    }
  } finally {
    state._navRestoring = false;
  }
  updateNavHistoryButtons();
}

function goNavBack() {
  const hist = state.navHistory || [];
  if (state.navHistoryIndex <= 0) return;
  if (typeof flushPendingDrillDraft === 'function') flushPendingDrillDraft();
  updateCurrentNavHistorySnapshot();
  if (state.activeWorkspace) saveWorkspaceMemory(state.activeWorkspace);
  state.navHistoryIndex -= 1;
  _applyNavSnapshot(hist[state.navHistoryIndex]);
}

function goNavForward() {
  const hist = state.navHistory || [];
  if (state.navHistoryIndex < 0 || state.navHistoryIndex >= hist.length - 1) return;
  if (typeof flushPendingDrillDraft === 'function') flushPendingDrillDraft();
  updateCurrentNavHistorySnapshot();
  if (state.activeWorkspace) saveWorkspaceMemory(state.activeWorkspace);
  state.navHistoryIndex += 1;
  _applyNavSnapshot(hist[state.navHistoryIndex]);
}

function openPortalScreen() {
  _flushInlineSectionOnLeave(false);
  if (state.activeWorkspace) saveWorkspaceMemory(state.activeWorkspace);
  state.activeWorkspace = null;
  document.body.classList.remove('ws-english');
  document.getElementById('portal-screen')?.classList.remove('hidden');
  document.getElementById('app-shell')?.classList.add('hidden');
  renderPortalScreen();
}

function enterWorkspace(ws, tabName = null, opts = {}) {
  const targetWs = WORKSPACE_META[ws] ? ws : 'mrl';
  const meta = WORKSPACE_META[targetWs];
  const prevWs = state.activeWorkspace;
  if (prevWs && !opts.skipSaveMemory) {
    saveWorkspaceMemory(prevWs);
  }

  state.activeWorkspace = targetWs;
  document.body.classList.toggle('ws-english', targetWs === 'english');
  if (targetWs === 'english' && state.splitMode && typeof closeSplitPane === 'function') {
    closeSplitPane();
  }

  const mem = state.workspaceMemory?.[targetWs] || null;
  let restoringFromMemory = false;
  let resolvedTab = null;

  if (opts.drillKey) {
    resolvedTab = 'flashcards';
  } else if (tabName && meta.allowedTabs.includes(tabName)) {
    resolvedTab = tabName;
  } else if (!opts.forceDefault && mem?.activeTab && meta.allowedTabs.includes(mem.activeTab)) {
    resolvedTab = mem.activeTab;
    restoringFromMemory = true;
  } else {
    resolvedTab = meta.defaultTab;
  }

  if (resolvedTab === 'en-reading') {
    state.enCoach.mode = 'reading';
    resolvedTab = 'en-coach';
  } else if (resolvedTab === 'en-ingest') {
    state.enIngest.drawerOpen = true;
    resolvedTab = 'en-vocab-bank';
  }

  if (restoringFromMemory) {
    _restoreWorkspaceMemoryFields(targetWs, mem, opts);
  }

  if (opts.plcCategory !== undefined) {
    state.plcFilters.category = opts.plcCategory;
    state.plcListCollapsed = false;
  }
  if (opts.netProtocol !== undefined) {
    state.networkFilters.protocol = opts.netProtocol;
    state.networkListCollapsed = false;
  }
  if (opts.enCategory !== undefined) {
    state.enBankFilters.category = opts.enCategory;
    state.enBankListCollapsed = false;
  }
  if (opts.coachMode !== undefined) {
    state.enCoach.mode = opts.coachMode;
  }
  if (opts.openIngest !== undefined) {
    state.enIngest.subTab = opts.openIngest || 'magic';
    state.enIngest.drawerOpen = true;
  }

  document.getElementById('portal-screen')?.classList.add('hidden');
  document.getElementById('app-shell')?.classList.remove('hidden');
  if (!state.sidebarUserToggled) state.sidebarCollapsed = window.innerWidth <= 960;
  applySidebarCollapsed();

  ['mrl', 'plc', 'network', 'english'].forEach((k) => {
    document.getElementById(`ws-pill-${k}`)?.classList.toggle('active', k === targetWs);
  });
  document.getElementById('sidebar-brand-name').textContent = meta.brand;
  document.getElementById('sidebar-brand-sub').textContent = meta.sub;
  document.getElementById('sidebar-stats-title').textContent = meta.statsTitle;

  const targetTab = resolvedTab;
  state.activeTab = targetTab;

  renderSidebarForWorkspace();
  syncFlashcardFilterOptions();

  let switchOpts = { _fromEnterWorkspace: true, fromHistory: opts.fromHistory };
  if (targetTab === 'flashcards') {
    if (opts.drillKey && typeof restoreDrillSession === 'function') {
      const rest = restoreDrillSession(opts.drillKey, opts.drillSnapshot || null);
      switchOpts.preserveDrillState = true;
      switchOpts.targetCardKey = opts.targetCardKey || rest?.cardKey || null;
    } else if (restoringFromMemory && mem && typeof restoreDrillSession === 'function') {
      const fallbackKey = typeof getDrillTabKey === 'function' ? getDrillTabKey(targetWs, mem.drillSnapshot?.focusItem || null) : `drill:${targetWs}:all`;
      const dKey = mem.lastDrillKey || mem.drillSnapshot?.key || fallbackKey;
      const rest = restoreDrillSession(dKey, mem.drillSnapshot || null);
      switchOpts.preserveDrillState = true;
      switchOpts.targetCardKey = mem.drillSnapshot?.cardKey || rest?.cardKey || null;
    } else {
      if (!opts.keepFocusItem && state.flashcard.focusItem) {
        const fKind = state.flashcard.focusItem.kind;
        const fWs = fKind === 'plc' ? 'plc' : (fKind === 'network' ? 'network' : 'mrl');
        if (fWs !== targetWs) state.flashcard.focusItem = null;
      }
      if (targetWs === 'english' && !['en_vocab', 'en_quiz'].includes(state.flashcard.mode)) {
        state.flashcard.mode = 'en_vocab';
      } else if (targetWs !== 'english' && ['en_vocab', 'en_quiz'].includes(state.flashcard.mode)) {
        state.flashcard.mode = 'deep';
      }
    }
  }

  renderHeaderStats();
  switchTab(targetTab, switchOpts);
  if (targetTab === 'repairs') renderRepairsView();
  else if (targetTab === 'knowledge') renderKnowledgeView();
  else if (targetTab === 'plc') renderPlcView();
  else if (targetTab === 'network') renderNetworkView();
  else if (targetTab === 'en-quiz' && typeof renderEnQuizView === 'function') renderEnQuizView();
  else if (targetTab === 'en-coach' && typeof renderEnCoachView === 'function') renderEnCoachView();
  else if (targetTab === 'en-reading' && typeof renderEnReadingView === 'function') renderEnReadingView();
  else if (targetTab === 'en-vocab-bank' && typeof renderEnVocabBankView === 'function') renderEnVocabBankView();
  else if (targetTab === 'en-ingest' && typeof renderEnIngestView === 'function') renderEnIngestView();

  if (restoringFromMemory && mem && (mem.scrollTop || mem.listScrollTop)) {
    const scTop = mem.scrollTop || 0;
    const lTop = mem.listScrollTop || 0;
    const restoreScrollFn = () => {
      const sEl = _getWorkspaceScrollEl(targetWs, targetTab);
      if (sEl && scTop) sEl.scrollTop = scTop;
      const lEl = _getWorkspaceListEl(targetWs, targetTab);
      if (lEl && lTop) lEl.scrollTop = lTop;
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restoreScrollFn);
    else restoreScrollFn();
  }

  if (!opts.fromHistory) pushNavHistory();
  else updateNavHistoryButtons();
}

function renderSidebarForWorkspace() {
  const ws = state.activeWorkspace || 'mrl';
  const stats = computeWorkspaceStats();
  const navEl = document.getElementById('sidebar-nav');
  const actEl = document.getElementById('sidebar-actions');
  if (!navEl || !actEl) return;

  if (ws === 'mrl') {
    navEl.innerHTML = `
      <button id="tab-btn-repairs" class="nav-item nav-tab-btn" onclick="switchTab('repairs')">
        <span class="nav-idx">01</span><span>Nhật ký ca sửa chữa</span><span class="nav-count">${stats.mrl.repairCount}</span>
      </button>
      <button id="tab-btn-knowledge" class="nav-item nav-tab-btn" onclick="switchTab('knowledge')">
        <span class="nav-idx">02</span><span>Kiến thức &amp; SOP</span><span class="nav-count">${stats.mrl.knowledgeCount}</span>
      </button>
      <button id="tab-btn-dictionary" class="nav-item nav-tab-btn" onclick="switchTab('dictionary')">
        <span class="nav-idx">03</span><span>Linh kiện &amp; mã lỗi</span><span class="nav-count">${stats.mrl.tagCount}</span>
      </button>
      <button id="tab-btn-flashcards" class="nav-item nav-tab-btn" onclick="switchTab('flashcards')">
        <span class="nav-idx">04</span><span>Ôn tập MRL</span><span class="nav-count">${stats.mrl.needReview}</span>
      </button>
      <button id="tab-btn-scratchpad" class="nav-item nav-tab-btn" onclick="switchTab('scratchpad')">
        <span class="nav-idx">05</span><span>Nháp</span><span class="nav-count">${(state.scratchpads?.mrl?.content?.trim() || state.scratchpads?.mrl?.images_json?.length) ? '●' : ''}</span>
      </button>`;
    actEl.innerHTML = `
      <button type="button" class="btn btn-primary btn-block" onclick="openRepairModal()">+ CA SỬA CHỮA</button>
      <button type="button" class="btn btn-block" onclick="openKnowledgeModal()">+ KIẾN THỨC / SOP</button>
      <div style="display:flex; gap:6px;">
        <button type="button" class="btn btn-sm" style="flex:1;" onclick="triggerExcelImport()">Nhập Excel</button>
        <button type="button" class="btn btn-sm" style="flex:1;" onclick="exportExcel()">Xuất Excel</button>
      </div>`;
  } else if (ws === 'plc') {
    const quickCats = PLC_CATEGORIES.filter((c) => c.key !== 'ALL').map((c) => {
      const cnt = stats.plc.catCounts[c.key] || 0;
      const on = state.activeTab === 'plc' && state.plcFilters.category === c.key;
      return `<button type="button" class="nav-item sub ${on ? 'active' : ''}" data-ctx-scope="plc" data-ctx-key="${escapeHtml(c.key)}" onclick="setPlcCategory('${escapeHtml(c.key)}')"><span>${escapeHtml(chipDisplayLabel(c))}</span><span class="nav-count">${cnt}</span></button>`;
    }).join('');
    navEl.innerHTML = `
      <button id="tab-btn-plc" class="nav-item nav-tab-btn" onclick="switchTab('plc')">
        <span class="nav-idx">01</span><span>Bài học &amp; Khối hàm PLC</span><span class="nav-count">${stats.plc.total}</span>
      </button>
      <button id="tab-btn-flashcards" class="nav-item nav-tab-btn" onclick="switchTab('flashcards')">
        <span class="nav-idx">02</span><span>Ôn tập PLC</span><span class="nav-count">${stats.plc.needReview}</span>
      </button>
      <button id="tab-btn-scratchpad" class="nav-item nav-tab-btn" onclick="switchTab('scratchpad')">
        <span class="nav-idx">03</span><span>Nháp</span><span class="nav-count">${(state.scratchpads?.plc?.content?.trim() || state.scratchpads?.plc?.images_json?.length) ? '●' : ''}</span>
      </button>
      <div class="nav-subhead">NHÓM CHỦ ĐỀ PLC</div>
      <button type="button" class="nav-item sub ${state.activeTab === 'plc' && state.plcFilters.category === 'ALL' ? 'active' : ''}" data-ctx-scope="plc" data-ctx-key="ALL" onclick="setPlcCategory('ALL')"><span>TẤT CẢ BÀI PLC</span><span class="nav-count">${stats.plc.total}</span></button>
      ${quickCats}`;
    actEl.innerHTML = `
      <button type="button" class="btn btn-primary btn-block" onclick="openPlcModal()">+ THÊM BÀI PLC MỚI</button>`;
  } else if (ws === 'network') {
    const quickProtos = NETWORK_PROTOCOLS.filter((p) => p.key !== 'ALL').map((p) => {
      const cnt = stats.network.protoCounts[p.key] || 0;
      const on = state.activeTab === 'network' && state.networkFilters.protocol === p.key;
      return `<button type="button" class="nav-item sub ${on ? 'active' : ''}" data-ctx-scope="network" data-ctx-key="${escapeHtml(p.key)}" onclick="setNetworkProtocol('${escapeHtml(p.key)}')"><span>${escapeHtml(chipDisplayLabel(p))}</span><span class="nav-count">${cnt}</span></button>`;
    }).join('');
    navEl.innerHTML = `
      <button id="tab-btn-network" class="nav-item nav-tab-btn" onclick="switchTab('network')">
        <span class="nav-idx">01</span><span>Giao thức &amp; Thanh ghi</span><span class="nav-count">${stats.network.total}</span>
      </button>
      <button id="tab-btn-flashcards" class="nav-item nav-tab-btn" onclick="switchTab('flashcards')">
        <span class="nav-idx">02</span><span>Ôn tập Mạng truyền thông</span><span class="nav-count">${stats.network.needReview}</span>
      </button>
      <button id="tab-btn-scratchpad" class="nav-item nav-tab-btn" onclick="switchTab('scratchpad')">
        <span class="nav-idx">03</span><span>Nháp</span><span class="nav-count">${(state.scratchpads?.network?.content?.trim() || state.scratchpads?.network?.images_json?.length) ? '●' : ''}</span>
      </button>
      <div class="nav-subhead">CHUẨN GIAO THỨC</div>
      <button type="button" class="nav-item sub ${state.activeTab === 'network' && state.networkFilters.protocol === 'ALL' ? 'active' : ''}" data-ctx-scope="network" data-ctx-key="ALL" onclick="setNetworkProtocol('ALL')"><span>TẤT CẢ GIAO THỨC</span><span class="nav-count">${stats.network.total}</span></button>
      ${quickProtos}`;
    actEl.innerHTML = `
      <button type="button" class="btn btn-primary btn-block" onclick="openNetworkModal()">+ THÊM CẤU HÌNH MẠNG</button>`;
  } else {
    navEl.innerHTML = `
      <button id="tab-btn-en-quiz" class="nav-item nav-tab-btn" onclick="switchTab('en-quiz')">
        <span class="nav-idx">01</span><span>Học hôm nay (SRS &amp; 4 Chế độ)</span><span class="nav-count">${stats.english.srs.due_now}</span>
      </button>
      <button id="tab-btn-en-coach" class="nav-item nav-tab-btn" onclick="switchTab('en-coach')">
        <span class="nav-idx">02</span><span>Phòng Thực Chiến (Nói, Dịch &amp; Đọc)</span><span class="nav-count">${stats.english.combatCount}</span>
      </button>
      <button id="tab-btn-en-vocab-bank" class="nav-item nav-tab-btn" onclick="switchTab('en-vocab-bank')">
        <span class="nav-idx">03</span><span>Kho Từ &amp; Nạp Từ AI (Magic Fill)</span><span class="nav-count">${stats.english.vocabCount}</span>
      </button>`;
    actEl.innerHTML = '';
    if (typeof _syncAiKeyButtons === 'function') _syncAiKeyButtons();
  }
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

function syncFlashcardFilterOptions() {
  const sel = document.getElementById('fc-type-filter');
  if (!sel) return;
  const ws = state.activeWorkspace || 'mrl';
  const prev = sel.value;
  if (ws === 'mrl') {
    const repOpts = REPAIR_CATEGORIES.filter((c) => c.key !== 'ALL')
      .map((c) => `<option value="repair_cat:${escapeHtml(c.key)}">Ca sửa: ${escapeHtml(chipDisplayLabel(c))}</option>`).join('');
    const knwOpts = KNOWLEDGE_GROUPS.filter((g) => g.key !== 'ALL')
      .map((g) => `<option value="knowledge_grp:${escapeHtml(g.key)}">Kiến thức: ${escapeHtml(chipDisplayLabel(g))}</option>`).join('');
    sel.innerHTML = `
      <option value="ALL">TẤT CẢ THẺ MRL (CA SỬA + SOP)</option>
      <option value="repair">CHỈ CA SỬA CHỮA</option>
      <option value="knowledge">CHỈ KIẾN THỨC &amp; SOP</option>
      ${repOpts ? `<optgroup label="Nhóm thiết bị (Ca sửa chữa)">${repOpts}</optgroup>` : ''}
      ${knwOpts ? `<optgroup label="Nhóm nguồn (Kiến thức &amp; SOP)">${knwOpts}</optgroup>` : ''}`;
  } else if (ws === 'plc') {
    sel.innerHTML = `<option value="ALL">TẤT CẢ BÀI LẬP TRÌNH PLC</option>` +
      PLC_CATEGORIES.filter((c) => c.key !== 'ALL').map((c) => `<option value="${escapeHtml(c.key)}">${escapeHtml(chipDisplayLabel(c))}</option>`).join('');
  } else if (ws === 'network') {
    sel.innerHTML = `<option value="ALL">TẤT CẢ CẤU HÌNH MẠNG</option>` +
      NETWORK_PROTOCOLS.filter((p) => p.key !== 'ALL').map((p) => `<option value="${escapeHtml(p.key)}">${escapeHtml(chipDisplayLabel(p))}</option>`).join('');
  } else {
    sel.innerHTML = `<option value="ALL">TẤT CẢ TỪ VỰNG &amp; CHUNKS</option>` +
      ENGLISH_CATEGORIES.filter((c) => c.key !== 'ALL').map((c) => `<option value="${escapeHtml(c.key)}">${escapeHtml(chipDisplayLabel(c))}</option>`).join('');
  }
  if (Array.from(sel.options).some((o) => o.value === prev)) sel.value = prev;
  else sel.value = 'ALL';
}

function renderHeaderStats() {
  document.title = 'NC38';
  const stats = computeWorkspaceStats();
  const ws = state.activeWorkspace;
  if (!ws) {
    renderPortalScreen();
    return;
  }

  let rowsHtml = '';
  let s = stats.mrl;
  if (ws === 'mrl') {
    s = stats.mrl;
    rowsHtml = `
      <div class="stat-row"><span>Tổng bản ghi MRL</span><b>${s.total}</b></div>
      <div class="stat-row"><span>Ca sửa chữa</span><b>${s.repairCount}</b></div>
      <div class="stat-row"><span>Kiến thức &amp; SOP</span><b>${s.knowledgeCount}</b></div>
      <div class="stat-row"><span>Linh kiện &amp; mã lỗi</span><b>${s.tagCount}</b></div>`;
  } else if (ws === 'plc') {
    s = stats.plc;
    rowsHtml = `<div class="stat-row"><span>Tổng bài PLC</span><b>${s.total}</b></div>` +
      PLC_CATEGORIES.filter((c) => c.key !== 'ALL').map((c) => `<div class="stat-row"><span>${escapeHtml(chipDisplayLabel(c))}</span><b>${s.catCounts[c.key] || 0}</b></div>`).join('');
  } else if (ws === 'network') {
    s = stats.network;
    rowsHtml = `<div class="stat-row"><span>Tổng cấu hình mạng</span><b>${s.total}</b></div>` +
      NETWORK_PROTOCOLS.filter((p) => p.key !== 'ALL').map((p) => `<div class="stat-row"><span>${escapeHtml(chipDisplayLabel(p))}</span><b>${s.protoCounts[p.key] || 0}</b></div>`).join('');
  } else {
    s = stats.english;
    rowsHtml = `
      <div class="stat-row"><span>Cần ôn hôm nay</span><b style="color:#F59E0B;">${s.srs.due_now}</b></div>
      <div class="stat-row"><span>Đang học / Từ mới</span><b>${s.srs.learning} / ${s.srs.new}</b></div>
      <div class="stat-row"><span>Tình huống thực chiến</span><b>${s.combatCount}</b></div>`;
  }

  document.getElementById('header-metrics').innerHTML = `
    ${rowsHtml}
    <div class="stat-row" style="margin-top:5px;"><span class="stat-led"><span class="led led-mastered"></span>Đã làm chủ</span><b>${s.mastered}</b></div>
    <div class="stat-row"><span class="stat-led"><span class="led led-review"></span>Cần xem lại</span><b>${s.review}</b></div>
    <div class="stat-row"><span class="stat-led"><span class="led led-researching"></span>Đang nghiên cứu</span><b>${s.researching}</b></div>`;

  renderStreakBadges();
  renderSidebarForWorkspace();
  renderPortalScreen();
}

function applyTabVisibility() {
  document.querySelectorAll('.tab-view').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`view-${state.activeTab}`)?.classList.remove('hidden');
  document.querySelectorAll('.nav-tab-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById(`tab-btn-${state.activeTab}`)?.classList.add('active');
}
function switchTab(tabName, opts = {}) {
  _flushInlineSectionOnLeave(false);
  if (state.activeWorkspace && !opts._fromEnterWorkspace) {
    saveWorkspaceMemory(state.activeWorkspace);
  }
  if (tabName === 'en-reading') {
    state.enCoach.mode = 'reading';
    tabName = 'en-coach';
  } else if (tabName === 'en-ingest') {
    state.enIngest.drawerOpen = true;
    tabName = 'en-vocab-bank';
  }
  const ws = state.activeWorkspace || 'mrl';
  state.activeTab = tabName;
  if (state.activeWorkspace) renderSidebarForWorkspace();
  applyTabVisibility();
  if (tabName === 'flashcards') {
    let preserveView = Boolean(opts.preserveDrillState);
    let targetCardKey = opts.targetCardKey || null;
    syncFlashcardFilterOptions();
    if (!opts._fromEnterWorkspace && !opts.preserveDrillState && typeof restoreDrillSession === 'function') {
      const mem = state.workspaceMemory?.[ws];
      const preferredKey = (mem?.lastDrillKey && state.drillSessions?.[mem.lastDrillKey])
        ? mem.lastDrillKey
        : `drill:${ws}:all`;
      if (state.drillSessions?.[preferredKey]) {
        const rest = restoreDrillSession(preferredKey);
        preserveView = true;
        targetCardKey = rest?.cardKey || null;
      } else {
        state.flashcard.focusItem = null;
        if (ws === 'english' && !['en_vocab', 'en_quiz'].includes(state.flashcard.mode)) {
          state.flashcard.mode = 'en_vocab';
        } else if (ws !== 'english' && ['en_vocab', 'en_quiz'].includes(state.flashcard.mode)) {
          state.flashcard.mode = 'deep';
        }
      }
    } else if (ws === 'english' && !['en_vocab', 'en_quiz'].includes(state.flashcard.mode)) {
      state.flashcard.mode = 'en_vocab';
    }
    buildFlashcardDeck(preserveView, { preserveViewState: preserveView, targetCardKey });
  } else if (tabName === 'dictionary') {
    renderDictionaryView();
  } else if (tabName === 'scratchpad') {
    renderScratchpadView();
  } else if (tabName === 'en-quiz' && typeof renderEnQuizView === 'function') {
    renderEnQuizView();
  } else if (tabName === 'en-coach' && typeof renderEnCoachView === 'function') {
    renderEnCoachView();
  } else if (tabName === 'en-vocab-bank' && typeof renderEnVocabBankView === 'function') {
    renderEnVocabBankView();
  }
  syncPrimaryEditorTab();
  if (!opts.fromHistory && !opts._fromEnterWorkspace) {
    pushNavHistory();
  }
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}
function renderAllViews() {
  renderRepairsView();
  renderKnowledgeView();
  renderPlcView();
  renderNetworkView();
  renderDictionaryView();
  if (typeof renderEnQuizView === 'function') renderEnQuizView();
  if (typeof renderEnCoachView === 'function') renderEnCoachView();
  if (typeof renderEnVocabBankView === 'function') renderEnVocabBankView();
  buildFlashcardDeck(true);
  if (state.activeTab === 'scratchpad') renderScratchpadView();
  applyTabVisibility();
  syncPrimaryEditorTab();
  if (state.splitMode) renderPane2();
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

function chipsHtml(items, activeKey, counts, handler, scope = null) {
  const html = items.map((it) => {
    if (scope && it.key !== 'ALL' && state.inlineChipEdit && state.inlineChipEdit.scope === scope && state.inlineChipEdit.key === it.key) {
      return `
        <span class="chip-editing" onclick="event.stopPropagation()">
          <input id="chip-inline-inp" class="chip-inline-inp" type="text" value="${escapeHtml(state.inlineChipEdit.draft)}"
                 oninput="state.inlineChipEdit.draft = this.value" onkeydown="onChipInlineKeydown(event)" />
          <button type="button" class="chip-inline-btn ok" onclick="saveChipInlineEdit()" title="Lưu (Enter)">✓</button>
          <button type="button" class="chip-inline-btn del" onclick="deleteCategoryChip('${scope}', '${escapeHtml(it.key)}')" title="Xóa mục này">🗑</button>
          <button type="button" class="chip-inline-btn" onclick="cancelChipInlineEdit()" title="Hủy (Esc)">×</button>
        </span>`;
    }
    const ctxAttr = scope ? `data-ctx-scope="${scope}" data-ctx-key="${escapeHtml(it.key)}"` : '';
    const dbl = (scope && it.key !== 'ALL')
      ? `ondblclick="event.stopPropagation(); startChipInlineEdit('${scope}', '${escapeHtml(it.key)}')" title="Click để lọc · Chuột phải mở menu nhanh · Nhấp đúp sửa tại chỗ"`
      : (scope ? `title="Click để lọc · Chuột phải mở menu thao tác nhanh"` : '');
    return `<button type="button" class="chip ${activeKey === it.key ? 'active' : ''}" ${ctxAttr} onclick="${handler}('${escapeHtml(it.key)}')" ${dbl}>${escapeHtml(chipDisplayLabel(it))}${counts ? `<span class="n">${counts[it.key] || 0}</span>` : ''}</button>`;
  }).join('');

  if (!scope) return html;

  if (state.inlineChipEdit && state.inlineChipEdit.scope === scope && state.inlineChipEdit.key === '__NEW__') {
    return html + `
      <span class="chip-editing" onclick="event.stopPropagation()">
        <input id="chip-inline-inp" class="chip-inline-inp" type="text" placeholder="Tên mục mới..." value="${escapeHtml(state.inlineChipEdit.draft)}"
               oninput="state.inlineChipEdit.draft = this.value" onkeydown="onChipInlineKeydown(event)" />
        <button type="button" class="chip-inline-btn ok" onclick="saveChipInlineEdit()" title="Thêm mục (Enter)">✓</button>
        <button type="button" class="chip-inline-btn" onclick="cancelChipInlineEdit()" title="Hủy (Esc)">×</button>
      </span>`;
  }

  return html + `
    <button type="button" class="chip chip-act" onclick="startChipInlineAdd('${scope}')" title="Thêm nhanh mục mới vào thanh này">+</button>
    <button type="button" class="chip chip-act" onclick="openCategoryManagerModal('${scope}')" title="Quản lý danh mục: Sửa tên, Đổi thứ tự, Thêm, Xóa">✎</button>`;
}

function _catScopeMeta(scope) {
  if (scope === 'repair') return { title: 'NHÓM THIẾT BỊ (MRL · CA SỬA CHỮA)', list: () => REPAIR_CATEGORIES.filter((x) => x.key !== 'ALL'), countOf: (k) => state.repairCases.filter((c) => c.device_category === k).length, render: renderRepairsView };
  if (scope === 'knowledge') return { title: 'NHÓM NGUỒN KIẾN THỨC & SOP (MRL)', list: () => KNOWLEDGE_GROUPS.filter((x) => x.key !== 'ALL'), countOf: (k) => state.knowledgeItems.filter((x) => x.source_group === k).length, render: renderKnowledgeView };
  if (scope === 'plc') return { title: 'NHÓM CHỦ ĐỀ LẬP TRÌNH PLC', list: () => PLC_CATEGORIES.filter((x) => x.key !== 'ALL'), countOf: (k) => state.plcNotes.filter((p) => p.category === k).length, render: renderPlcView };
  if (scope === 'english') return { title: 'NHÓM TỪ VỰNG & LEXICAL CHUNKS', list: () => ENGLISH_CATEGORIES.filter((x) => x.key !== 'ALL'), countOf: (k) => (state.englishVocab || []).filter((v) => v.category === k).length, render: () => typeof renderEnVocabBankView === 'function' && renderEnVocabBankView() };
  return { title: 'CHUẨN GIAO THỨC MẠNG (NETWORK)', list: () => NETWORK_PROTOCOLS.filter((x) => x.key !== 'ALL'), countOf: (k) => state.networkNotes.filter((n) => n.protocol === k).length, render: renderNetworkView };
}

function _focusChipInlineInput(selectAll = false) {
  setTimeout(() => {
    const inp = document.getElementById('chip-inline-inp');
    if (!inp) return;
    inp.focus();
    if (selectAll) inp.select();
  }, 10);
}

function startChipInlineEdit(scope, key) {
  const meta = _catScopeMeta(scope);
  const found = meta.list().find((x) => x.key === key);
  if (!found) return;
  state.inlineChipEdit = { scope, key, draft: found.label };
  meta.render();
  _focusChipInlineInput(true);
}

function startChipInlineAdd(scope) {
  const meta = _catScopeMeta(scope);
  state.inlineChipEdit = { scope, key: '__NEW__', draft: '' };
  meta.render();
  _focusChipInlineInput(false);
}

function cancelChipInlineEdit() {
  if (!state.inlineChipEdit) return;
  const { scope } = state.inlineChipEdit;
  state.inlineChipEdit = null;
  _catScopeMeta(scope).render();
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

function onChipInlineKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveChipInlineEdit();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    cancelChipInlineEdit();
  }
}

async function saveWorkspaceCategoriesApi(scope, payloadItems, fallbackKey = null) {
  const res = await fetch(`/api/workspace-categories/${encodeURIComponent(scope)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: payloadItems, fallback_key: fallbackKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lưu danh mục thất bại');
  }
  const boot = await res.json();
  applyBootstrapData(boot, true);
}

async function saveChipInlineEdit() {
  const ed = state.inlineChipEdit;
  if (!ed) return;
  const inp = document.getElementById('chip-inline-inp');
  const val = (inp ? inp.value : ed.draft || '').trim();
  if (!val) {
    cancelChipInlineEdit();
    return;
  }
  if (['tất cả', 'all'].includes(val.toLowerCase())) {
    showToast('Tên danh mục không được trùng với TẤT CẢ', 'error');
    return;
  }
  const meta = _catScopeMeta(ed.scope);
  const items = meta.list();
  let payloadItems;
  if (ed.key === '__NEW__') {
    if (items.some((x) => x.key.toLowerCase() === val.toLowerCase() || x.label.toLowerCase() === val.toLowerCase())) {
      showToast('Mục này đã tồn tại trên thanh', 'error');
      return;
    }
    payloadItems = [
      ...items.map((x) => ({ key: x.key, label: x.label, orig_key: x.key })),
      { key: val, label: val },
    ];
  } else {
    payloadItems = items.map((x) =>
      x.key === ed.key
        ? { key: x.key, label: val, orig_key: x.key }
        : { key: x.key, label: x.label, orig_key: x.key }
    );
  }
  state.inlineChipEdit = null;
  try {
    await saveWorkspaceCategoriesApi(ed.scope, payloadItems, null);
    showToast(ed.key === '__NEW__' ? `Đã thêm mục "${val}"` : `Đã cập nhật mục "${val}"`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
    meta.render();
  }
}

async function deleteCategoryChip(scope, key) {
  const meta = _catScopeMeta(scope);
  const items = meta.list();
  if (items.length <= 1) {
    showToast('Phải giữ lại ít nhất 1 danh mục', 'error');
    return;
  }
  const target = items.find((x) => x.key === key);
  const remaining = items.filter((x) => x.key !== key);
  const cnt = meta.countOf(key);
  const msg = cnt > 0
    ? `Mục "${target?.label || key}" đang có ${cnt} bài. Khi xóa, các bài này sẽ được chuyển sang "${remaining[0].label}". Tiếp tục?`
    : `Xóa mục "${target?.label || key}" khỏi thanh lọc?`;
  if (!await uiConfirm(msg, { danger: true })) return;
  state.inlineChipEdit = null;
  try {
    await saveWorkspaceCategoriesApi(
      scope,
      remaining.map((x) => ({ key: x.key, label: x.label, orig_key: x.key })),
      remaining[0].key
    );
    showToast(`Đã xóa mục "${target?.label || key}"`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openCategoryManagerModal(scope) {
  if (state.inlineChipEdit) cancelChipInlineEdit();
  const meta = _catScopeMeta(scope);
  state.catMgr = {
    open: true,
    scope,
    items: meta.list().map((x) => ({ orig_key: x.key, key: x.key, label: x.label, count: meta.countOf(x.key) })),
    deletedWithCount: 0,
    fallbackKey: null,
  };
  const titleEl = document.getElementById('cat-mgr-title-text');
  if (titleEl) titleEl.textContent = meta.title;
  const newInp = document.getElementById('cat-mgr-new-inp');
  if (newInp) newInp.value = '';
  renderCatMgrRows();
  document.getElementById('category-manager-modal')?.classList.remove('hidden');
}

function closeCategoryManagerModal() {
  state.catMgr.open = false;
  document.getElementById('category-manager-modal')?.classList.add('hidden');
}

function renderCatMgrRows() {
  const listEl = document.getElementById('cat-mgr-list');
  if (!listEl) return;
  const items = state.catMgr.items || [];
  listEl.innerHTML = items.map((it, idx) => `
    <div class="cat-mgr-row">
      <span class="cat-mgr-idx">${pad2(idx + 1)}</span>
      <input type="text" class="inp mono cat-mgr-inp" value="${escapeHtml(it.label)}"
             oninput="state.catMgr.items[${idx}].label = this.value; _refreshCatMgrFallbackSelect();" />
      <span class="cat-mgr-cnt">${it.count} bài</span>
      <button type="button" class="btn btn-sm" onclick="moveCatMgrRow(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Đưa lên">↑</button>
      <button type="button" class="btn btn-sm" onclick="moveCatMgrRow(${idx}, 1)" ${idx >= items.length - 1 ? 'disabled' : ''} title="Đưa xuống">↓</button>
      <button type="button" class="btn btn-sm btn-danger" onclick="removeCatMgrRow(${idx})" ${items.length <= 1 ? 'disabled' : ''} title="Xóa mục">×</button>
    </div>`).join('');
  _refreshCatMgrFallbackSelect();
  if (typeof _translateUiLeafNodes === 'function') {
    _translateUiLeafNodes(document.getElementById('category-manager-modal'), state.appLang === 'en');
  }
}

function _refreshCatMgrFallbackSelect() {
  const box = document.getElementById('cat-mgr-reassign-box');
  const sel = document.getElementById('cat-mgr-fallback-sel');
  const msg = document.getElementById('cat-mgr-reassign-msg');
  if (!box || !sel) return;
  if ((state.catMgr.deletedWithCount || 0) <= 0) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  if (msg) msg.textContent = `${state.catMgr.deletedWithCount} bài thuộc mục bị xóa sẽ được chuyển sang:`;
  const prevIdx = sel.value;
  sel.innerHTML = (state.catMgr.items || []).map((it, idx) => `<option value="${idx}">${escapeHtml((it.label || it.key || '').trim() || `Mục #${idx + 1}`)}</option>`).join('');
  if (prevIdx !== '' && Number(prevIdx) < state.catMgr.items.length) sel.value = prevIdx;
}

function moveCatMgrRow(idx, delta) {
  const items = state.catMgr.items;
  const target = idx + delta;
  if (target < 0 || target >= items.length) return;
  const tmp = items[idx];
  items[idx] = items[target];
  items[target] = tmp;
  renderCatMgrRows();
}

function removeCatMgrRow(idx) {
  const items = state.catMgr.items;
  if (items.length <= 1) {
    showToast('Phải giữ lại ít nhất 1 danh mục', 'error');
    return;
  }
  const [removed] = items.splice(idx, 1);
  if (removed && removed.count > 0) {
    state.catMgr.deletedWithCount = (state.catMgr.deletedWithCount || 0) + removed.count;
  }
  renderCatMgrRows();
}

function addCatMgrRow() {
  const inp = document.getElementById('cat-mgr-new-inp');
  const val = (inp?.value || '').trim();
  if (!val) return;
  if (['tất cả', 'all'].includes(val.toLowerCase())) {
    showToast('Tên danh mục không được trùng với TẤT CẢ', 'error');
    return;
  }
  if (state.catMgr.items.some((x) => (x.label || '').trim().toLowerCase() === val.toLowerCase() || (x.key || '').trim().toLowerCase() === val.toLowerCase())) {
    showToast('Mục này đã tồn tại', 'error');
    return;
  }
  state.catMgr.items.push({ orig_key: null, key: val, label: val.toUpperCase(), count: 0 });
  if (inp) inp.value = '';
  renderCatMgrRows();
}

async function submitCategoryManagerModal() {
  const { scope, items, deletedWithCount } = state.catMgr;
  if (!scope) return;
  const cleanItems = items
    .map((x) => ({ ...x, label: (x.label || '').trim() }))
    .filter((x) => x.label && !['tất cả', 'all'].includes(x.label.toLowerCase()));
  if (!cleanItems.length) {
    showToast('Phải giữ lại ít nhất 1 danh mục', 'error');
    return;
  }
  let fallbackKey = null;
  if (deletedWithCount > 0) {
    const sel = document.getElementById('cat-mgr-fallback-sel');
    const fbIdx = Math.max(0, Math.min(cleanItems.length - 1, parseInt(sel?.value || '0', 10) || 0));
    const fbItem = cleanItems[fbIdx];
    if (fbItem) {
      if (fbItem.orig_key && (scope === 'repair' || scope === 'knowledge')) {
        fallbackKey = fbItem.orig_key;
      } else if (fbItem.orig_key) {
        const origObj = _catScopeMeta(scope).list().find((o) => o.key === fbItem.orig_key);
        fallbackKey = (origObj && fbItem.label.toUpperCase() === origObj.label.toUpperCase()) ? fbItem.orig_key : fbItem.label;
      } else {
        fallbackKey = fbItem.key || fbItem.label;
      }
    }
  }
  try {
    await saveWorkspaceCategoriesApi(
      scope,
      cleanItems.map((x) => ({ key: x.key, label: x.label, orig_key: x.orig_key })),
      fallbackKey
    );
    closeCategoryManagerModal();
    showToast('Đã cập nhật thanh danh mục', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function resetCatMgrToDefault() {
  const scope = state.catMgr.scope;
  if (!scope) return;
  if (!await uiConfirm('Khôi phục thanh danh mục này về mặc định ban đầu (giữ nguyên toàn bộ bài học)?')) return;
  try {
    const res = await fetch(`/api/workspace-categories/${encodeURIComponent(scope)}/reset`, { method: 'POST' });
    if (!res.ok) throw new Error('Khôi phục thất bại');
    const boot = await res.json();
    applyBootstrapData(boot, true);
    closeCategoryManagerModal();
    showToast('Đã khôi phục thanh danh mục mặc định', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function applySidebarCollapsed() {
  const shell = document.getElementById('app-shell');
  if (shell) shell.classList.toggle('sidebar-collapsed', Boolean(state.sidebarCollapsed));
  document.querySelectorAll('.sidebar-open-btn').forEach((btn) => {
    btn.textContent = state.sidebarCollapsed ? '☰ Hiện menu' : '☰ Menu';
    btn.title = state.sidebarCollapsed ? 'Hiện thanh menu dọc bên trái (Ctrl+B)' : 'Ẩn thanh menu dọc bên trái (Ctrl+B)';
  });
}

function toggleLeftSidebar(force = null, isUser = true) {
  if (isUser) state.sidebarUserToggled = true;
  state.sidebarCollapsed = force === null ? !state.sidebarCollapsed : Boolean(force);
  applySidebarCollapsed();
  if (state.activeWorkspace && FOCUS_TABS.includes(state.activeTab)) {
    const meta = _tabPaneMeta(state.activeTab);
    if (meta) meta.r();
  } else if (state.activeTab === 'scratchpad') {
    renderScratchpadView();
  }
}

window.addEventListener('resize', () => {
  if (!state.activeWorkspace || state.sidebarUserToggled) return;
  const shouldCollapse = window.innerWidth <= 960;
  if (state.sidebarCollapsed !== shouldCollapse) {
    state.sidebarCollapsed = shouldCollapse;
    applySidebarCollapsed();
  }
});

function _tabPaneMeta(tab) {
  if (tab === 'repairs') return { c: 'repairsListCollapsed', p: 'repairsListPinned', r: renderRepairsView, get: getFilteredRepairCases, sel: 'selectedRepairId', pane: 'repair-detail' };
  if (tab === 'knowledge') return { c: 'knowledgeListCollapsed', p: 'knowledgeListPinned', r: renderKnowledgeView, get: getFilteredKnowledgeItems, sel: 'selectedKnowledgeId', pane: 'knowledge-detail' };
  if (tab === 'plc') return { c: 'plcListCollapsed', p: 'plcListPinned', r: renderPlcView, get: getFilteredPlcNotes, sel: 'selectedPlcId', pane: 'plc-detail' };
  if (tab === 'network') return { c: 'networkListCollapsed', p: 'networkListPinned', r: renderNetworkView, get: getFilteredNetworkNotes, sel: 'selectedNetworkId', pane: 'network-detail' };
  if (tab === 'en-vocab-bank') return { c: 'enBankListCollapsed', p: 'enBankListPinned', r: () => typeof renderEnVocabBankView === 'function' && renderEnVocabBankView(), get: () => (typeof getFilteredEnVocab === 'function' ? getFilteredEnVocab() : []), sel: 'selectedEnglishVocabId', pane: 'en-bank-detail' };
  return null;
}

function showListPane(tab) {
  const meta = _tabPaneMeta(tab);
  if (!meta) return;
  state[meta.c] = false;
  meta.r();
}

function togglePinListPane(tab) {
  const meta = _tabPaneMeta(tab);
  if (!meta) return;
  if (state[meta.c]) {
    state[meta.c] = false;
    state[meta.p] = true;
  } else {
    state[meta.c] = true;
    state[meta.p] = false;
  }
  meta.r();
}

function navigateAdjacentItem(tab, delta) {
  const meta = _tabPaneMeta(tab);
  if (!meta) return;
  const filtered = meta.get();
  if (!filtered.length) return;
  const idx = Math.max(0, filtered.findIndex((x) => x.id === state[meta.sel]));
  const nextIdx = (idx + delta + filtered.length) % filtered.length;
  state[meta.sel] = filtered[nextIdx].id;
  meta.r();
  const pane = document.getElementById(meta.pane);
  if (pane) pane.scrollTop = 0;
  pushNavHistory();
}

function renderFocusNavBar(tab, currentIdx, total) {
  const meta = _tabPaneMeta(tab);
  const isCollapsed = meta ? state[meta.c] : false;
  const isPinned = meta ? state[meta.p] : false;
  const pinActive = !isCollapsed && isPinned;
  return `
    <div class="focus-bar">
      <div class="focus-group">
        ${isCollapsed ? `<button type="button" class="btn btn-sm" onclick="showListPane('${tab}')">← Danh sách (Esc)</button>` : ''}
        <button type="button" class="btn btn-sm ${pinActive ? 'pin-active' : ''}" onclick="togglePinListPane('${tab}')" title="${isCollapsed ? 'Hiện và ghim cột danh sách' : 'Ẩn cột danh sách để đọc tập trung'}">
          ☷ Hiện/Ẩn cột danh sách
        </button>
        <button type="button" class="btn btn-sm" onclick="pinPrimaryToSecondary(event)" title="Mở bài này ở Khung 2 (Chia đôi màn hình kiểu TIA Portal)">
          ◫ Mở ở Khung 2
        </button>
        <button type="button" class="btn btn-sm" onclick="toggleCurrentRecordBilingual()" title="Đối chiếu Song ngữ Việt ⇄ Anh toàn bộ bài đang xem">
          🇬🇧 Song ngữ cả bài
        </button>
      </div>
      <div class="focus-group">
        <span class="focus-pos">${pad2(currentIdx + 1)} / ${pad2(total)}</span>
        <button type="button" class="btn btn-sm" onclick="navigateAdjacentItem('${tab}', -1)" ${total <= 1 ? 'disabled' : ''}>↑ Bài trước</button>
        <button type="button" class="btn btn-sm" onclick="navigateAdjacentItem('${tab}', 1)" ${total <= 1 ? 'disabled' : ''}>↓ Bài tiếp</button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Custom Context Menu (Menu Chuột Phải cho 3 vị trí: Danh mục, Bài học, Tab)
// ---------------------------------------------------------------------------
function _scopeApplyFilter(scope, key) {
  if (scope === 'repair') setRepairCategory(key);
  else if (scope === 'knowledge') setKnowledgeGroup(key);
  else if (scope === 'plc') setPlcCategory(key);
  else if (scope === 'network') setNetworkProtocol(key);
  else if (scope === 'english' && typeof setEnBankCategory === 'function') setEnBankCategory(key);
}

function jumpToRecordInCategory(scope, key, id) {
  if (typeof closeCrossRefDrawer === 'function') closeCrossRefDrawer();
  if (scope === 'repair') {
    state.repairFilters.category = key || 'ALL';
    state.selectedRepairId = id;
    if (!state.repairsListPinned) state.repairsListCollapsed = false;
    enterWorkspace('mrl', 'repairs');
  } else if (scope === 'knowledge') {
    state.knowledgeFilters.group = key || 'ALL';
    state.selectedKnowledgeId = id;
    if (!state.knowledgeListPinned) state.knowledgeListCollapsed = false;
    enterWorkspace('mrl', 'knowledge');
  } else if (scope === 'plc') {
    state.plcFilters.category = key || 'ALL';
    state.selectedPlcId = id;
    if (!state.plcListPinned) state.plcListCollapsed = false;
    enterWorkspace('plc', 'plc');
  } else if (scope === 'network') {
    state.networkFilters.protocol = key || 'ALL';
    state.selectedNetworkId = id;
    if (!state.networkListPinned) state.networkListCollapsed = false;
    enterWorkspace('network', 'network');
  } else if (scope === 'english') {
    state.enBankFilters.category = key || 'ALL';
    state.selectedEnglishVocabId = id;
    if (!state.enBankListPinned) state.enBankListCollapsed = false;
    enterWorkspace('english', 'en-vocab-bank');
  }
}

async function moveCategoryChipQuick(scope, key, delta) {
  const meta = _catScopeMeta(scope);
  const items = meta.list().slice();
  const idx = items.findIndex((x) => x.key === key);
  const target = idx + delta;
  if (idx < 0 || target < 0 || target >= items.length) return;
  const moved = items[idx];
  items[idx] = items[target];
  items[target] = moved;
  try {
    await saveWorkspaceCategoriesApi(
      scope,
      items.map((x) => ({ key: x.key, label: x.label, orig_key: x.key })),
      null
    );
    showToast(`Đã chuyển "${moved.label}" ${delta < 0 ? 'sang trái' : 'sang phải'}`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openModalForScopeCategory(scope, key) {
  const isSpecific = Boolean(key && key !== 'ALL');
  if (scope === 'repair') {
    if (isSpecific) state.repairFilters.category = key;
    openRepairModal();
    const sel = document.getElementById('rep-form-category');
    if (sel && isSpecific) sel.value = key;
  } else if (scope === 'knowledge') {
    if (isSpecific) state.knowledgeFilters.group = key;
    openKnowledgeModal();
    const sel = document.getElementById('knw-form-group');
    if (sel && isSpecific) sel.value = key;
  } else if (scope === 'plc') {
    if (isSpecific) state.plcFilters.category = key;
    openPlcModal();
    const sel = document.getElementById('plc-form-category');
    if (sel && isSpecific) sel.value = key;
  } else if (scope === 'network') {
    if (isSpecific) state.networkFilters.protocol = key;
    openNetworkModal();
    const sel = document.getElementById('net-form-protocol');
    if (sel && isSpecific) sel.value = key;
  } else if (scope === 'english' && typeof openEnVocabEditorModal === 'function') {
    if (isSpecific) state.enBankFilters.category = key;
    openEnVocabEditorModal();
    const sel = document.getElementById('ev-form-category');
    if (sel && isSpecific) sel.value = key;
  }
}

async function quickUpdateRecordCategory(kind, id, targetKey) {
  if (state.inlineSectionEdit && typeof _flushInlineSectionOnLeave === 'function') {
    await _flushInlineSectionOnLeave(false);
  }
  try {
    const res = await fetch(`/api/records/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/category`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_key: targetKey }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Đổi danh mục thất bại');
    }
    const boot = await res.json();
    applyBootstrapData(boot, true);
    const meta = _catScopeMeta(kind);
    const targetObj = meta.list().find((x) => x.key === targetKey);
    showToast(`Đã chuyển ${id} sang "${targetObj ? targetObj.label : targetKey}"`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function copyRecordRef(kind, id) {
  const meta = typeof _describeTarget === 'function' ? _describeTarget(kind, id) : null;
  const text = meta ? `${meta.badge} — ${meta.title}` : id;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showToast(`Đã sao chép: ${meta ? meta.badge : id}`, 'success');
  } catch (err) {
    showToast('Không thể sao chép tự động', 'error');
  }
}

function _getRecordsForScopeCategory(scope, key) {
  const isAll = !key || key === 'ALL';
  if (scope === 'repair') {
    return state.repairCases
      .filter((c) => isAll || c.device_category === key)
      .map((c) => ({ id: c.id, title: c.brand_model, status: c.status_code }));
  }
  if (scope === 'knowledge') {
    return state.knowledgeItems
      .filter((k) => isAll || k.source_group === key)
      .map((k) => ({ id: k.id, title: k.topic_model, status: k.status_code }));
  }
  if (scope === 'plc') {
    return state.plcNotes
      .filter((p) => isAll || p.category === key)
      .map((p) => ({ id: p.id, title: p.title, status: p.status_code }));
  }
  if (scope === 'english') {
    return (state.englishVocab || [])
      .filter((v) => isAll || v.category === key)
      .map((v) => ({ id: v.id, title: `${v.term_or_chunk} (${v.meaning_vi})`, status: v.status_code || 'review' }));
  }
  return state.networkNotes
    .filter((n) => isAll || n.protocol === key)
    .map((n) => ({ id: n.id, title: n.target_device, status: n.status_code }));
}

function _getRecordSummary(kind, id) {
  if (kind === 'repair') {
    const c = state.repairCases.find((x) => x.id === id);
    return c ? { id: c.id, title: c.brand_model, status: c.status_code, catKey: c.device_category, ws: 'mrl' } : null;
  }
  if (kind === 'knowledge') {
    const k = state.knowledgeItems.find((x) => x.id === id);
    return k ? { id: k.id, title: k.topic_model, status: k.status_code, catKey: k.source_group, ws: 'mrl' } : null;
  }
  if (kind === 'plc') {
    const p = state.plcNotes.find((x) => x.id === id);
    return p ? { id: p.id, title: p.title, status: p.status_code, catKey: p.category, ws: 'plc' } : null;
  }
  if (kind === 'network') {
    const n = state.networkNotes.find((x) => x.id === id);
    return n ? { id: n.id, title: n.target_device, status: n.status_code, catKey: n.protocol, ws: 'network' } : null;
  }
  return null;
}

function _openRecordEditModal(kind, id) {
  if (typeof closeCrossRefDrawer === 'function') closeCrossRefDrawer();
  if (kind === 'repair') openRepairModal(id);
  else if (kind === 'knowledge') openKnowledgeModal(id);
  else if (kind === 'plc') openPlcModal(id);
  else if (kind === 'network') openNetworkModal(id);
}

let _ctxActionMap = [];

function isCtxMenuOpen() {
  const el = document.getElementById('ctx-menu');
  return Boolean(el && !el.classList.contains('hidden'));
}

function closeCtxMenu() {
  const el = document.getElementById('ctx-menu');
  if (!el) return;
  el.classList.add('hidden');
  el.innerHTML = '';
  _ctxActionMap = [];
}

function _buildCtxItemsHtml(entries) {
  return entries.map((en) => {
    if (en.sep) return '<div class="ctx-sep" role="separator"></div>';
    const hasSub = Array.isArray(en.children);
    const dis = Boolean(en.disabled);
    let actAttr = '';
    if (!dis && typeof en.onClick === 'function') {
      const idx = _ctxActionMap.length;
      _ctxActionMap.push(en.onClick);
      actAttr = `data-ctx-act="${idx}"`;
    }
    const cls = [
      'ctx-item',
      en.danger ? 'danger' : '',
      dis ? 'disabled' : '',
      en.active ? 'active-mark' : '',
    ].filter(Boolean).join(' ');
    const ico = en.icon ? `<span class="ctx-ico" aria-hidden="true">${escapeHtml(en.icon)}</span>` : '<span class="ctx-ico" aria-hidden="true"></span>';
    const right = en.right ? `<span class="ctx-right">${escapeHtml(en.right)}</span>` : '';
    const caret = hasSub ? '<span class="ctx-caret" aria-hidden="true">▸</span>' : '';
    const btnHtml = `<button type="button" class="${cls}" role="menuitem" ${hasSub ? 'aria-haspopup="true"' : ''} ${dis ? 'aria-disabled="true"' : ''} ${actAttr}>${ico}<span class="ctx-lbl">${escapeHtml(en.label)}</span>${right}${caret}</button>`;
    if (hasSub) {
      return `<div class="ctx-row has-sub">${btnHtml}<div class="ctx-submenu" role="menu">${_buildCtxItemsHtml(en.children)}</div></div>`;
    }
    return btnHtml;
  }).join('');
}

function _positionSubmenu(wrap) {
  const sub = wrap.querySelector(':scope > .ctx-submenu');
  if (!sub) return;
  sub.classList.remove('flip-left', 'flip-up');
  const prevDisp = sub.style.display;
  if (getComputedStyle(sub).display === 'none') sub.style.display = 'block';
  const rect = sub.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  if (rect.right > window.innerWidth - 8 && wrapRect.left > rect.width + 8) {
    sub.classList.add('flip-left');
  }
  if (rect.bottom > window.innerHeight - 8 && wrapRect.bottom > Math.min(rect.height, 260)) {
    sub.classList.add('flip-up');
  }
  sub.style.display = prevDisp;
}

function openCtxMenu(x, y, headerText, entries) {
  const menu = document.getElementById('ctx-menu');
  if (!menu) return;
  _ctxActionMap = [];
  const locHeader = (state.appLang === 'en' && typeof localizeMenuText === 'function') ? localizeMenuText(headerText) : headerText;
  const locEntries = (state.appLang === 'en' && typeof localizeMenuEntries === 'function') ? localizeMenuEntries(entries) : entries;
  const headHtml = locHeader ? `<div class="ctx-head">${escapeHtml(locHeader)}</div>` : '';
  menu.innerHTML = headHtml + _buildCtxItemsHtml(locEntries);
  menu.style.left = '-9999px';
  menu.style.top = '-9999px';
  menu.classList.remove('hidden');

  const mw = menu.offsetWidth || 250;
  const mh = menu.offsetHeight || 200;
  const left = Math.max(8, Math.min(x, window.innerWidth - mw - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - mh - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  menu.querySelectorAll('.ctx-row.has-sub').forEach((wrap) => {
    wrap.addEventListener('mouseenter', () => _positionSubmenu(wrap));
    wrap.addEventListener('focusin', () => _positionSubmenu(wrap));
  });

  menu.querySelectorAll('.ctx-item').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (btn.classList.contains('disabled')) return;
      const actStr = btn.getAttribute('data-ctx-act');
      if (actStr !== null) {
        const fn = _ctxActionMap[Number(actStr)];
        closeCtxMenu();
        if (typeof fn === 'function') fn();
      }
    });
  });
}

function _buildCategoryCtxMenu(scope, key) {
  const meta = _catScopeMeta(scope);
  const items = meta.list();
  const isAll = key === 'ALL';
  const idx = items.findIndex((x) => x.key === key);
  const catObj = idx >= 0 ? items[idx] : null;
  const catLabel = isAll ? 'TẤT CẢ' : (catObj ? catObj.label : key);
  const recs = _getRecordsForScopeCategory(scope, key);

  const recChildren = recs.length
    ? [
        ...recs.slice(0, 25).map((r) => ({
          icon: '•',
          label: `${r.id} · ${String(r.title || '').replace(/\s*\n+\s*/g, ' ')}`,
          onClick: () => jumpToRecordInCategory(scope, key, r.id),
        })),
        ...(recs.length > 25 ? [{ sep: true }, { icon: '…', label: `Còn ${recs.length - 25} bài khác (bấm Lọc để xem hết)`, onClick: () => _scopeApplyFilter(scope, key) }] : []),
      ]
    : [{ icon: '—', label: 'Chưa có bài nào trong mục này', disabled: true }];

  const entries = [];
  if (!isAll) {
    entries.push({ icon: '⌕', label: `Lọc theo "${catLabel}"`, right: `${recs.length} bài`, onClick: () => _scopeApplyFilter(scope, key) });
  } else {
    entries.push({ icon: '⌕', label: 'Hiển thị tất cả bài', right: `${recs.length} bài`, onClick: () => _scopeApplyFilter(scope, 'ALL') });
  }
  entries.push({ icon: '📋', label: 'Danh sách bài trong mục', right: `${recs.length}`, children: recChildren });
  entries.push({ icon: '+', label: isAll ? 'Thêm bài mới' : 'Thêm bài mới vào mục này', onClick: () => openModalForScopeCategory(scope, key) });
  entries.push({ icon: '🧠', label: isAll ? 'Ôn tập toàn phân hệ' : 'Ôn tập riêng mục này', onClick: () => startDrillForCategory(scope, key) });
  entries.push({ sep: true });
  if (!isAll) {
    entries.push({ icon: '✎', label: 'Đổi tên mục này', right: 'Double-click', onClick: () => startChipInlineEdit(scope, key) });
    entries.push({ icon: '←', label: 'Đưa sang trái', disabled: idx <= 0, onClick: () => moveCategoryChipQuick(scope, key, -1) });
    entries.push({ icon: '→', label: 'Đưa sang phải', disabled: idx >= items.length - 1, onClick: () => moveCategoryChipQuick(scope, key, 1) });
  }
  entries.push({ icon: '+', label: 'Thêm danh mục mới', onClick: () => startChipInlineAdd(scope) });
  entries.push({ icon: '⚙', label: 'Quản lý toàn bộ danh mục...', onClick: () => openCategoryManagerModal(scope) });
  if (!isAll) {
    entries.push({ sep: true });
    entries.push({ icon: '🗑', label: 'Xóa mục này', danger: true, disabled: items.length <= 1, onClick: () => deleteCategoryChip(scope, key) });
  }
  return { header: `DANH MỤC · ${catLabel}`, entries };
}

function _buildRecordCtxMenu(kind, id) {
  const rec = _getRecordSummary(kind, id);
  const meta = typeof _describeTarget === 'function' ? _describeTarget(kind, id) : null;
  if (!rec || !meta) return null;
  const catMeta = _catScopeMeta(kind);
  const catItems = catMeta.list();
  const statusChildren = STATUS_ORDER.filter((c) => c !== 'unclassified').map((code) => ({
    icon: rec.status === code ? '✓' : '•',
    label: STATUS_META[code].label,
    active: rec.status === code,
    onClick: () => quickUpdateStatus(kind, id, code),
  }));
  const categoryChildren = catItems.map((c) => ({
    icon: rec.catKey === c.key ? '✓' : '📁',
    label: c.label,
    active: rec.catKey === c.key,
    disabled: rec.catKey === c.key,
    onClick: () => quickUpdateRecordCategory(kind, id, c.key),
  }));

  const entries = [
    { icon: '📄', label: 'Mở ở Khung chính', onClick: () => { if (typeof closeCrossRefDrawer === 'function') closeCrossRefDrawer(); openTargetInPrimary(meta); } },
    { icon: '📂', label: 'Mở ở Khung 2 (Chia đôi)', onClick: () => { if (typeof closeCrossRefDrawer === 'function') closeCrossRefDrawer(); openTargetInSecondary(meta); } },
    { icon: '🎯', label: 'Ôn bài này', onClick: () => { if (typeof closeCrossRefDrawer === 'function') closeCrossRefDrawer(); startDrillForItem(kind, id); } },
    { sep: true },
    { icon: '🏷', label: 'Đổi trạng thái nhanh', children: statusChildren },
    { icon: '📁', label: 'Chuyển sang danh mục khác', children: categoryChildren },
    { sep: true },
    { icon: '✎', label: 'Sửa bài', onClick: () => _openRecordEditModal(kind, id) },
    { icon: '📋', label: 'Sao chép mã & tiêu đề', onClick: () => copyRecordRef(kind, id) },
    { sep: true },
    { icon: '🗑', label: 'Xóa bài', danger: true, onClick: () => deleteRecord(kind, id) },
  ];
  const shortTitle = String(rec.title || '').replace(/\s*\n+\s*/g, ' ').slice(0, 38);
  return { header: `${rec.id} · ${shortTitle}`, entries };
}

function _buildTabCtxMenu(tabKey) {
  const tabIdx = state.editorTabs.findIndex((t) => t.key === tabKey);
  const tab = tabIdx >= 0 ? state.editorTabs[tabIdx] : null;
  if (!tab) return null;
  const isRecordTab = ['repair', 'knowledge', 'plc', 'network'].includes(tab.kind);
  const entries = [
    { icon: '📄', label: 'Mở ở Khung chính', onClick: () => openTargetInPrimary(tab) },
    { icon: '📂', label: 'Đưa tab này sang Khung 2', onClick: () => openTargetInSecondary(tab) },
    ...(isRecordTab ? [{ icon: '🎯', label: 'Ôn bài này', onClick: () => startDrillForItem(tab.kind, tab.id) }] : []),
    { sep: true },
    { icon: '×', label: 'Đóng tab này', onClick: () => closeEditorTab(tab.key) },
    { icon: '×', label: 'Đóng các tab khác', disabled: state.editorTabs.length <= 1, onClick: () => closeOtherEditorTabs(tab.key) },
    { icon: '⇥', label: 'Đóng các tab bên phải', disabled: tabIdx >= state.editorTabs.length - 1, onClick: () => closeRightEditorTabs(tab.key) },
    { icon: '🧹', label: 'Đóng bớt (giữ tab đang xem)', disabled: state.editorTabs.length <= 2, onClick: () => closeAllEditorTabs() },
  ];
  return { header: `TAB · ${tab.badge}`, entries };
}

document.addEventListener('contextmenu', (e) => {
  const t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('#ctx-menu')) {
    e.preventDefault();
    return;
  }
  if (t.closest('input, textarea, select, [contenteditable="true"], .chip-editing, #en-selection-popover, #en-hover-tip')) return;

  const selObj = window.getSelection ? window.getSelection() : null;
  const selTxt = selObj ? String(selObj.toString() || '').replace(/\s+/g, ' ').trim() : '';
  if (selTxt.length >= 2 && selTxt.length <= 1500 && !t.closest('[data-ctx-tab-key], [data-ctx-scope][data-ctx-key]') && t.closest('.detail-pane, .fc-card, .portal-body, .scratchpad-wrap')) {
    e.preventDefault();
    const selRect = selObj.rangeCount ? selObj.getRangeAt(0).getBoundingClientRect() : null;
    openCtxMenu(e.clientX, e.clientY, 'HỌC TIẾNG ANH CHUYÊN NGÀNH', [
      {
        icon: '🇬🇧',
        label: 'Dịch đoạn đang chọn sang Tiếng Anh',
        onClick: () => {
          if (typeof openSelectionTranslatorForText === 'function') {
            openSelectionTranslatorForText(selTxt, selRect || { left: e.clientX, top: e.clientY, right: e.clientX, bottom: e.clientY }, '');
          }
        },
      },
      {
        icon: '🔊',
        label: 'Đọc phát âm Tiếng Anh',
        onClick: () => {
          if (typeof translateAndSpeakVi === 'function') translateAndSpeakVi(selTxt);
        },
      },
      { sep: true },
      {
        icon: '📋',
        label: 'Sao chép đoạn đang chọn',
        onClick: () => {
          navigator.clipboard?.writeText?.(selTxt).then(() => showToast('Đã sao chép đoạn văn bản', 'success')).catch(() => {});
        },
      },
    ]);
    return;
  }

  const tabEl = t.closest('[data-ctx-tab-key]');
  if (tabEl) {
    const data = _buildTabCtxMenu(tabEl.getAttribute('data-ctx-tab-key'));
    if (data) {
      e.preventDefault();
      openCtxMenu(e.clientX, e.clientY, data.header, data.entries);
    }
    return;
  }

  const catEl = t.closest('[data-ctx-scope][data-ctx-key]');
  if (catEl) {
    const scope = catEl.getAttribute('data-ctx-scope');
    const key = catEl.getAttribute('data-ctx-key');
    const data = _buildCategoryCtxMenu(scope, key);
    if (data) {
      e.preventDefault();
      openCtxMenu(e.clientX, e.clientY, data.header, data.entries);
    }
    return;
  }

  const recEl = t.closest('[data-ctx-record-kind][data-ctx-record-id]');
  if (recEl) {
    const kind = recEl.getAttribute('data-ctx-record-kind');
    const id = recEl.getAttribute('data-ctx-record-id');
    const data = _buildRecordCtxMenu(kind, id);
    if (data) {
      e.preventDefault();
      openCtxMenu(e.clientX, e.clientY, data.header, data.entries);
    }
  }
});

document.addEventListener('mousedown', (e) => {
  if (isCtxMenuOpen() && !e.target?.closest?.('#ctx-menu')) closeCtxMenu();
});
document.addEventListener('scroll', (e) => {
  if (isCtxMenuOpen() && !e.target?.closest?.('#ctx-menu')) closeCtxMenu();
}, true);
window.addEventListener('resize', closeCtxMenu);
window.addEventListener('blur', closeCtxMenu);

