/* ==========================================================================
   MRL Shared Core Store, Transparent Offline Router, Bilingual Engine & OTA
   - Shared between Desktop UI and Mobile Shell (1 Core - 2 UI Shells)
   - Runs 100% independently on IndexedDB/LocalStorage when PC is off
   ========================================================================== */
(function () {
  'use strict';

  const _nativeFetch = window.fetch.bind(window);
  const DB_NAME = 'MRL_PWA_DB_v1';
  const STORE_NAME = 'kv';
  const SEED_URL_CANDIDATES = ['./mrl_initial_seed.json', './static/mrl_initial_seed.json', '/mrl_initial_seed.json', '/static/mrl_initial_seed.json'];
  const SYNC_CFG_KEY = 'mrl-cloud-sync-cfg';
  const AI_CFG_KEY = 'mrl-ai-cfg';
  const TRANS_CACHE_KEY = 'mrl-trans-cache-v1';
  const UNSYNCED_KEY = 'mrl_has_unsynced';

  function hasUnsyncedChanges() {
    try { return localStorage.getItem(UNSYNCED_KEY) === '1'; } catch (_) { return false; }
  }

  function _setUnsyncedFlag(dirty) {
    try {
      if (dirty) localStorage.setItem(UNSYNCED_KEY, '1');
      else localStorage.removeItem(UNSYNCED_KEY);
    } catch (_) {}
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('mrl-sync-dirty-change', { detail: { dirty: Boolean(dirty) } }));
    }
  }

  let _mode = 'unknown'; // 'unknown' | 'online' | 'offline'
  let _snapshot = null;
  let _autoPushTimer = null;
  let _swReg = null;
  let _otaBannerShown = false;

  const STATUS_LABELS = {
    mastered: '🟢 ĐÃ LÀM CHỦ',
    review: '🟡 CẦN XEM LẠI',
    researching: '🔴 ĐANG NGHIÊN CỨU',
    unclassified: '⚪ CHƯA PHÂN LOẠI',
  };

  const DEFAULT_WORKSPACE_CATEGORIES = {
    repair: [
      { key: 'VFD', label: 'VFD' },
      { key: 'Circuit_Board', label: 'BO MẠCH' },
      { key: 'Screen', label: 'HMI / MÀN HÌNH' },
      { key: 'Servo', label: 'SERVO' },
      { key: 'PLC', label: 'PLC' },
      { key: 'Sensors', label: 'CẢM BIẾN' },
    ],
    knowledge: [
      { key: 'Knowledge', label: 'KIẾN THỨC ĐO & SỬA' },
      { key: 'Automation', label: 'TỰ ĐỘNG HÓA' },
      { key: 'Errors', label: 'MÃ LỖI NHANH' },
    ],
    plc: [
      { key: 'Khối hàm (FB/FC/OB)', label: 'KHỐI HÀM FB/FC/OB' },
      { key: 'Vùng nhớ (DB/UDT)', label: 'VÙNG NHỚ DB/UDT' },
      { key: 'Analog & PID', label: 'ANALOG & PID' },
      { key: 'Đấu nối & Bản vẽ', label: 'ĐẤU NỐI & BẢN VẼ' },
    ],
    network: [
      { key: 'Modbus RTU/TCP', label: 'MODBUS RTU/TCP' },
      { key: 'EtherCAT', label: 'ETHERCAT' },
      { key: 'CANbus / CANopen', label: 'CANBUS / CANOPEN' },
      { key: 'Profibus / Profinet', label: 'PROFIBUS / PROFINET' },
      { key: 'USS / RS485', label: 'USS / RS485' },
    ],
    english: [
      { key: 'Giao tiếp & Hội thoại', label: 'GIAO TIẾP & HỘI THOẠI' },
      { key: 'Lexical Chunks (Cụm từ nối)', label: 'LEXICAL CHUNKS' },
      { key: 'Biến tần & Phần cứng', label: 'BIẾN TẦN & PHẦN CỨNG' },
      { key: 'PLC & Tự động hóa', label: 'PLC & TỰ ĐỘNG HÓA' },
      { key: 'Mạng truyền thông', label: 'MẠNG TRUYỀN THÔNG' },
    ],
  };

  const _OFFLINE_PHRASE_MAP = [
    ['tự động kích hoạt ngay khoảnh khắc', 'automatically activates at the exact moment'],
    ['lặp đi lặp lại vô hạn từ trên xuống dưới', 'repeats infinitely from top to bottom'],
    ['mà không cần lưu trạng thái cũ', 'without needing to store previous state'],
    ['chế độ điều khiển tự động', 'Automatic control mode'],
    ['chế độ điều khiển bằng tay', 'Manual control mode'],
    ['giữ thời gian lấy mẫu cố định tuyệt đối', 'keep the sampling time strictly constant'],
    ['theo đúng chu kỳ cứng', 'on a strict fixed cyclic interval'],
    ['nhằm giữ', 'to keep'],
    ['tự động ngắt', 'automatically interrupts'],
    ['tự động kích hoạt', 'automatically activates'],
    ['báo lỗi lên màn hình', 'reports the fault on the HMI screen'],
    ['không bị dừng', 'preventing a CPU STOP'],
    ['giữ cho plc', 'keeps the PLC'],
    ['đưa đầu vào', 'takes inputs'],
    ['tính ra đầu ra', 'computes outputs'],
    ['trong 1 vòng quét', 'within 1 scan cycle'],
    ['lưu tạm tỉ lệ', 'temporarily stores the ratio'],
    ['biến nháp', 'temporary variable'],
    ['đổi ra', 'converts to'],
    ['nơi chứa các', 'containing'],
    ['chỉ dùng cho', 'used only for'],
    ['dùng để chứa', 'used to store'],
    ['dùng để', 'used to'],
    ['chuyển từ stop sang run', 'transitions from STOP to RUN'],
    ['chạy đúng 1 vòng quét duy nhất', 'executes for exactly one scan cycle'],
    ['lặp đi lặp lại vô hạn', 'repeats continuously'],
    ['từ trên xuống dưới', 'from top to bottom'],
    ['lập trình cho hệ thống điều khiển', 'program a control system'],
    ['với yêu cầu', 'with requirements'],
    ['nhấn nút', 'press button'],
    ['khoảng thời gian', 'time duration'],
    ['công thức toán học', 'mathematical formulas'],
    ['tín hiệu nguyên', 'raw integer signal'],
    ['giải đo', 'measurement range'],
    ['dải đo', 'measurement range'],
    ['áp suất nước', 'water pressure'],
    ['điều khiển pid', 'PID control'],
    ['hiển thị lên màn hình', 'display on screen'],
    ['tùy ý', 'freely / manually'],
    ['khi cần thiết', 'when needed'],
    ['bị đứt cáp', 'suffers a cable break'],
    ['hoặc mất nguồn', 'or power loss'],
    ['kiến thức cần hiểu', 'essential knowledge'],
    ['bài tập thực hành', 'practice exercises'],
    ['kiến thức cơ bản', 'fundamentals'],
    ['kiến thức nâng cao', 'advanced topics'],
    ['cần hiểu', 'needed to understand'],
    ['bài tập', 'exercises'],
    ['thực hành', 'practice'],
    ['nâng cao', 'advanced'],
    ['cơ bản', 'basics'],
    ['chuyên sâu', 'deep dive'],
    ['hiện tượng', 'symptom'],
    ['nguyên nhân', 'root cause'],
    ['cách xử lý', 'solution'],
    ['kiểm tra', 'inspect / verify'],
    ['thay thế', 'replace'],
    ['chương trình plc', 'PLC program'],
    ['bị lỗi', 'faulted'],
    ['sau đó', 'then'],
    ['trước khi', 'before'],
    ['chờ', 'wait'],
    ['ngừng', 'stop'],
    ['đóng', 'close'],
    ['mở', 'open'],
    ['chạy', 'run'],
    ['nhưng', 'however'],
    ['hoặc', 'or'],
    ['và', 'and'],
    ['như', 'such as'],
    ['một', 'a'],
    ['các', ''],
    ['những', ''],
    ['này', 'this'],
    ['giúp', 'helps'],
    ['để', 'to'],
    ['khi', 'when'],
    ['nếu', 'if'],
    ['từ', 'from'],
    ['sang', 'to'],
    ['theo', 'by'],
    ['về', 'about'],
    ['trên', 'on'],
    ['dưới', 'below'],
    ['lên', 'to'],
    ['vào', 'into'],
    ['ra', 'out'],
    ['của', 'of'],
    ['là', 'is'],
    ['có', 'has'],
  ];

  // -------------------------------------------------------------------------
  // URL / Asset Path Resolver (Static GitHub Pages subpath safe)
  // -------------------------------------------------------------------------
  function _isStaticHostedContext() {
    if (_mode === 'offline') return true;
    if (typeof document !== 'undefined' && document.querySelector('meta[name="mrl-build"]')) return true;
    if (typeof location !== 'undefined') {
      const segs = location.pathname.split('/').filter(Boolean);
      if (segs.length > 0 && !location.port) return true;
    }
    return false;
  }

  function resolveAssetUrl(rawUrl) {
    const s = String(rawUrl || '').trim();
    if (!s) return '';
    if (
      s.startsWith('data:') ||
      s.startsWith('blob:') ||
      s.startsWith('http://') ||
      s.startsWith('https://') ||
      s.startsWith('./') ||
      s.startsWith('../')
    ) {
      return s;
    }
    if ((s.startsWith('/uploads/') || s.startsWith('/static/')) && _isStaticHostedContext()) {
      return `.${s}`;
    }
    return s;
  }
  window.resolveAssetUrl = resolveAssetUrl;

  function utcNowIso() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  function localDateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function localDateTimeStr(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  }

  function ensureIsoTs(val) {
    if (!val) return '';
    const s = String(val).trim();
    if (!s) return '';
    if (s.includes('T')) return s.endsWith('Z') || s.slice(10).includes('+') ? s : `${s}Z`;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) return `${s.slice(0, 19).replace(' ', 'T')}Z`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00Z`;
    return s;
  }

  function parseTs(val) {
    if (!val) return 0;
    const raw = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
      const msLocal = Date.parse(raw.replace(' ', 'T'));
      if (!Number.isNaN(msLocal)) return msLocal;
    }
    const iso = ensureIsoTs(raw);
    if (!iso) return 0;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? 0 : ms;
  }

  // -------------------------------------------------------------------------
  // IndexedDB + LocalStorage Persistence
  // -------------------------------------------------------------------------
  function _openIdb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('No IndexedDB'));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IDB open error'));
    });
  }

  async function _idbGet(key) {
    try {
      const db = await _openIdb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      try {
        const raw = localStorage.getItem(`mrl-idb-${key}`);
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    }
  }

  async function _idbSet(key, val) {
    try {
      const db = await _openIdb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(val, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      try {
        localStorage.setItem(`mrl-idb-${key}`, JSON.stringify(val));
      } catch (_) { /* quota ignored */ }
    }
  }

  // -------------------------------------------------------------------------
  // Snapshot Normalization, Metadata & SRS Recomputation
  // -------------------------------------------------------------------------
  function _jsonResponse(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  function _normalizeStatus(code) {
    const k = String(code || 'review').trim().toLowerCase();
    const mapped = STATUS_LABELS[k] ? k : 'unclassified';
    return [mapped, STATUS_LABELS[mapped]];
  }

  function _computeSrsCounts(cards) {
    const nowMs = Date.now();
    const counts = { due_now: 0, new: 0, learning: 0, review: 0, mastered: 0, total: (cards || []).length };
    (cards || []).forEach((c) => {
      const st = c.srs_stage || 'new';
      counts[st] = (counts[st] || 0) + 1;
      const nxtMs = parseTs(c.next_review_at);
      const isDue = st === 'learning' || (st === 'review' && (!nxtMs || nxtMs <= nowMs));
      c.is_due = isDue;
      if (isDue) counts.due_now += 1;
    });
    return counts;
  }

  function _computeStreakSummary(logs, dailyGoal = 15) {
    const byDate = new Map();
    (logs || []).forEach((r) => {
      if (r && r.study_date) byDate.set(r.study_date, r);
    });
    const todayKey = localDateKey(new Date());
    const todayRec = byDate.get(todayKey) || { cards_reviewed: 0, combat_completed: 0, xp_earned: 0 };
    const todayDone = Number(todayRec.cards_reviewed || 0) + Number(todayRec.combat_completed || 0);

    let currentStreak = 0;
    const cursor = new Date();
    if (todayDone === 0) cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 365; i += 1) {
      const k = localDateKey(cursor);
      const r = byDate.get(k);
      const done = r ? Number(r.cards_reviewed || 0) + Number(r.combat_completed || 0) : 0;
      if (done > 0) {
        currentStreak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    const weekDays = [];
    const dow = (new Date().getDay() + 6) % 7; // 0 = Mon
    const monday = new Date();
    monday.setDate(monday.getDate() - dow);
    const viLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const enLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const k = localDateKey(d);
      const r = byDate.get(k);
      const totalDone = r ? Number(r.cards_reviewed || 0) + Number(r.combat_completed || 0) : 0;
      weekDays.push({
        date: k,
        label_vi: viLabels[i],
        label_en: enLabels[i],
        studied: totalDone > 0,
        is_today: k === todayKey,
        is_future: k > todayKey,
        total_done: totalDone,
      });
    }

    return {
      current_streak: currentStreak,
      longest_streak: Math.max(currentStreak, ...Array.from(byDate.values()).map(() => currentStreak), 0),
      daily_goal: dailyGoal,
      today_done: todayDone,
      goal_reached: todayDone >= dailyGoal,
      week_days: weekDays,
    };
  }

  function _refreshDerivedFields(snap) {
    if (!snap || typeof snap !== 'object') return snap;
    const reps = snap.repair_cases || [];
    const knws = snap.knowledge_items || [];
    const plcs = snap.plc_notes || [];
    const nets = snap.network_notes || [];
    const all = [...reps, ...knws, ...plcs, ...nets];
    const stCounts = { mastered: 0, review: 0, researching: 0, unclassified: 0 };
    all.forEach((r) => {
      const sc = r.status_code || 'unclassified';
      stCounts[sc] = (stCounts[sc] || 0) + 1;
    });
    const catCounts = {};
    reps.forEach((r) => { catCounts[r.device_category] = (catCounts[r.device_category] || 0) + 1; });
    const grpCounts = {};
    knws.forEach((k) => { grpCounts[k.source_group] = (grpCounts[k.source_group] || 0) + 1; });

    const compMap = {};
    const faultMap = {};
    reps.forEach((r) => {
      (r.component_tags || []).forEach((t) => {
        if (!compMap[t]) compMap[t] = { tag: t, repair_count: 0, knowledge_count: 0, total: 0 };
        compMap[t].repair_count += 1;
        compMap[t].total += 1;
      });
      (r.fault_codes || []).forEach((f) => {
        if (!faultMap[f]) faultMap[f] = { tag: f, repair_count: 0, knowledge_count: 0, total: 0 };
        faultMap[f].repair_count += 1;
        faultMap[f].total += 1;
      });
    });
    knws.forEach((k) => {
      (k.component_tags || []).forEach((t) => {
        if (!compMap[t]) compMap[t] = { tag: t, repair_count: 0, knowledge_count: 0, total: 0 };
        compMap[t].knowledge_count += 1;
        compMap[t].total += 1;
      });
    });

    snap.metadata = {
      ...(snap.metadata || {}),
      total_records: all.length,
      total_repair_cases: reps.length,
      total_knowledge_items: knws.length,
      total_plc_notes: plcs.length,
      total_network_notes: nets.length,
      status_counts: stCounts,
      category_counts: catCounts,
      source_group_counts: grpCounts,
      generated_at: utcNowIso(),
    };
    snap.tags_dictionary = {
      component_tags: Object.values(compMap).sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag)),
      fault_codes: Object.values(faultMap).sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag)),
    };
    snap.srs_counts = _computeSrsCounts(snap.english_cards || []);
    snap.english_streak = _computeStreakSummary(snap.english_streak_logs || []);

    const cards = snap.english_cards || [];
    snap.english_vocab = cards.map((c, i) => ({
      id: c.id || `EV-${i + 1}`,
      term_or_chunk: c.term,
      pronunciation: c.ipa || '',
      category: c.category || 'PLC & Tự động hóa',
      meaning_vi: c.meaning_vi || '',
      example_en: c.example_en || '',
      example_vi: c.example_vi || '',
      source_ref: c.linked_record_id || '',
      status_code: c.srs_stage === 'mastered' ? 'mastered' : (c.srs_stage === 'new' ? 'researching' : 'review'),
    }));
    snap.en_vocabulary = cards.map((c, i) => ({
      id: i + 1,
      card_id: c.id,
      vi_term: c.meaning_vi || '',
      en_term: c.term || '',
      category: c.category || 'TECH',
      example_vi: c.example_vi || '',
      example_en: c.example_en || '',
      source_ref: c.linked_record_id || '',
      rating: c.srs_stage === 'mastered' ? 'mastered' : (c.srs_stage === 'new' ? 'researching' : 'review'),
    }));
    return snap;
  }

  function _bootstrapPayloadFromSnap(snap) {
    _refreshDerivedFields(snap);
    const aiCfg = getAiConfig();
    const syncCfg = getSyncConfig();
    return {
      ...snap,
      has_gemini_key: Boolean(aiCfg.gemini_api_key),
      gemini_model: aiCfg.gemini_model || 'gemini-2.0-flash',
      cloud_sync: {
        has_token: Boolean(syncCfg.github_token),
        gist_id: syncCfg.gist_id || '',
        auto_sync: syncCfg.auto_sync !== false,
        last_sync_at: syncCfg.last_sync_at || '',
        last_sync_status: syncCfg.last_sync_status || '',
      },
    };
  }

  async function _fetchInitialSeed() {
    for (const url of SEED_URL_CANDIDATES) {
      try {
        const res = await _nativeFetch(url, { cache: 'no-cache' });
        if (!res.ok) continue;
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('json') && !url.endsWith('.json')) continue;
        const parsed = await res.json();
        if (parsed && Array.isArray(parsed.repair_cases)) return parsed;
      } catch (_) { /* next candidate */ }
    }
    return {
      schema_version: 2,
      exported_at: utcNowIso(),
      repair_cases: [],
      knowledge_items: [],
      plc_notes: [],
      network_notes: [],
      english_cards: [],
      english_combat_drills: [],
      english_quizzes: [],
      english_streak_logs: [],
      scratchpads: {
        mrl: { workspace: 'mrl', content: '', images_json: [], font_mode: 'sans', updated_at: '' },
        plc: { workspace: 'plc', content: '', images_json: [], font_mode: 'sans', updated_at: '' },
        network: { workspace: 'network', content: '', images_json: [], font_mode: 'sans', updated_at: '' },
        english: { workspace: 'english', content: '', images_json: [], font_mode: 'sans', updated_at: '' },
      },
      review_progress: {},
      workspace_categories: {},
      en_glossary: [],
      translation_cache: { vi2en: {}, en2vi: {} },
      tombstones: {},
    };
  }

  function _mergeTranslationMaps(target, incoming) {
    const out = {
      vi2en: { ...(target?.vi2en || {}) },
      en2vi: { ...(target?.en2vi || {}) },
    };
    if (incoming && typeof incoming === 'object') {
      Object.entries(incoming.vi2en || {}).forEach(([k, v]) => {
        if (k && v && !out.vi2en[k]) out.vi2en[k] = v;
      });
      Object.entries(incoming.en2vi || {}).forEach(([k, v]) => {
        if (k && v && !out.en2vi[k]) out.en2vi[k] = v;
      });
    }
    return out;
  }

  async function ensureLocalSnapshot() {
    if (_snapshot) return _snapshot;
    let stored = await _idbGet('snapshot');
    if (!stored || !Array.isArray(stored.repair_cases)) {
      stored = await _fetchInitialSeed();
      _refreshDerivedFields(stored);
      await _idbSet('snapshot', stored);
    } else {
      const needGlossary = !Array.isArray(stored.en_glossary) || stored.en_glossary.length === 0;
      const needTrans = !stored.translation_cache || Object.keys(stored.translation_cache.vi2en || {}).length === 0;
      if (needGlossary || needTrans) {
        const seed = await _fetchInitialSeed();
        if (needGlossary && Array.isArray(seed.en_glossary) && seed.en_glossary.length) {
          stored.en_glossary = seed.en_glossary;
        }
        if (seed.translation_cache) {
          stored.translation_cache = _mergeTranslationMaps(stored.translation_cache, seed.translation_cache);
        }
        _refreshDerivedFields(stored);
        await _idbSet('snapshot', stored);
      } else {
        _refreshDerivedFields(stored);
      }
    }
    _snapshot = stored;
    return _snapshot;
  }

  async function saveLocalSnapshot(snap, scheduleSync = true) {
    snap.exported_at = utcNowIso();
    _refreshDerivedFields(snap);
    _snapshot = snap;
    await _idbSet('snapshot', snap);
    if (scheduleSync) {
      if (_mode === 'offline') _setUnsyncedFlag(true);
      scheduleAutoPush();
    }
    return snap;
  }

  // -------------------------------------------------------------------------
  // Image / Camera Compressor (works directly on Mobile Back Camera)
  // -------------------------------------------------------------------------
  async function _fileToCompressedDataUrl(file) {
    if (!file) return '';
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const rawUrl = String(reader.result || '');
        if (!rawUrl.startsWith('data:image/')) {
          resolve(rawUrl);
          return;
        }
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let w = img.naturalWidth || img.width || 800;
          let h = img.naturalHeight || img.height || 600;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.max(1, Math.round(w * ratio));
            h = Math.max(1, Math.round(h * ratio));
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          try {
            resolve(canvas.toDataURL('image/jpeg', 0.78));
          } catch (_) {
            resolve(rawUrl);
          }
        };
        img.onerror = () => resolve(rawUrl);
        img.src = rawUrl;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  // -------------------------------------------------------------------------
  // AI Config & Gemini Client (Direct Browser Offline Fallback)
  // -------------------------------------------------------------------------
  function getAiConfig() {
    try {
      const raw = localStorage.getItem(AI_CFG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore */ }
    return { gemini_api_key: '', gemini_model: 'gemini-2.0-flash' };
  }

  function saveAiConfig(key, model) {
    const prev = getAiConfig();
    const nextKey = key === '__KEEP__' ? (prev.gemini_api_key || '') : String(key || '').trim();
    const nextModel = String(model || prev.gemini_model || 'gemini-2.0-flash').trim() || 'gemini-2.0-flash';
    try { localStorage.setItem(AI_CFG_KEY, JSON.stringify({ gemini_api_key: nextKey, gemini_model: nextModel })); } catch (_) {}
    return { gemini_api_key: nextKey, gemini_model: nextModel };
  }

  async function _callGeminiJsonDirect(promptText, overrideKey = '') {
    const cfg = getAiConfig();
    const key = String(overrideKey || cfg.gemini_api_key || '').trim();
    if (!key) return null;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
    const model = cfg.gemini_model || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (_) {} }, 18000) : null;
    try {
      const fetchOpts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.35, responseMimeType: 'application/json' },
        }),
      };
      if (ctrl) fetchOpts.signal = ctrl.signal;
      const res = await _nativeFetch(url, fetchOpts);
      if (!res.ok) return null;
      const data = await res.json();
      const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const m = txt.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      return m ? JSON.parse(m[1]) : JSON.parse(txt);
    } catch (_) {
      return null;
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  }

  // -------------------------------------------------------------------------
  // Flashcard Hybrid Grader (Offline Rubric + Direct-Gemini 2-Tier Parity)
  // -------------------------------------------------------------------------
  const _FC_SYNONYM_GROUPS = [
    ['vo han', 'vo thoi han', 'lien tuc', 'khong dung', 'lap vo tan', 'lap lien tuc', 'vong lap vo han'],
    ['ngat', 'dung', 'cat', 'interrupt', 'stop', 'trip'],
    ['chap', 'ngan mach', 'thong mach', 'noi tat', 'short', 'short circuit'],
    ['dut', 'ho mach', 'mat ket noi', 'open circuit', 'mat tin hieu'],
    ['bien tan', 'vfd', 'inverter', 'drive'],
    ['dien tro dau cuoi', 'dien tro 120', '120 ohm', '120ohm', 'termination resistor', 'tro 120'],
    ['vong quet', 'scan cycle', 'chu ky quet', 'chu trinh quet'],
    ['khoi ham', 'function block', 'fb'],
    ['khoi to chuc', 'organization block', 'ob'],
    ['vung nho', 'data block', 'db', 'bo nho'],
    ['nguon', 'cap nguon', 'dien ap', 'power', 'supply', 'dc bus'],
    ['qua dong', 'overcurrent', 'oc'],
    ['qua ap', 'overvoltage', 'ov'],
    ['thap ap', 'undervoltage', 'uv'],
    ['qua tai', 'overload', 'ol'],
    ['tu tren xuong duoi', 'tren xuong duoi', 'tuan tu', 'tu trai sang phai', 'theo thu tu'],
    ['cach ly', 'quang', 'opto', 'optocoupler', 'isolation'],
    ['xung kich', 'gate', 'gate drive', 'kich gate'],
    ['nhieu', 'emi', 'chong nhieu', 'stp', 'noi mass', 'tiep dia', 'shield'],
    ['khoi tao', 'init', 'startup', 'ob100'],
    ['ngat chu ky', 'cyclic interrupt', 'ob30', 'ob35', 'thoi gian lay mau', 'sampling time'],
    ['loi phan cung', 'loi rack', 'loi module', 'ob86', 'ob82', 'diagnostic'],
    ['dau vao', 'input'],
    ['dau ra', 'output'],
    ['rs485', 'rs-485'],
    ['s7-1200', 's7 1200', 's71200'],
    ['s7-1500', 's7 1500', 's71500'],
    ['canopen', 'can open'],
    ['canbus', 'can bus'],
  ];

  const _FC_STOPWORDS = new Set([
    'va', 'hoac', 'cua', 'la', 'de', 'khi', 'neu', 'thi', 'se', 'duoc', 'bi', 'co',
    'khong', 'cac', 'nhung', 'mot', 'trong', 'tren', 'duoi', 'tai', 'voi', 'cho', 'tu',
    'sang', 'vao', 'ra', 'rat', 'can', 'phai', 'nen', 'nay', 'do', 'thuong', 'hay',
    'dang', 'da', 'lam', 'gay', 'giup', 'dung', 'bang', 'theo', 've', 'nhu', 'ma',
    'boi', 'vi', 'moi', 'tung', 'nhieu', 'it', 'qua', 'lai', 'xong', 'con', 'su',
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'onto', 'are', 'is',
    'nguyen', 'nhan', 'xu', 'ly', 'cach', 'muc', 'buoc', 'note',
  ]);

  const _FC_TECH_TOKEN_RE = /(?:\b0x[0-9A-Fa-f]+(?::[0-9A-Fa-f]+)?\b|\b(?:OB|FB|FC|DB|UDT)\d*\b|\b(?:NORM_X|SCALE_X|S7-\d+|RS-?485|RS-?232|CANopen|CANbus|EtherCAT|PROFINET|PROFIBUS|Modbus|IGBT|MOSFET|SMPS|VFD|HMI|PLC|CPU|PID|PWM|SCL|LAD|FBD|PDO|SDO|ESI|WKC|SAFE-OP|PRE-OP)\b|\b[A-Z]\d{3,}[A-Z0-9/-]*\b|\b(?:oPE|oL|oC|oV|uV|EF)\d*\b|\b\d+(?:\.\d+)?(?:\s*[-~]\s*\d+(?:\.\d+)?)?\s*(?:ms|us|Hz|kHz|mA|VDC|VAC|kW|Ω|ohm|kΩ|uF|nF|kbps|Mbps|bps|bar)\b)/gi;

  function _fcStripAccents(text) {
    return String(text || '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[Ωω]/g, ' ohm ')
      .replace(/[μµ]/g, 'u')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_.\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function _fcEscapeRe(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function _fcComputeRating(overallScore, hasCriticalError = false) {
    if (hasCriticalError || overallScore < 60) return 'forgot';
    if (overallScore < 85) return 'fuzzy';
    return 'solid';
  }

  function _fcExtractRubricConcepts(referenceAnswer) {
    const raw = String(referenceAnswer || '').trim();
    if (!raw) return [];
    const concepts = [];
    const seenNorm = new Set();

    const addConcept = (label) => {
      const clean = String(label || '')
        .replace(/\s+/g, ' ')
        .replace(/^[\s.,;:!?•\-*]+|[\s.,;:!?•\-*]+$/g, '');
      if (!clean || clean.length < 2) return;
      const norm = _fcStripAccents(clean);
      if (!norm || seenNorm.has(norm)) return;
      const words = norm.split(' ').filter((w) => !_FC_STOPWORDS.has(w));
      if (!words.length && norm.length < 2) return;
      seenNorm.add(norm);
      concepts.push(clean);
    };

    const reTok = new RegExp(_FC_TECH_TOKEN_RE.source, 'gi');
    let m;
    while ((m = reTok.exec(raw)) !== null) {
      const tok = m[0].trim();
      if (tok.length >= 2) addConcept(tok);
      if (concepts.length >= 3) break;
    }

    const clauses = raw.split(/[\n.;,()→]|->|\s+:\s+|:\s+/);
    for (const cl of clauses) {
      if (concepts.length >= 6) break;
      const cleaned = cl
        .replace(/^\s*(?:\d+[\.\)]\s+|[•\-*]\s+|nguyên\s+nhân\s*:|xử\s+lý\s*:|note\s*:)\s*/i, '')
        .trim();
      if (!cleaned) continue;
      const rawWords = cleaned.split(/\s+/);
      while (rawWords.length && _FC_STOPWORDS.has(_fcStripAccents(rawWords[0]))) rawWords.shift();
      while (rawWords.length && _FC_STOPWORDS.has(_fcStripAccents(rawWords[rawWords.length - 1]))) rawWords.pop();
      if (!rawWords.length) continue;

      const nonCodeWords = rawWords.filter((w) => !seenNorm.has(_fcStripAccents(w)));
      if (nonCodeWords.length < rawWords.length && nonCodeWords.length <= 1) continue;

      const joined = rawWords.join(' ');
      if (rawWords.length <= 6 && joined.length <= 38) {
        const candNorm = _fcStripAccents(joined);
        if (!seenNorm.has(candNorm) && !(rawWords.length === 1 && _FC_STOPWORDS.has(candNorm))) {
          addConcept(joined);
        }
      } else {
        const step = 4;
        for (let i = 0; i < rawWords.length; i += step) {
          if (concepts.length >= 6) break;
          const chunkWords = rawWords.slice(i, i + step);
          while (chunkWords.length && _FC_STOPWORDS.has(_fcStripAccents(chunkWords[0]))) chunkWords.shift();
          while (chunkWords.length && _FC_STOPWORDS.has(_fcStripAccents(chunkWords[chunkWords.length - 1]))) chunkWords.pop();
          if (chunkWords.length >= 2) {
            addConcept(chunkWords.join(' ').slice(0, 38).trim());
          }
        }
      }
    }

    if (concepts.length < 3) {
      const allWords = raw.split(/\s+/).map((w) => w.replace(/^[.,;:!?()[\]{}"']+|[.,;:!?()[\]{}"']+$/g, ''));
      const meaningful = allWords.filter((w) => w.length >= 2 && !_FC_STOPWORDS.has(_fcStripAccents(w)));
      for (let i = 0; i < meaningful.length; i += 2) {
        if (concepts.length >= 4) break;
        addConcept(meaningful.slice(i, i + 2).join(' '));
      }
    }

    return concepts.slice(0, 6);
  }

  function _fcPhraseInText(phraseNorm, textNorm) {
    if (!phraseNorm || !textNorm) return false;
    if (phraseNorm.length <= 6 || (!phraseNorm.includes(' ') && /[0-9]/.test(phraseNorm))) {
      const pat = new RegExp(`(?<![a-z0-9])${_fcEscapeRe(phraseNorm)}(?![a-z0-9])`);
      return pat.test(textNorm);
    }
    return textNorm.includes(phraseNorm);
  }

  function _fcMatchConcept(concept, userNorm) {
    const cNorm = _fcStripAccents(concept);
    if (!cNorm || !userNorm) return false;
    if (_fcPhraseInText(cNorm, userNorm)) return true;
    if (cNorm.includes('-') && _fcPhraseInText(cNorm.replace(/-/g, ''), userNorm.replace(/-/g, ''))) return true;

    for (const grp of _FC_SYNONYM_GROUPS) {
      if (grp.some((p) => _fcPhraseInText(p, cNorm)) && grp.some((p) => _fcPhraseInText(p, userNorm))) {
        return true;
      }
    }

    const cWords = cNorm.split(' ').filter((w) => w.length >= 2 && !_FC_STOPWORDS.has(w));
    if (cWords.length >= 2) {
      let hits = 0;
      for (const w of cWords) {
        if (_fcPhraseInText(w, userNorm)) {
          hits += 1;
          continue;
        }
        const synHit = _FC_SYNONYM_GROUPS.some((grp) => grp.includes(w) && grp.some((p) => _fcPhraseInText(p, userNorm)));
        if (synHit) hits += 1;
      }
      if (hits / cWords.length >= 0.65) return true;
    }

    return false;
  }

  function evaluateFlashcardOfflineJS(referenceAnswer, userAnswer) {
    const concepts = _fcExtractRubricConcepts(referenceAnswer);
    const userNorm = _fcStripAccents(userAnswer);
    const rubric = [];
    const matched = [];
    const missing = [];

    concepts.forEach((c) => {
      const hit = Boolean(userNorm) && _fcMatchConcept(c, userNorm);
      rubric.push({ label: c, hit });
      if (hit) matched.push(c);
      else missing.push(c);
    });

    const total = rubric.length;
    const noteScore = total > 0 ? Math.round((matched.length / total) * 100) : (userNorm ? 100 : 0);
    const rating = _fcComputeRating(noteScore, false);
    let verdict = 'Bạn chưa nhập câu trả lời — hãy gõ nhanh ý chính rồi bấm Chấm lại.';
    if (userNorm) {
      if (noteScore >= 85) verdict = `Khớp rất tốt ${matched.length}/${total} ý lõi trong bài gốc (Offline Rubric).`;
      else if (noteScore >= 60) verdict = `Đã nắm ${matched.length}/${total} ý chính — cần bổ sung thêm ${missing.length} ý còn thiếu.`;
      else verdict = `Mới khớp ${matched.length}/${total} ý lõi — nên xem lại bài gốc hoặc chấm 2 tầng AI.`;
    }

    return {
      engine: 'offline',
      note_match_score: noteScore,
      tech_accuracy_score: null,
      overall_score: noteScore,
      has_critical_tech_error: false,
      suggested_rating: rating,
      verdict,
      matched_points: matched,
      missing_vs_note: missing,
      tech_corrections: [],
      interview_supplement: '',
      rubric_concepts: rubric,
    };
  }

  function _buildFlashcardGeminiPromptJS(payload) {
    return (
      'You are a Senior Industrial Automation & Electronics Engineer (Siemens TIA Portal S7-1200/1500, VFD/IGBT/PCBA repair, Modbus/Profinet/CANopen/EtherCAT).\n' +
      'Evaluate the learner\'s Vietnamese/English technical recall answer on TWO INDEPENDENT TIERS:\n' +
      '1. note_match_score (0-100): How well the user\'s answer matches the key points of reference_answer (their personal note), including minor typos/phrasing differences.\n' +
      '2. tech_accuracy_score (0-100): Objective real-world industrial engineering accuracy (even if the personal note is brief/incomplete, recognize valid engineering facts and strictly flag real technical misconceptions).\n' +
      'Rules:\n' +
      '- Set has_critical_tech_error=true ONLY if the user states a dangerous/wrong engineering fact.\n' +
      '- suggested_rating MUST follow: "forgot" if has_critical_tech_error or overall_score < 60; "fuzzy" if 60 <= overall_score < 85; "solid" if overall_score >= 85.\n' +
      '- Return ONLY valid JSON (Vietnamese text):\n' +
      '{\n' +
      '  "note_match_score": 0,\n' +
      '  "tech_accuracy_score": 0,\n' +
      '  "overall_score": 0,\n' +
      '  "has_critical_tech_error": false,\n' +
      '  "suggested_rating": "forgot|fuzzy|solid",\n' +
      '  "verdict": "Nhận xét ngắn gọn 1 câu bằng tiếng Việt",\n' +
      '  "matched_points": ["Ý đã trả lời đúng 1"],\n' +
      '  "missing_vs_note": ["Ý thiếu so với ghi chú gốc hoặc lỗi diễn đạt/gõ nhầm"],\n' +
      '  "tech_corrections": ["Điểm chưa chuẩn về mặt kỹ thuật thực tế (để mảng rỗng [] nếu đã chuẩn)"],\n' +
      '  "interview_supplement": "1-2 câu kiến thức gốc/chuẩn phỏng vấn thực chiến nên bổ sung vào sổ tay (để trống nếu ghi chú đã đầy đủ)",\n' +
      '  "rubric_concepts": [{"label": "Cụm ý lõi 2-5 từ", "hit": true}]\n' +
      '}\n\n' +
      `Item Kind: ${payload.item_kind || ''} | ID: ${payload.item_id || ''}\n` +
      `Record Title: ${payload.record_title || ''}\n` +
      `Section Title: ${payload.section_title || ''}\n` +
      `Question:\n${payload.question || ''}\n\n` +
      `Personal Reference Note:\n${payload.reference_answer || ''}\n\n` +
      `User Answer:\n${payload.user_answer || ''}`
    );
  }

  function _normalizeGeminiFlashcardEval(aiOut, offlineRes) {
    const clamp = (v, defVal) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : defVal;
    };
    const noteSc = clamp(aiOut.note_match_score, offlineRes.note_match_score);
    const techSc = clamp(aiOut.tech_accuracy_score, noteSc);
    const hasCrit = Boolean(aiOut.has_critical_tech_error);
    let overall = clamp(aiOut.overall_score, Math.round(noteSc * 0.55 + techSc * 0.45));
    if (hasCrit && overall >= 60) overall = Math.min(overall, 55);
    const rating = _fcComputeRating(overall, hasCrit);
    const strArr = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 6) : []);
    let rubric = [];
    if (Array.isArray(aiOut.rubric_concepts)) {
      rubric = aiOut.rubric_concepts
        .filter((r) => r && String(r.label || '').trim())
        .slice(0, 6)
        .map((r) => ({ label: String(r.label).trim(), hit: Boolean(r.hit) }));
    }
    if (!rubric.length) rubric = offlineRes.rubric_concepts;

    return {
      engine: 'gemini',
      note_match_score: noteSc,
      tech_accuracy_score: techSc,
      overall_score: overall,
      has_critical_tech_error: hasCrit,
      suggested_rating: rating,
      verdict: String(aiOut.verdict || offlineRes.verdict).trim(),
      matched_points: strArr(aiOut.matched_points).length ? strArr(aiOut.matched_points) : offlineRes.matched_points,
      missing_vs_note: strArr(aiOut.missing_vs_note),
      tech_corrections: strArr(aiOut.tech_corrections),
      interview_supplement: String(aiOut.interview_supplement || '').trim(),
      rubric_concepts: rubric,
    };
  }

  function buildFlashcardFollowUpOfflineJS(itemKind, recordTitle, question, referenceAnswer) {
    const kind = String(itemKind || '').trim().toLowerCase();
    const title = String(recordTitle || 'thiết bị/khối này').trim();
    const refNorm = _fcStripAccents(referenceAnswer);

    if (kind === 'repair') {
      return {
        engine: 'offline',
        focus_tag: 'ĐO NGUỘI & CÔ LẬP LỖI',
        followup_question: `Khi sửa ca "${title}", trước khi đóng nguồn AC/DC bus, bạn đo nguội những điểm nào để cô lập lỗi và tránh nổ linh kiện thay mới?`,
        model_answer:
          '1. Đo diode/thông mạch 2 chiều trên cầu chỉnh lưu, DC bus (+)/(-) và 6 nhánh IGBT/MOSFET để loại trừ chập công suất.\n' +
          '2. Tháo/cách ly tải hoặc IC công suất, cấp nguồn nuôi thấp dòng (qua bóng đèn nối tiếp/nguồn giới hạn dòng) đo kiểm nguồn xung SMPS và xung kích Gate (+15V / -8V).\n' +
          '3. Kiểm tra lại điện trở Gate, optocoupler (như A3120) và mạch hồi tiếp dòng/áp trước khi lắp lại công suất.',
      };
    }
    if (kind === 'plc') {
      if (refNorm.includes('ob') || refNorm.includes('scan') || refNorm.includes('vong quet')) {
        return {
          engine: 'offline',
          focus_tag: 'SCAN CYCLE & AN TOÀN CPU',
          followup_question: `Trong "${title}", nếu thời gian xử lý tăng đột biến vượt Watchdog hoặc xảy ra lỗi phần cứng/I/O, CPU S7-1200/1500 phản ứng ra sao và cần xử lý thế nào để không dừng dây chuyền ngoài ý muốn?`,
          model_answer:
            '1. Nếu vượt chu kỳ Watchdog (mặc định ~150ms) hoặc mất module/rack mà không có OB lỗi tương ứng (như OB80, OB82, OB86), CPU sẽ chuyển sang STOP.\n' +
            '2. Cần tách tác vụ chu kỳ chuẩn sang Cyclic Interrupt (OB30) và cài các OB chẩn đoán/ngắt lỗi để ghi nhận cảnh báo an toàn.\n' +
            '3. Tránh vòng lặp WHILE/FOR không giới hạn bên trong OB1 hoặc FB chính để giữ scan cycle ổn định.',
        };
      }
      return {
        engine: 'offline',
        focus_tag: 'INSTANCE DB & BẢO TRÌ PLC',
        followup_question: `Với "${title}", khi gọi lại nhiều lần cho nhiều động cơ/trạm hoặc khi download sửa đổi logic online, cần chú ý gì về vùng nhớ/Instance DB để tránh xung đột dữ liệu?`,
        model_answer:
          '1. Mỗi đối tượng độc lập dùng FB phải gán Instance DB riêng (hoặc Multi-instance trong FB cha) để không bị ghi đè biến Static (Timer/Edge trigger).\n' +
          '2. Dùng FC cho hàm tính toán không nhớ (stateless) và đặt biến tạm trong Temp phải luôn gán giá trị trước khi đọc.\n' +
          '3. Tránh thay đổi cấu trúc giao diện (Interface/Static) của DB đang chạy nếu không muốn bị reinitialize giá trị vận hành.',
      };
    }
    if (kind === 'network') {
      return {
        engine: 'offline',
        focus_tag: 'CHẨN ĐOÁN NHIỄU & TIMEOUT',
        followup_question: `Khi triển khai "${title}" ngoài tủ điện công nghiệp nhiều biến tần, nếu xuất hiện rớt gói ngẫu nhiên (timeout/CRC error), bạn kiểm tra lớp vật lý và tham số theo thứ tự nào?`,
        model_answer:
          '1. Lớp vật lý: kiểm tra cáp bọc chống nhiễu STP nối mass 1 đầu, đúng cực tính A+/B- hoặc CAN_H/CAN_L (hoặc chiều IN/OUT của EtherCAT) và điện trở đầu cuối 120Ω ở đúng 2 đầu tuyến.\n' +
          '2. Tham số truyền thông: đối chiếu đồng bộ Baudrate, Parity/Stop bit, Node ID không trùng lặp và chu kỳ polling/watchdog.\n' +
          '3. Khoanh vùng nhiễu: tách cáp tín hiệu khỏi cáp động lực 3 pha biến tần tối thiểu 20-30cm và kiểm tra bộ đếm lỗi/working counter.',
      };
    }
    return {
      engine: 'offline',
      focus_tag: 'PHẢN BIỆN NGUYÊN LÝ',
      followup_question: `Trong chủ đề "${title}", nếu bỏ qua hoặc làm sai bước cốt lõi trong ghi chú thì hậu quả kỹ thuật trực tiếp trên mạch / hệ thống là gì?`,
      model_answer:
        '1. Xác định điểm lỗi phát sinh ở tầng nguồn, tầng điều khiển hay tầng cách ly/tín hiệu hồi tiếp.\n' +
        '2. Luôn đối chiếu thông số đo thực tế (điện áp DC/AC, dạng sóng, trở kháng) với ngưỡng datasheet trước khi cấp tải.\n' +
        '3. Ghi nhận nguyên nhân gốc rễ để không chỉ sửa phần ngọn (chết lặp lại linh kiện mới thay).',
    };
  }

  function _buildFlashcardFollowUpGeminiPromptJS(payload) {
    return (
      'You are a Senior Industrial Automation & Electronics Engineer interviewing a candidate.\n' +
      'Based on the flashcard below, generate ONE sharp follow-up interview question probing real-world failure modes, diagnostics, safety, or architecture, plus a concise 3-4 line model answer.\n' +
      'Return ONLY valid JSON in Vietnamese:\n' +
      '{\n' +
      '  "focus_tag": "SHORT UPPERCASE TOPIC TAG (2-4 WORDS)",\n' +
      '  "followup_question": "1 câu hỏi xoáy thực chiến sắc bén bằng tiếng Việt",\n' +
      '  "model_answer": "Đáp án chuẩn 3-4 dòng súc tích, đúng kỹ thuật công nghiệp"\n' +
      '}\n\n' +
      `Item Kind: ${payload.item_kind || ''} | Title: ${payload.record_title || ''}\n` +
      `Original Question: ${payload.question || ''}\n` +
      `Reference Note: ${payload.reference_answer || ''}\n` +
      `User Answer: ${payload.user_answer || ''}`
    );
  }

  // -------------------------------------------------------------------------
  // Offline / Hybrid Technical Translation Engine (parity with backend)
  // -------------------------------------------------------------------------
  function _getLocalTransCache() {
    try {
      const raw = localStorage.getItem(TRANS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { vi2en: parsed.vi2en || {}, en2vi: parsed.en2vi || {} };
      }
    } catch (_) {}
    return { vi2en: {}, en2vi: {} };
  }

  function _saveLocalTransCache(dirKey, srcText, dstText) {
    if (!srcText || !dstText) return;
    try {
      const cur = _getLocalTransCache();
      cur[dirKey] = cur[dirKey] || {};
      cur[dirKey][srcText] = dstText;
      const keys = Object.keys(cur[dirKey]);
      if (keys.length > 600) {
        keys.slice(0, keys.length - 500).forEach((k) => { delete cur[dirKey][k]; });
      }
      localStorage.setItem(TRANS_CACHE_KEY, JSON.stringify(cur));
    } catch (_) {}
  }

  function _detectTextLang(text) {
    const clean = String(text || '').trim();
    if (!clean) return 'vi';
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(clean)) return 'vi';
    if (/\b(khong|duoc|chay|mach|nguon|vong|quet|cam|bien|thanh|ghi)\b/i.test(clean)) return 'vi';
    return 'en';
  }

  function _enVariants(enRaw) {
    const out = [];
    const raw = String(enRaw || '').trim();
    if (raw) out.push(raw);
    const noParen = raw.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
    if (noParen && noParen.length >= 4 && !out.includes(noParen)) out.push(noParen);
    const noDash = noParen.split(/\s*[—–]\s*/)[0].trim();
    if (noDash && noDash.length >= 4 && !out.includes(noDash)) out.push(noDash);
    noDash.split(/\s*\/\s*/).forEach((part) => {
      const p = part.trim();
      if (p && p.length >= 6 && !out.includes(p)) out.push(p);
    });
    return out;
  }

  function _combinedGlossary(snap) {
    const seen = new Set();
    const items = [];
    (snap.english_cards || []).forEach((c) => {
      const vi = String(c.meaning_vi || '').trim();
      const en = String(c.term || '').trim();
      if (vi && en && !seen.has(vi.toLowerCase())) {
        seen.add(vi.toLowerCase());
        items.push({ vi, en, category: c.category || 'VOCAB', note: c.example_en || '' });
      }
    });
    (snap.en_glossary || []).forEach((g) => {
      const vi = String(g.vi || '').trim();
      const en = String(g.en || '').trim();
      if (vi && en && !seen.has(vi.toLowerCase())) {
        seen.add(vi.toLowerCase());
        items.push({ vi, en, category: g.category || 'TECH', note: g.note || '' });
      }
    });
    items.sort((a, b) => b.vi.length - a.vi.length);
    return items;
  }

  function _escapeRx(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function _extractMatchingTerms(text, snap) {
    const clean = String(text || '').trim();
    if (!clean) return [];
    const lower = clean.toLowerCase();
    const glossary = _combinedGlossary(snap);
    const candidates = [];
    glossary.forEach((item) => {
      candidates.push([item.vi, item]);
      _enVariants(item.en).forEach((ev) => candidates.push([ev, item]));
    });
    candidates.sort((a, b) => b[0].length - a[0].length);

    const terms = [];
    const usedSpans = [];
    const seenPairs = new Set();
    for (const [phrase, item] of candidates) {
      const pLow = String(phrase || '').toLowerCase();
      if (pLow.length < 4) continue;
      const rx = new RegExp(`(?<!\\w)${_escapeRx(pLow)}(?!\\w)`, 'i');
      const m = rx.exec(lower);
      if (!m) continue;
      const start = m.index;
      const end = start + m[0].length;
      if (usedSpans.some(([s, e]) => !(end <= s || start >= e))) continue;
      const pk = `${item.vi.toLowerCase()}|${item.en.toLowerCase()}`;
      if (seenPairs.has(pk)) continue;
      seenPairs.add(pk);
      usedSpans.push([start, end]);
      terms.push({
        vi: item.vi,
        vi_canon: item.vi,
        en: item.en,
        category: item.category || 'TECH',
        note: item.note || '',
      });
      if (terms.length >= 12) break;
    }
    return terms;
  }

  function _lookupCachedTranslation(clean, sl, tl, snap) {
    const dirKey = `${sl}2${tl}`;
    const snapMap = (snap.translation_cache && snap.translation_cache[dirKey]) || {};
    const localMap = _getLocalTransCache()[dirKey] || {};
    const low = clean.toLowerCase();

    if (localMap[clean]) return localMap[clean];
    if (snapMap[clean]) return snapMap[clean];

    for (const m of [localMap, snapMap]) {
      for (const [k, v] of Object.entries(m)) {
        if (k.toLowerCase() === low && v) return v;
      }
    }
    return '';
  }

  function _offlineTechnicalTranslate(text, snap, sl, tl) {
    const clean = String(text || '').trim();
    if (!clean) return '';
    const glossary = _combinedGlossary(snap);
    if (tl === 'en') {
      let out = clean;
      const reps = [...glossary.map((g) => [g.vi, g.en]), ..._OFFLINE_PHRASE_MAP].sort((a, b) => b[0].length - a[0].length);
      reps.forEach(([viP, enP]) => {
        if (!viP) return;
        const rx = new RegExp(`(?<![\\p{L}\\p{N}_])${_escapeRx(viP)}(?![\\p{L}\\p{N}_])`, 'giu');
        out = out.replace(rx, enP ? ` ${enP} ` : ' ');
      });
      out = out.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
      return out ? out.charAt(0).toUpperCase() + out.slice(1) : clean;
    }
    let outVi = clean;
    const enReps = glossary.slice().sort((a, b) => b.en.length - a.en.length);
    enReps.forEach((g) => {
      _enVariants(g.en).forEach((ev) => {
        if (ev.length < 4) return;
        const rx = new RegExp(`(?<!\\w)${_escapeRx(ev)}(?!\\w)`, 'gi');
        outVi = outVi.replace(rx, g.vi);
      });
    });
    return outVi.replace(/\s+/g, ' ').trim();
  }

  async function _tryPublicCorsTranslate(clean, sl, tl) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return '';
    if (!clean || clean.length > 420) return '';
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 2400) : null;
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=${encodeURIComponent(`${sl}|${tl}`)}`;
      const res = await _nativeFetch(url, { signal: ctrl ? ctrl.signal : undefined });
      if (timer) clearTimeout(timer);
      if (!res.ok) return '';
      const data = await res.json();
      const tr = String(data?.responseData?.translatedText || '').trim();
      if (!tr || tr.toUpperCase().includes('MYMEMORY WARNING') || tr.toLowerCase() === clean.toLowerCase()) return '';
      return tr;
    } catch (_) {
      if (timer) clearTimeout(timer);
      return '';
    }
  }

  function _resolveTranslateLangPair(clean, sourceLang, targetLang) {
    let sl = String(sourceLang || 'auto').toLowerCase().trim();
    let tl = String(targetLang || 'auto').toLowerCase().trim();
    if (tl === 'vi' || tl === 'en') {
      if ((sl !== 'vi' && sl !== 'en') || sl === tl) sl = tl === 'vi' ? 'en' : 'vi';
    } else {
      if (sl !== 'vi' && sl !== 'en') sl = _detectTextLang(clean);
      tl = sl === 'vi' ? 'en' : 'vi';
    }
    return [sl, tl];
  }

  function _formatTranslateResult(clean, sl, tl, outTxt, terms, cached) {
    return {
      vi: sl === 'vi' ? clean : outTxt,
      en: tl === 'en' ? outTxt : clean,
      source_lang: sl,
      target_lang: tl,
      source_text: clean,
      translated_text: outTxt,
      terms,
      cached: Boolean(cached),
    };
  }

  function _tryFastTranslateMatch(clean, sl, tl, snap, terms) {
    const glossary = _combinedGlossary(snap);
    const low = clean.toLowerCase();
    if (sl === 'vi' && tl === 'en') {
      for (const item of glossary) {
        if (item.vi.toLowerCase() === low) {
          return _formatTranslateResult(clean, sl, tl, item.en, terms, true);
        }
      }
    } else if (sl === 'en' && tl === 'vi') {
      for (const item of glossary) {
        if (_enVariants(item.en).some((ev) => ev.toLowerCase() === low)) {
          return _formatTranslateResult(clean, sl, tl, item.vi, terms, true);
        }
      }
    }
    const cachedHit = _lookupCachedTranslation(clean, sl, tl, snap);
    if (cachedHit) {
      return _formatTranslateResult(clean, sl, tl, cachedHit, terms, true);
    }
    return null;
  }

  async function _translateSingleOfflineOrHybrid(rawText, sourceLang, targetLang, snap) {
    const clean = String(rawText || '').trim();
    if (!clean) {
      return { vi: '', en: '', source_lang: 'vi', target_lang: 'en', source_text: '', translated_text: '', terms: [], cached: false };
    }
    const [sl, tl] = _resolveTranslateLangPair(clean, sourceLang, targetLang);
    const terms = _extractMatchingTerms(clean, snap);

    const fast = _tryFastTranslateMatch(clean, sl, tl, snap, terms);
    if (fast) return fast;

    let outTxt = '';
    const geminiOut = await _callGeminiJsonDirect(
      `Translate the following industrial automation / electronics engineering text from ${sl === 'vi' ? 'Vietnamese' : 'English'} to ${tl === 'en' ? 'Technical English' : 'Vietnamese'}.\nPreserve part numbers, fault codes, PLC blocks (OB1, DB1, FB, FC), and hex/register addresses.\nText: "${clean}"\nReturn JSON ONLY: {"translated": "<translation>"}`
    );
    if (geminiOut && typeof geminiOut.translated === 'string' && geminiOut.translated.trim()) {
      outTxt = geminiOut.translated.trim();
    } else {
      outTxt = await _tryPublicCorsTranslate(clean, sl, tl);
    }

    if (!outTxt) {
      outTxt = _offlineTechnicalTranslate(clean, snap, sl, tl);
    }
    if (outTxt) {
      _saveLocalTransCache(`${sl}2${tl}`, clean, outTxt);
    }
    return _formatTranslateResult(clean, sl, tl, outTxt || clean, terms, false);
  }

  async function _translateBatchOfflineOrHybrid(texts, sourceLang, targetLang, snap) {
    const list = (Array.isArray(texts) ? texts : []).slice(0, 120);
    const items = new Array(list.length);
    const misses = [];

    list.forEach((rawTxt, idx) => {
      const clean = String(rawTxt || '').trim();
      if (!clean) {
        items[idx] = { vi: '', en: '', source_lang: 'vi', target_lang: 'en', source_text: '', translated_text: '', terms: [], cached: false };
        return;
      }
      const [sl, tl] = _resolveTranslateLangPair(clean, sourceLang, targetLang);
      const terms = _extractMatchingTerms(clean, snap);
      const fast = _tryFastTranslateMatch(clean, sl, tl, snap, terms);
      if (fast) {
        items[idx] = fast;
      } else {
        misses.push({ idx, clean, sl, tl, terms });
      }
    });

    if (misses.length && getAiConfig().gemini_api_key) {
      for (let i = 0; i < misses.length; i += 35) {
        const chunk = misses.slice(i, i + 35);
        const promptList = chunk.map((m, k) => `${k}: ${m.clean}`).join('\n');
        const dirLabel = chunk[0].tl === 'en' ? 'Vietnamese to Technical English' : 'Technical English to Vietnamese';
        const aiArr = await _callGeminiJsonDirect(
          `Translate each numbered industrial engineering line from ${dirLabel}. Preserve technical symbols, fault codes, and PLC block names.\nLines:\n${promptList}\nReturn ONLY a JSON array of translated strings in the exact same order.`
        );
        if (Array.isArray(aiArr) && aiArr.length === chunk.length) {
          chunk.forEach((m, k) => {
            const tr = String(aiArr[k] || '').trim();
            if (tr) {
              _saveLocalTransCache(`${m.sl}2${m.tl}`, m.clean, tr);
              items[m.idx] = _formatTranslateResult(m.clean, m.sl, m.tl, tr, m.terms, false);
            }
          });
        }
      }
    }

    for (const m of misses) {
      if (items[m.idx]) continue;
      let outTxt = '';
      if (misses.length <= 12) {
        outTxt = await _tryPublicCorsTranslate(m.clean, m.sl, m.tl);
      }
      if (!outTxt) {
        outTxt = _offlineTechnicalTranslate(m.clean, snap, m.sl, m.tl);
      }
      if (outTxt) _saveLocalTransCache(`${m.sl}2${m.tl}`, m.clean, outTxt);
      items[m.idx] = _formatTranslateResult(m.clean, m.sl, m.tl, outTxt || m.clean, m.terms, false);
    }

    return { items };
  }

  // -------------------------------------------------------------------------
  // Local Offline /api/* Route Simulator (runs when PC backend is unreachable)
  // -------------------------------------------------------------------------
  function _nextSeqId(items, prefix) {
    let maxNum = 0;
    const pfx = `${prefix}-`;
    (items || []).forEach((it) => {
      const id = String(it.id || '');
      if (id.startsWith(pfx)) {
        const n = parseInt(id.slice(pfx.length), 10);
        if (!Number.isNaN(n) && n > maxNum) maxNum = n;
      }
    });
    return `${pfx}${String(maxNum + 1).padStart(3, '0')}`;
  }

  function _recordStreakHit(snap, cardsDelta = 0, combatDelta = 0, xpDelta = 10) {
    const today = localDateKey(new Date());
    snap.english_streak_logs = snap.english_streak_logs || [];
    let row = snap.english_streak_logs.find((r) => r.study_date === today);
    if (!row) {
      row = { study_date: today, cards_reviewed: 0, combat_completed: 0, xp_earned: 0, goal_reached: 0, updated_at: utcNowIso() };
      snap.english_streak_logs.push(row);
    }
    row.cards_reviewed = Number(row.cards_reviewed || 0) + cardsDelta;
    row.combat_completed = Number(row.combat_completed || 0) + combatDelta;
    row.xp_earned = Number(row.xp_earned || 0) + xpDelta;
    row.goal_reached = (row.cards_reviewed + row.combat_completed) >= 15 ? 1 : 0;
    row.updated_at = utcNowIso();
  }

  function _normalizeEnCat(raw, term = '') {
    const c = String(raw || '').trim();
    if ([
      'Giao tiếp & Hội thoại',
      'Lexical Chunks (Cụm từ nối)',
      'Biến tần & Phần cứng',
      'PLC & Tự động hóa',
      'Mạng truyền thông',
      'Giao tiếp Phỏng vấn',
    ].includes(c)) return c;
    const low = `${c} ${term}`.toLowerCase();
    if (/plc|ob\d|db\d|ladder|scl|scan cycle|hmi|tia|pid/.test(low)) return 'PLC & Tự động hóa';
    if (/modbus|profinet|profibus|ethercat|canopen|rs485|tcp|ip|terminating/.test(low)) return 'Mạng truyền thông';
    if (/interview|phỏng vấn|explain|describe|diagnos|troubleshoot/.test(low)) return 'Giao tiếp Phỏng vấn';
    if (/chunk|according to|in order to|prior to|make sure|when power/.test(low) || String(term).split(/\s+/).length >= 4) {
      return 'Lexical Chunks (Cụm từ nối)';
    }
    return 'Biến tần & Phần cứng';
  }

  const _REPAIR_COMP_TAG_RE = /\b(?:IGBT|MOSFET|IPM|SSR|Opto(?:coupler)?|Transistor|Diode|Varistor|Relay|PLC|HMI|MCU|CT|A3120|PC410L|74HC14|MC74HC14|74ALVT16245|HC165AG|ITS5215L|ITS716G|LTC3850|LTC3545|LM2576T?|LM393|LM239|UC3844|PS9151|HCNW2611|P721F|2FL\s*20U|FR\s*2T|CP10TD1|PS12014-A|STN3NF06L|A82C251Y|A1050\/C|CNY64|TLP181|AS29F040-55TC|A788J|A314J|IMZ4|2SA1213|LP3961ES|IS121|7LB179|T6816|LPC219|LS14250)\b/gi;
  const _REPAIR_FAULT_CODE_RE = /\b(?:oPE04|rr|oL1|EF4|CAL|Err\.14\.1|W66|RoPd|nst|ErH|oC|UV1|OC)\b/g;

  function _cleanCompTagsJS(list) {
    const out = new Set();
    (list || []).forEach((t) => {
      const c = String(t || '').trim().replace(/^#+/, '').toUpperCase();
      if (c) out.add(c);
    });
    return Array.from(out).sort();
  }

  function _cleanFaultCodesJS(list) {
    const out = new Set();
    (list || []).forEach((f) => {
      const c = String(f || '').trim().replace(/^#+/, '');
      if (c) out.add(c);
    });
    return Array.from(out).sort();
  }

  function _extractRepairTagsJS(fullText, extraComponents, extraFaults) {
    const text = String(fullText || '');
    const compSet = new Set(_cleanCompTagsJS(extraComponents));
    const faultSet = new Set(_cleanFaultCodesJS(extraFaults));
    let m;
    const compRe = new RegExp(_REPAIR_COMP_TAG_RE.source, 'gi');
    while ((m = compRe.exec(text)) !== null) {
      if (m[0]) compSet.add(m[0].toUpperCase());
    }
    const faultRe = new RegExp(_REPAIR_FAULT_CODE_RE.source, 'g');
    while ((m = faultRe.exec(text)) !== null) {
      if (m[0]) faultSet.add(m[0]);
    }
    return [Array.from(compSet).sort(), Array.from(faultSet).sort()];
  }

  function _formatRepairStepsRawJS(steps) {
    if (!steps || !steps.length) return ['', '', ''];
    if (steps.length === 1) {
      const s = steps[0];
      return [String(s.symptom || '').trim(), String(s.root_cause || '').trim(), String(s.solution || '').trim()];
    }
    const syms = [], causes = [], sols = [];
    steps.forEach((st, idx) => {
      const n = idx + 1;
      if (String(st.symptom || '').trim()) syms.push(`${n}. ${String(st.symptom).trim()}`);
      if (String(st.root_cause || '').trim()) causes.push(`${n}. ${String(st.root_cause).trim()}`);
      if (String(st.solution || '').trim()) sols.push(`${n}. ${String(st.solution).trim()}`);
    });
    return [syms.join('\n'), causes.join('\n'), sols.join('\n')];
  }

  function _normalizeRepairStepsJS(rawSteps, baseTs = Date.now()) {
    return (rawSteps || [])
      .map((s) => ({
        symptom: String(s?.symptom || '').trim(),
        root_cause: String(s?.root_cause || '').trim(),
        solution: String(s?.solution || '').trim(),
      }))
      .filter((s) => s.symptom || s.root_cause || s.solution)
      .map((s, idx) => ({
        step_id: baseTs + idx,
        step_order: idx + 1,
        ...s,
      }));
  }

  async function _parseBody(init) {
    if (!init || !init.body) return {};
    if (typeof FormData !== 'undefined' && init.body instanceof FormData) return init.body;
    if (typeof init.body === 'string') {
      try { return JSON.parse(init.body); } catch (_) { return {}; }
    }
    return init.body;
  }

  async function _handleOfflineApi(path, method, init) {
    const snap = await ensureLocalSnapshot();
    const urlObj = new URL(path, location.origin);
    const p = urlObj.pathname;
    const m = (method || 'GET').toUpperCase();
    const body = await _parseBody(init);
    snap.tombstones = snap.tombstones || {};

    if (p === '/api/bootstrap') {
      return _jsonResponse(_bootstrapPayloadFromSnap(snap));
    }

    if (p === '/api/mobile-info') {
      const cfg = getSyncConfig();
      return _jsonResponse({
        lan_ip: location.hostname || 'offline',
        port: location.port || '',
        lan_url: location.origin,
        lan_reachable: false,
        bind_host: '',
        qr_svg: '',
        cloud_sync: {
          has_token: Boolean(cfg.github_token),
          gist_id: cfg.gist_id || '',
          auto_sync: cfg.auto_sync !== false,
          last_sync_at: cfg.last_sync_at || '',
          last_sync_status: cfg.last_sync_status || '',
        },
        gh_pages: {},
        mobile_dist: null,
      });
    }

    // ---- Repair Cases CRUD ----
    if (p === '/api/repair-cases' && m === 'GET') {
      return _jsonResponse({ items: snap.repair_cases || [], total: (snap.repair_cases || []).length });
    }
    if (p === '/api/repair-cases' && m === 'POST') {
      const id = (body.id || '').trim() || _nextSeqId(snap.repair_cases, 'REP');
      const [sc, sl] = _normalizeStatus(body.status_code);
      const brandModel = String(body.brand_model || '').trim() || id;
      const coldCheckRaw = String(body.cold_check_raw || '').trim();
      const noteRaw = String(body.note || '').trim();
      let steps = _normalizeRepairStepsJS(body.steps || []);
      let faultRaw = String(body.fault_symptom_raw || '').trim();
      let causeRaw = String(body.root_cause_raw || '').trim();
      let solutionRaw = String(body.solution_raw || '').trim();
      if (steps.length) {
        const [fR, cR, sR] = _formatRepairStepsRawJS(steps);
        faultRaw = faultRaw || fR;
        causeRaw = causeRaw || cR;
        solutionRaw = solutionRaw || sR;
      } else if (faultRaw || causeRaw || solutionRaw) {
        steps = [{ step_id: Date.now(), step_order: 1, symptom: faultRaw, root_cause: causeRaw, solution: solutionRaw }];
      }
      const stepsText = steps.map((s) => `${s.symptom} ${s.root_cause} ${s.solution}`).join(' ');
      const fullText = `${brandModel} ${coldCheckRaw} ${faultRaw} ${causeRaw} ${solutionRaw} ${stepsText} ${noteRaw}`;
      const [compTags, faultCodes] = _extractRepairTagsJS(fullText, body.component_tags, body.fault_codes);
      const rec = {
        id,
        record_date: body.record_date || localDateKey(),
        device_category: body.device_category || 'VFD',
        brand_model: brandModel,
        cold_check_raw: coldCheckRaw,
        fault_symptom_raw: faultRaw,
        root_cause_raw: causeRaw,
        solution_raw: solutionRaw,
        note: noteRaw,
        status_code: sc,
        status_label: sl,
        component_tags: compTags,
        fault_codes: faultCodes,
        steps,
        attachments: [],
        created_at: utcNowIso(),
        updated_at: utcNowIso(),
      };
      delete snap.tombstones[`repair:${id}`];
      snap.repair_cases.push(rec);
      await saveLocalSnapshot(snap);
      return _jsonResponse(rec, 201);
    }
    let match = p.match(/^\/api\/repair-cases\/([^/]+)\/inline$/);
    if (match && m === 'PATCH') {
      const id = decodeURIComponent(match[1]);
      const idx = (snap.repair_cases || []).findIndex((r) => r.id === id);
      if (idx < 0) return _jsonResponse({ detail: 'Not found' }, 404);
      const cur = snap.repair_cases[idx];
      let nextBrand = cur.brand_model || id;
      if (body.brand_model !== undefined && body.brand_model !== null) {
        nextBrand = String(body.brand_model).trim();
        if (!nextBrand) return _jsonResponse({ detail: 'Tên hãng & mã thiết bị không được để trống' }, 400);
      }
      const nextCold = (body.cold_check_raw !== undefined && body.cold_check_raw !== null)
        ? String(body.cold_check_raw).trim()
        : (cur.cold_check_raw || '');
      const nextNote = (body.note !== undefined && body.note !== null)
        ? String(body.note).trim()
        : (cur.note || '');

      let nextSteps = Array.isArray(cur.steps) ? cur.steps : [];
      let nextFaultRaw = cur.fault_symptom_raw || '';
      let nextCauseRaw = cur.root_cause_raw || '';
      let nextSolRaw = cur.solution_raw || '';
      if (Array.isArray(body.steps)) {
        nextSteps = _normalizeRepairStepsJS(body.steps);
        [nextFaultRaw, nextCauseRaw, nextSolRaw] = _formatRepairStepsRawJS(nextSteps);
      }

      const baseComps = Array.isArray(body.component_tags)
        ? _cleanCompTagsJS(body.component_tags)
        : (cur.component_tags || []);
      const baseFaults = Array.isArray(body.fault_codes)
        ? _cleanFaultCodesJS(body.fault_codes)
        : (cur.fault_codes || []);

      let compTags = baseComps;
      let faultCodes = baseFaults;
      if (!body.skip_auto_extract) {
        const changedParts = [];
        if (body.brand_model !== undefined && body.brand_model !== null) changedParts.push(nextBrand);
        if (body.cold_check_raw !== undefined && body.cold_check_raw !== null) changedParts.push(nextCold);
        if (body.note !== undefined && body.note !== null) changedParts.push(nextNote);
        if (Array.isArray(body.steps)) {
          changedParts.push(nextSteps.map((s) => `${s.symptom} ${s.root_cause} ${s.solution}`).join(' '));
        }
        [compTags, faultCodes] = _extractRepairTagsJS(changedParts.join(' '), baseComps, baseFaults);
      }

      const updated = {
        ...cur,
        brand_model: nextBrand,
        cold_check_raw: nextCold,
        fault_symptom_raw: nextFaultRaw,
        root_cause_raw: nextCauseRaw,
        solution_raw: nextSolRaw,
        note: nextNote,
        steps: nextSteps,
        component_tags: compTags,
        fault_codes: faultCodes,
        updated_at: utcNowIso(),
      };
      snap.repair_cases[idx] = updated;
      await saveLocalSnapshot(snap);
      return _jsonResponse(updated);
    }
    match = p.match(/^\/api\/repair-cases\/([^/]+)\/status$/);
    if (match && m === 'PATCH') {
      const id = decodeURIComponent(match[1]);
      const rec = (snap.repair_cases || []).find((r) => r.id === id);
      if (!rec) return _jsonResponse({ detail: 'Not found' }, 404);
      const [sc, sl] = _normalizeStatus(body.status_code);
      rec.status_code = sc;
      rec.status_label = sl;
      rec.updated_at = utcNowIso();
      await saveLocalSnapshot(snap);
      return _jsonResponse(rec);
    }
    match = p.match(/^\/api\/repair-cases\/([^/]+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      const idx = (snap.repair_cases || []).findIndex((r) => r.id === id);
      if (idx < 0) return _jsonResponse({ detail: 'Not found' }, 404);
      if (m === 'PUT') {
        const cur = snap.repair_cases[idx];
        const [sc, sl] = _normalizeStatus(body.status_code);
        const brandModel = String(body.brand_model !== undefined ? body.brand_model : (cur.brand_model || id)).trim() || id;
        const coldCheckRaw = String(body.cold_check_raw !== undefined ? body.cold_check_raw : (cur.cold_check_raw || '')).trim();
        const noteRaw = String(body.note !== undefined ? body.note : (cur.note || '')).trim();
        const steps = Array.isArray(body.steps) ? _normalizeRepairStepsJS(body.steps) : (cur.steps || []);
        const [fR, cR, sR] = _formatRepairStepsRawJS(steps);
        const faultRaw = steps.length ? fR : String(body.fault_symptom_raw || '').trim();
        const causeRaw = steps.length ? cR : String(body.root_cause_raw || '').trim();
        const solutionRaw = steps.length ? sR : String(body.solution_raw || '').trim();
        const stepsText = steps.map((s) => `${s.symptom} ${s.root_cause} ${s.solution}`).join(' ');
        const fullText = `${brandModel} ${coldCheckRaw} ${faultRaw} ${causeRaw} ${solutionRaw} ${stepsText} ${noteRaw}`;
        const [compTags, faultCodes] = _extractRepairTagsJS(fullText, body.component_tags, body.fault_codes);
        const updated = {
          ...cur,
          ...body,
          id,
          brand_model: brandModel,
          cold_check_raw: coldCheckRaw,
          fault_symptom_raw: faultRaw,
          root_cause_raw: causeRaw,
          solution_raw: solutionRaw,
          note: noteRaw,
          status_code: sc,
          status_label: sl,
          component_tags: compTags,
          fault_codes: faultCodes,
          steps,
          updated_at: utcNowIso(),
        };
        snap.repair_cases[idx] = updated;
        await saveLocalSnapshot(snap);
        return _jsonResponse(updated);
      }
      if (m === 'DELETE') {
        snap.repair_cases.splice(idx, 1);
        snap.tombstones[`repair:${id}`] = utcNowIso();
        await saveLocalSnapshot(snap);
        return _jsonResponse({ deleted: true, id });
      }
    }

    // ---- Knowledge Items CRUD ----
    if (p === '/api/knowledge-items' && m === 'POST') {
      const id = (body.id || '').trim() || _nextSeqId(snap.knowledge_items, 'KNW');
      const [sc, sl] = _normalizeStatus(body.status_code);
      const rec = {
        id,
        record_date: body.record_date || localDateKey(),
        source_group: body.source_group || 'Knowledge',
        topic_model: body.topic_model || id,
        category: body.category || '',
        key_takeaway: body.key_takeaway || '',
        core_concept_workflow: body.core_concept_workflow || '',
        why_question: body.why_question || '',
        actionable_application: body.actionable_application || '',
        note: body.note || '',
        status_code: sc,
        status_label: sl,
        component_tags: body.component_tags || [],
        custom_sections_json: body.custom_sections_json || [],
        drill_qa_json: body.drill_qa_json || [],
        attachments: [],
        created_at: utcNowIso(),
        updated_at: utcNowIso(),
      };
      delete snap.tombstones[`knowledge:${id}`];
      snap.knowledge_items.push(rec);
      await saveLocalSnapshot(snap);
      return _jsonResponse(rec, 201);
    }
    match = p.match(/^\/api\/knowledge-items\/([^/]+)\/status$/);
    if (match && m === 'PATCH') {
      const id = decodeURIComponent(match[1]);
      const rec = (snap.knowledge_items || []).find((r) => r.id === id);
      if (!rec) return _jsonResponse({ detail: 'Not found' }, 404);
      const [sc, sl] = _normalizeStatus(body.status_code);
      rec.status_code = sc;
      rec.status_label = sl;
      rec.updated_at = utcNowIso();
      await saveLocalSnapshot(snap);
      return _jsonResponse(rec);
    }
    match = p.match(/^\/api\/knowledge-items\/([^/]+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      const idx = (snap.knowledge_items || []).findIndex((r) => r.id === id);
      if (idx < 0) return _jsonResponse({ detail: 'Not found' }, 404);
      if (m === 'PUT') {
        const [sc, sl] = _normalizeStatus(body.status_code);
        snap.knowledge_items[idx] = { ...snap.knowledge_items[idx], ...body, id, status_code: sc, status_label: sl, updated_at: utcNowIso() };
        await saveLocalSnapshot(snap);
        return _jsonResponse(snap.knowledge_items[idx]);
      }
      if (m === 'DELETE') {
        snap.knowledge_items.splice(idx, 1);
        snap.tombstones[`knowledge:${id}`] = utcNowIso();
        await saveLocalSnapshot(snap);
        return _jsonResponse({ deleted: true, id });
      }
    }

    // ---- PLC Notes CRUD ----
    if (p === '/api/plc-notes' && m === 'POST') {
      const id = (body.id || '').trim() || _nextSeqId(snap.plc_notes, 'PLC');
      const [sc, sl] = _normalizeStatus(body.status_code);
      const rec = {
        id,
        record_date: body.record_date || localDateKey(),
        plc_brand_platform: body.plc_brand_platform || 'Siemens TIA Portal',
        category: body.category || 'Khối hàm (FB/FC/OB)',
        title: body.title || id,
        core_summary: body.core_summary || '',
        pinout_json: body.pinout_json || [],
        code_snippet: body.code_snippet || '',
        common_pitfalls: body.common_pitfalls || '',
        interview_qa: body.interview_qa || '',
        custom_sections_json: body.custom_sections_json || [],
        drill_qa_json: body.drill_qa_json || [],
        status_code: sc,
        status_label: sl,
        tags: body.tags || [],
        attachments: [],
        created_at: utcNowIso(),
        updated_at: utcNowIso(),
      };
      delete snap.tombstones[`plc:${id}`];
      snap.plc_notes.push(rec);
      await saveLocalSnapshot(snap);
      return _jsonResponse(rec, 201);
    }
    match = p.match(/^\/api\/plc-notes\/([^/]+)\/status$/);
    if (match && m === 'PATCH') {
      const id = decodeURIComponent(match[1]);
      const rec = (snap.plc_notes || []).find((r) => r.id === id);
      if (!rec) return _jsonResponse({ detail: 'Not found' }, 404);
      const [sc, sl] = _normalizeStatus(body.status_code);
      rec.status_code = sc;
      rec.status_label = sl;
      rec.updated_at = utcNowIso();
      await saveLocalSnapshot(snap);
      return _jsonResponse(rec);
    }
    match = p.match(/^\/api\/plc-notes\/([^/]+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      const idx = (snap.plc_notes || []).findIndex((r) => r.id === id);
      if (idx < 0) return _jsonResponse({ detail: 'Not found' }, 404);
      if (m === 'PUT') {
        const [sc, sl] = _normalizeStatus(body.status_code);
        snap.plc_notes[idx] = { ...snap.plc_notes[idx], ...body, id, status_code: sc, status_label: sl, updated_at: utcNowIso() };
        await saveLocalSnapshot(snap);
        return _jsonResponse(snap.plc_notes[idx]);
      }
      if (m === 'DELETE') {
        snap.plc_notes.splice(idx, 1);
        snap.tombstones[`plc:${id}`] = utcNowIso();
        await saveLocalSnapshot(snap);
        return _jsonResponse({ deleted: true, id });
      }
    }

    // ---- Network Notes CRUD ----
    if (p === '/api/network-notes' && m === 'POST') {
      const id = (body.id || '').trim() || _nextSeqId(snap.network_notes, 'NET');
      const [sc, sl] = _normalizeStatus(body.status_code);
      const rec = {
        id,
        record_date: body.record_date || localDateKey(),
        protocol: body.protocol || 'Modbus RTU/TCP',
        target_device: body.target_device || id,
        physical_wiring: body.physical_wiring || '',
        comm_settings: body.comm_settings || '',
        register_map_json: body.register_map_json || [],
        test_script_code: body.test_script_code || '',
        troubleshooting_tips: body.troubleshooting_tips || '',
        custom_sections_json: body.custom_sections_json || [],
        drill_qa_json: body.drill_qa_json || [],
        status_code: sc,
        status_label: sl,
        tags: body.tags || [],
        attachments: [],
        created_at: utcNowIso(),
        updated_at: utcNowIso(),
      };
      delete snap.tombstones[`network:${id}`];
      snap.network_notes.push(rec);
      await saveLocalSnapshot(snap);
      return _jsonResponse(rec, 201);
    }
    match = p.match(/^\/api\/network-notes\/([^/]+)\/status$/);
    if (match && m === 'PATCH') {
      const id = decodeURIComponent(match[1]);
      const rec = (snap.network_notes || []).find((r) => r.id === id);
      if (!rec) return _jsonResponse({ detail: 'Not found' }, 404);
      const [sc, sl] = _normalizeStatus(body.status_code);
      rec.status_code = sc;
      rec.status_label = sl;
      rec.updated_at = utcNowIso();
      await saveLocalSnapshot(snap);
      return _jsonResponse(rec);
    }
    match = p.match(/^\/api\/network-notes\/([^/]+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      const idx = (snap.network_notes || []).findIndex((r) => r.id === id);
      if (idx < 0) return _jsonResponse({ detail: 'Not found' }, 404);
      if (m === 'PUT') {
        const [sc, sl] = _normalizeStatus(body.status_code);
        snap.network_notes[idx] = { ...snap.network_notes[idx], ...body, id, status_code: sc, status_label: sl, updated_at: utcNowIso() };
        await saveLocalSnapshot(snap);
        return _jsonResponse(snap.network_notes[idx]);
      }
      if (m === 'DELETE') {
        snap.network_notes.splice(idx, 1);
        snap.tombstones[`network:${id}`] = utcNowIso();
        await saveLocalSnapshot(snap);
        return _jsonResponse({ deleted: true, id });
      }
    }

    // ---- Attachments & Camera Capture (compressed DataURL 1280px) ----
    if (p === '/api/attachments/upload' && m === 'POST' && body instanceof FormData) {
      const file = body.get('file');
      const parentType = String(body.get('parent_type') || 'repair');
      const parentId = String(body.get('parent_id') || '');
      const caption = String(body.get('caption') || 'Ảnh chụp thiết bị');
      const dataUrl = await _fileToCompressedDataUrl(file);
      const targetList =
        parentType === 'repair' ? snap.repair_cases
          : (parentType === 'knowledge' ? snap.knowledge_items
            : (parentType === 'plc' ? snap.plc_notes : snap.network_notes));
      const parentRec = (targetList || []).find((x) => x.id === parentId);
      if (!parentRec) return _jsonResponse({ detail: 'Record not found' }, 404);
      const att = {
        attachment_id: Date.now(),
        parent_type: parentType,
        parent_id: parentId,
        file_path: dataUrl,
        caption,
        created_at: utcNowIso(),
      };
      parentRec.attachments = [...(parentRec.attachments || []), att];
      parentRec.updated_at = utcNowIso();
      await saveLocalSnapshot(snap);
      return _jsonResponse(att, 201);
    }
    match = p.match(/^\/api\/attachments\/([^/]+)$/);
    if (match && m === 'DELETE') {
      const aid = Number(match[1]);
      [snap.repair_cases, snap.knowledge_items, snap.plc_notes, snap.network_notes].forEach((arr) => {
        (arr || []).forEach((rec) => {
          const before = (rec.attachments || []).length;
          rec.attachments = (rec.attachments || []).filter((a) => Number(a.attachment_id) !== aid);
          if (rec.attachments.length !== before) rec.updated_at = utcNowIso();
        });
      });
      await saveLocalSnapshot(snap);
      return _jsonResponse({ deleted: true, attachment_id: aid });
    }
    if (p === '/api/canvas-images/upload' && m === 'POST' && body instanceof FormData) {
      const dataUrl = await _fileToCompressedDataUrl(body.get('file'));
      return _jsonResponse({ url: dataUrl }, 201);
    }

    // ---- Sections, Scratchpads, Review Progress, Categories, Cross-Ref ----
    match = p.match(/^\/api\/sections\/([^/]+)\/([^/]+)$/);
    if (match && m === 'PATCH') {
      const kind = decodeURIComponent(match[1]);
      const id = decodeURIComponent(match[2]);
      const list = kind === 'knowledge' ? snap.knowledge_items : (kind === 'plc' ? snap.plc_notes : snap.network_notes);
      const rec = (list || []).find((r) => r.id === id);
      if (!rec) return _jsonResponse({ detail: 'Not found' }, 404);
      if (body.custom_sections_json !== undefined) rec.custom_sections_json = body.custom_sections_json;
      rec.updated_at = utcNowIso();
      await saveLocalSnapshot(snap);
      return _jsonResponse(rec);
    }
    match = p.match(/^\/api\/scratchpads\/([^/]+)$/);
    if (match) {
      const ws = decodeURIComponent(match[1]);
      snap.scratchpads = snap.scratchpads || {};
      if (m === 'GET') return _jsonResponse(snap.scratchpads[ws] || { workspace: ws, content: '', images_json: [], font_mode: 'sans' });
      snap.scratchpads[ws] = { workspace: ws, content: body.content || '', images_json: body.images_json || [], font_mode: body.font_mode || 'sans', updated_at: utcNowIso() };
      await saveLocalSnapshot(snap);
      return _jsonResponse(snap.scratchpads[ws]);
    }
    if (p === '/api/review-progress') {
      snap.review_progress = snap.review_progress || {};
      if (m === 'POST') {
        const prev = snap.review_progress[body.card_key] || { attempts: 0, correct_streak: 0 };
        snap.review_progress[body.card_key] = {
          card_key: body.card_key,
          item_kind: body.item_kind,
          item_id: body.item_id,
          rating: body.rating,
          attempts: Number(prev.attempts || 0) + 1,
          correct_streak: body.rating === 'mastered' ? Number(prev.correct_streak || 0) + 1 : 0,
          last_reviewed: utcNowIso(),
        };
        await saveLocalSnapshot(snap);
        return _jsonResponse(snap.review_progress[body.card_key]);
      }
      if (m === 'DELETE') {
        const ik = urlObj.searchParams.get('item_kind');
        const iid = urlObj.searchParams.get('item_id');
        Object.keys(snap.review_progress).forEach((k) => {
          const rp = snap.review_progress[k];
          if ((!ik || rp.item_kind === ik) && (!iid || rp.item_id === iid)) delete snap.review_progress[k];
        });
        await saveLocalSnapshot(snap);
        return _jsonResponse({ reset: true });
      }
    }
    if (p === '/api/flashcards/evaluate-answer' && m === 'POST') {
      const offlineRes = evaluateFlashcardOfflineJS(body.reference_answer || '', body.user_answer || '');
      const mode = String(body.mode || 'auto').trim().toLowerCase();
      if (mode !== 'offline' && String(body.user_answer || '').trim()) {
        const aiOut = await _callGeminiJsonDirect(_buildFlashcardGeminiPromptJS(body), body.api_key || '');
        if (aiOut && typeof aiOut === 'object' && ('overall_score' in aiOut || 'note_match_score' in aiOut || 'verdict' in aiOut)) {
          return _jsonResponse(_normalizeGeminiFlashcardEval(aiOut, offlineRes));
        }
      }
      return _jsonResponse(offlineRes);
    }
    if (p === '/api/flashcards/follow-up' && m === 'POST') {
      const offlineRes = buildFlashcardFollowUpOfflineJS(
        body.item_kind || '',
        body.record_title || '',
        body.question || '',
        body.reference_answer || ''
      );
      const aiOut = await _callGeminiJsonDirect(_buildFlashcardFollowUpGeminiPromptJS(body), body.api_key || '');
      if (aiOut && typeof aiOut === 'object' && String(aiOut.followup_question || '').trim()) {
        return _jsonResponse({
          engine: 'gemini',
          focus_tag: String(aiOut.focus_tag || offlineRes.focus_tag).trim(),
          followup_question: String(aiOut.followup_question).trim(),
          model_answer: String(aiOut.model_answer || offlineRes.model_answer).trim(),
        });
      }
      return _jsonResponse(offlineRes);
    }
    match = p.match(/^\/api\/workspace-categories\/([^/]+)\/reset$/);
    if (match && m === 'POST') {
      const sc = decodeURIComponent(match[1]);
      const defItems = (DEFAULT_WORKSPACE_CATEGORIES[sc] || []).map((it) => ({ ...it }));
      snap.workspace_categories = snap.workspace_categories || {};
      snap.workspace_categories[sc] = defItems;
      await saveLocalSnapshot(snap);
      return _jsonResponse({ ..._bootstrapPayloadFromSnap(snap), scope: sc, items: defItems });
    }
    match = p.match(/^\/api\/workspace-categories\/([^/]+)$/);
    if (match && m === 'PUT') {
      const sc = decodeURIComponent(match[1]);
      snap.workspace_categories = snap.workspace_categories || {};
      snap.workspace_categories[sc] = (body.items || []).map((it) => ({
        key: it.key || it.label,
        label: it.label || it.key,
      }));
      await saveLocalSnapshot(snap);
      return _jsonResponse({ ..._bootstrapPayloadFromSnap(snap), scope: sc, items: snap.workspace_categories[sc] });
    }
    match = p.match(/^\/api\/records\/([^/]+)\/([^/]+)\/category$/);
    if (match && m === 'PATCH') {
      const kind = decodeURIComponent(match[1]);
      const id = decodeURIComponent(match[2]);
      const cat = String(body.category_key || '').trim();
      const map = { repair: [snap.repair_cases, 'device_category'], knowledge: [snap.knowledge_items, 'source_group'], plc: [snap.plc_notes, 'category'], network: [snap.network_notes, 'protocol'] };
      const pair = map[kind];
      if (!pair) return _jsonResponse({ detail: 'Unknown kind' }, 400);
      const rec = (pair[0] || []).find((x) => x.id === id);
      if (!rec) return _jsonResponse({ detail: 'Not found' }, 404);
      rec[pair[1]] = cat;
      rec.updated_at = utcNowIso();
      await saveLocalSnapshot(snap);
      return _jsonResponse(rec);
    }
    match = p.match(/^\/api\/cross-reference\/(.+)$/);
    if (match && m === 'GET') {
      const clean = decodeURIComponent(match[1]).trim();
      const low = clean.toLowerCase();
      const hasTag = (arr) => (arr || []).some((t) => String(t || '').trim().toLowerCase() === low);
      return _jsonResponse({
        tag: clean,
        repair_cases: (snap.repair_cases || []).filter((r) => hasTag(r.component_tags) || hasTag(r.fault_codes)),
        knowledge_items: (snap.knowledge_items || []).filter((k) => hasTag(k.component_tags)),
        plc_notes: (snap.plc_notes || []).filter((n) => hasTag(n.tags)),
        network_notes: (snap.network_notes || []).filter((n) => hasTag(n.tags)),
      });
    }

    // ---- Legacy Quick Vocab Modal (/api/en/vocabulary) ----
    if (p === '/api/en/vocabulary' && m === 'POST') {
      const viTerm = String(body.vi_term || '').trim();
      const enTerm = String(body.en_term || '').trim();
      if (!viTerm || !enTerm) return _jsonResponse({ detail: 'Missing vi_term or en_term' }, 400);
      snap.english_cards = snap.english_cards || [];
      let card = snap.english_cards.find((c) => String(c.term || '').trim().toLowerCase() === enTerm.toLowerCase());
      if (card) {
        card.meaning_vi = viTerm;
        if (body.example_en) card.example_en = body.example_en;
        if (body.example_vi) card.example_vi = body.example_vi;
        if (body.source_ref) card.linked_record_id = body.source_ref;
        card.updated_at = utcNowIso();
      } else {
        const cid = _nextSeqId(snap.english_cards, 'ENG');
        card = {
          id: cid,
          term: enTerm,
          ipa: '/.../',
          word_class: enTerm.split(/\s+/).length >= 4 ? 'Lexical Chunk' : 'Noun',
          category: _normalizeEnCat(body.category || '', enTerm),
          meaning_vi: viTerm,
          collocations: '',
          example_en: body.example_en || '',
          example_vi: body.example_vi || '',
          linked_record_id: body.source_ref || '',
          srs_stage: 'new',
          interval_days: 0,
          ease_factor: 2.5,
          repetitions: 0,
          next_review_at: '',
          last_reviewed_at: '',
          created_at: utcNowIso(),
          updated_at: utcNowIso(),
        };
        delete snap.tombstones[`english_card:${cid}`];
        snap.english_cards.unshift(card);
      }
      await saveLocalSnapshot(snap);
      const item = (snap.english_vocab || []).find((v) => String(v.term_or_chunk || '').toLowerCase() === enTerm.toLowerCase()) || card;
      return _jsonResponse({ item, ..._bootstrapPayloadFromSnap(snap) }, 201);
    }
    match = p.match(/^\/api\/en\/vocabulary\/([^/]+)$/);
    if (match && m === 'DELETE') {
      const rawId = decodeURIComponent(match[1]);
      snap.english_cards = snap.english_cards || [];
      let idx = -1;
      const num = Number(rawId);
      if (!Number.isNaN(num) && Number.isInteger(num) && num >= 1 && num <= snap.english_cards.length) {
        idx = num - 1;
      } else {
        idx = snap.english_cards.findIndex((c) => String(c.id) === rawId);
      }
      if (idx >= 0) {
        const removed = snap.english_cards.splice(idx, 1)[0];
        if (removed?.id) snap.tombstones[`english_card:${removed.id}`] = utcNowIso();
        await saveLocalSnapshot(snap);
      }
      return _jsonResponse({ deleted: true, ..._bootstrapPayloadFromSnap(snap) });
    }

    // ---- English SRS Cards, Review, Combat & AI Config (100% Independent Offline) ----
    if (p === '/api/english/ai-config') {
      if (m === 'GET') {
        const cfg = getAiConfig();
        const k = cfg.gemini_api_key || '';
        return _jsonResponse({ has_key: Boolean(k), masked_key: k ? `${k.slice(0, 6)}...${k.slice(-4)}` : '', model: cfg.gemini_model || 'gemini-2.0-flash' });
      }
      const saved = saveAiConfig(body.gemini_api_key, body.gemini_model);
      const k = saved.gemini_api_key || '';
      return _jsonResponse({ saved: true, has_key: Boolean(k), masked_key: k ? `${k.slice(0, 6)}...${k.slice(-4)}` : '', model: saved.gemini_model });
    }
    if (p === '/api/english/cards' && m === 'POST') {
      const id = (body.id || '').trim() || _nextSeqId(snap.english_cards, 'ENG');
      const card = {
        id,
        term: body.term || '',
        ipa: body.ipa || '',
        word_class: body.word_class || 'Noun',
        category: body.category || 'PLC & Tự động hóa',
        meaning_vi: body.meaning_vi || '',
        collocations: body.collocations || '',
        example_en: body.example_en || '',
        example_vi: body.example_vi || '',
        linked_record_id: body.linked_record_id || '',
        srs_stage: body.srs_stage || 'new',
        interval_days: 0,
        ease_factor: 2.5,
        repetitions: 0,
        next_review_at: '',
        last_reviewed_at: '',
        created_at: utcNowIso(),
        updated_at: utcNowIso(),
      };
      delete snap.tombstones[`english_card:${id}`];
      snap.english_cards.unshift(card);
      await saveLocalSnapshot(snap);
      return _jsonResponse({ card, ..._bootstrapPayloadFromSnap(snap) }, 201);
    }
    match = p.match(/^\/api\/english\/cards\/([^/]+)\/review$/);
    if (match && m === 'POST') {
      const cid = decodeURIComponent(match[1]);
      const card = (snap.english_cards || []).find((c) => c.id === cid);
      if (!card) return _jsonResponse({ detail: 'Card not found' }, 404);
      const grade = Number(body.grade || 3);
      let ef = Number(card.ease_factor || 2.5);
      let ivl = Number(card.interval_days || 0);
      let reps = Number(card.repetitions || 0);
      const now = new Date();
      let stage = 'review';
      let nextDate = new Date(now);
      let xp = 12;
      if (grade === 1) {
        reps = 0; ivl = 0; ef = Math.max(1.3, Number((ef - 0.2).toFixed(2))); stage = 'learning'; xp = 5;
        nextDate = new Date(now.getTime() + 10 * 60000);
      } else if (grade === 2) {
        reps = Math.max(1, reps); ivl = ivl < 1 ? 1 : Math.max(1, Math.round(ivl * 1.2)); ef = Math.max(1.3, Number((ef - 0.15).toFixed(2)));
        stage = ivl < 3 ? 'learning' : (ivl >= 21 ? 'mastered' : 'review'); xp = 8;
        nextDate.setDate(nextDate.getDate() + ivl);
      } else if (grade === 3) {
        ivl = (reps === 0 || ivl <= 0) ? 1 : ((reps === 1 || ivl <= 1.5) ? 3 : Math.max(4, Math.round(ivl * ef)));
        reps += 1; stage = ivl >= 21 ? 'mastered' : (ivl <= 1 ? 'learning' : 'review'); xp = 12;
        nextDate.setDate(nextDate.getDate() + ivl);
      } else {
        ivl = Math.max(4, Math.round(Math.max(1, ivl) * ef * 1.3));
        reps += 1; ef = Number(Math.min(3.2, ef + 0.15).toFixed(2));
        stage = ivl >= 21 ? 'mastered' : 'review'; xp = 15;
        nextDate.setDate(nextDate.getDate() + ivl);
      }
      card.srs_stage = stage;
      card.interval_days = ivl;
      card.ease_factor = ef;
      card.repetitions = reps;
      card.last_reviewed_at = localDateTimeStr(now);
      card.next_review_at = localDateTimeStr(nextDate);
      card.updated_at = utcNowIso();
      _recordStreakHit(snap, 1, 0, xp);
      await saveLocalSnapshot(snap);
      return _jsonResponse({ card, ..._bootstrapPayloadFromSnap(snap) });
    }
    match = p.match(/^\/api\/english\/cards\/([^/]+)\/reset$/);
    if (match && m === 'POST') {
      const cid = decodeURIComponent(match[1]);
      const card = (snap.english_cards || []).find((c) => c.id === cid);
      if (!card) return _jsonResponse({ detail: 'Card not found' }, 404);
      card.srs_stage = 'new'; card.interval_days = 0; card.ease_factor = 2.5; card.repetitions = 0; card.next_review_at = ''; card.updated_at = utcNowIso();
      await saveLocalSnapshot(snap);
      return _jsonResponse({ card, ..._bootstrapPayloadFromSnap(snap) });
    }
    match = p.match(/^\/api\/english\/cards\/([^/]+)$/);
    if (match) {
      const cid = decodeURIComponent(match[1]);
      const idx = (snap.english_cards || []).findIndex((c) => c.id === cid);
      if (idx < 0) return _jsonResponse({ detail: 'Card not found' }, 404);
      if (m === 'PUT') {
        snap.english_cards[idx] = { ...snap.english_cards[idx], ...body, id: cid, updated_at: utcNowIso() };
        await saveLocalSnapshot(snap);
        return _jsonResponse({ card: snap.english_cards[idx], ..._bootstrapPayloadFromSnap(snap) });
      }
      if (m === 'DELETE') {
        snap.english_cards.splice(idx, 1);
        snap.tombstones[`english_card:${cid}`] = utcNowIso();
        await saveLocalSnapshot(snap);
        return _jsonResponse({ deleted: true, id: cid, ..._bootstrapPayloadFromSnap(snap) });
      }
    }
    if (p === '/api/english/reading-sync' && m === 'POST') {
      const ids = body.card_ids || [];
      const ratio = body.total > 0 ? body.score / body.total : 1;
      const synced = [];
      const now = new Date();
      ids.slice(0, 10).forEach((cid) => {
        const c = (snap.english_cards || []).find((x) => x.id === cid);
        if (!c) return;
        let ivl = Number(c.interval_days || 0);
        c.repetitions = Number(c.repetitions || 0) + 1;
        if (ratio >= 0.66) {
          ivl = ivl <= 0 ? 1 : Math.max(2, Math.round(ivl * 1.6));
          c.srs_stage = ivl >= 21 ? 'mastered' : (ivl <= 1 ? 'learning' : 'review');
          const d = new Date(now);
          d.setDate(d.getDate() + ivl);
          c.next_review_at = localDateTimeStr(d);
        } else {
          ivl = Math.min(ivl, 1);
          c.srs_stage = 'learning';
          c.next_review_at = localDateTimeStr(now);
        }
        c.interval_days = ivl;
        c.last_reviewed_at = localDateTimeStr(now);
        c.updated_at = utcNowIso();
        synced.push({ id: c.id, term: c.term, srs_stage: c.srs_stage, interval_days: ivl });
      });
      _recordStreakHit(snap, Math.min(2, synced.length), 0, 15);
      await saveLocalSnapshot(snap);
      return _jsonResponse({ synced, ..._bootstrapPayloadFromSnap(snap) });
    }
    if ((p === '/api/english/evaluate-combat' || p === '/api/english/evaluate-translation') && m === 'POST') {
      const kws = body.target_keywords || [];
      const userLow = String(body.user_en || '').toLowerCase();
      const matched = [];
      const missing = [];
      kws.forEach((kw) => {
        if (userLow.includes(String(kw).toLowerCase())) matched.push(kw);
        else missing.push(kw);
      });
      const aiRes = await _callGeminiJsonDirect(
        `Evaluate this English engineering sentence.\nPrompt: ${body.prompt_vi}\nReference: ${body.reference_en}\nUser: ${body.user_en}\nKeywords: ${kws.join(', ')}\nReturn JSON keys: score(0-100), verdict(Vietnamese), corrected_user_en, grammar_notes(array Vietnamese), natural_en_report, natural_en_interview.`
      );
      const score = aiRes?.score ?? Math.min(100, Math.max(40, Math.round((matched.length / Math.max(1, kws.length)) * 55 + 42)));
      const drill = (snap.english_combat_drills || []).find((d) => d.id === body.drill_id);
      if (drill) {
        drill.last_score = score;
        drill.attempts = Number(drill.attempts || 0) + 1;
        drill.updated_at = utcNowIso();
      }
      const relatedTerms = _extractMatchingTerms(`${body.prompt_vi || ''} ${body.reference_en || ''}`, snap).slice(0, 6);
      const coreVocab = relatedTerms.map((t) => {
        const hitCard = (snap.english_cards || []).find((c) => String(c.term || '').toLowerCase() === t.en.toLowerCase());
        return {
          term: t.en,
          meaning_vi: t.vi,
          ipa: hitCard?.ipa || '',
          in_bank: Boolean(hitCard),
          srs_stage: hitCard?.srs_stage || '',
        };
      });
      _recordStreakHit(snap, 0, 1, 18);
      await saveLocalSnapshot(snap);
      return _jsonResponse({
        engine: aiRes ? 'gemini' : 'offline',
        mode: body.mode || 'speaking',
        score,
        verdict: aiRes?.verdict || (missing.length ? `Khớp ${matched.length}/${kws.length} từ khóa bắt buộc (Offline Mobile).` : 'Xuất sắc! Bạn đã dùng đủ toàn bộ từ khóa mục tiêu (Offline Mobile).'),
        user_original: body.user_en || '',
        corrected_user_en: aiRes?.corrected_user_en || body.user_en || '',
        grammar_notes: aiRes?.grammar_notes || [missing.length ? `Cần bổ sung: ${missing.join(', ')}` : 'Cấu trúc rõ ràng, giữ vững phản xạ tự nhiên.'],
        natural_en_report: aiRes?.natural_en_report || body.reference_en || body.user_en,
        natural_en_interview: aiRes?.natural_en_interview || drill?.spoken_en || body.reference_en || body.user_en,
        matched_keywords: matched,
        missing_keywords: missing,
        core_vocab: coreVocab,
        active_recall_synced: [],
        ..._bootstrapPayloadFromSnap(snap),
      });
    }
    if (p === '/api/english/generate-reading' && m === 'POST') {
      const count = Math.min(10, Math.max(5, Number(body.count || 7)));
      const cards = snap.english_cards || [];
      const picked = [...cards.filter((c) => c.is_due), ...cards.filter((c) => !c.is_due)].slice(0, count);
      const termsTxt = picked.map((c) => `${c.term} (${c.meaning_vi})`).join('; ');
      const aiReading = picked.length ? await _callGeminiJsonDirect(
        `Write an authentic 3-paragraph English industrial electronics / PLC field engineering report incorporating these ${picked.length} terms verbatim: ${termsTxt}.\nAlso create 3 Vietnamese/English comprehension MCQ questions testing these terms.\nReturn JSON ONLY: {"title_en": "...", "title_vi": "...", "paragraphs": [{"en": "...", "vi": "..."}], "questions": [{"question": "...", "options": ["A","B","C","D"], "correct_index": 0, "explanation_vi": "..."}]}`
      ) : null;
      if (aiReading && Array.isArray(aiReading.paragraphs) && aiReading.paragraphs.length) {
        return _jsonResponse({
          engine: 'gemini',
          title_en: aiReading.title_en || 'Field Service Bulletin',
          title_vi: aiReading.title_vi || 'Bản tin Xử lý Sự cố Kỹ thuật',
          target_cards: picked,
          paragraphs: aiReading.paragraphs.slice(0, 4),
          questions: Array.isArray(aiReading.questions) ? aiReading.questions.slice(0, 3) : [],
        });
      }
      const p1 = picked.slice(0, 3).map((c) => c.example_en || `Inspect ${c.term} first during troubleshooting.`).join(' ');
      const p2 = picked.slice(3, 6).map((c) => c.example_en || `Verify ${c.term} under load conditions.`).join(' ');
      const p3 = picked.slice(6).map((c) => c.example_en || `Document ${c.term} in the maintenance log.`).join(' ') || `Remember to log ${picked[0]?.term || 'key findings'} cleanly after verification.`;
      return _jsonResponse({
        engine: 'offline',
        title_en: `Offline Field Bulletin: ${picked[0]?.term || 'Diagnostics'} (${picked.length} Terms)`,
        title_vi: `Bản tin Kỹ thuật Offline: ${picked[0]?.term || 'Chẩn đoán'} (${picked.length} từ mục tiêu)`,
        target_cards: picked,
        paragraphs: [
          { en: p1, vi: picked.slice(0, 3).map((c) => c.example_vi || c.meaning_vi).join(' ') },
          { en: p2, vi: picked.slice(3, 6).map((c) => c.example_vi || c.meaning_vi).join(' ') },
          { en: p3, vi: picked.slice(6).map((c) => c.example_vi || c.meaning_vi).join(' ') },
        ],
        questions: picked.slice(0, 3).map((c, idx) => ({
          question: `What does "${c.term}" refer to in this troubleshooting context?`,
          options: [
            picked[(idx + 1) % picked.length]?.meaning_vi || 'Thiết bị phụ trợ',
            c.meaning_vi,
            picked[(idx + 2) % picked.length]?.meaning_vi || 'Lỗi kết nối',
            'Không liên quan đến phần cứng',
          ],
          correct_index: 1,
          explanation_vi: `"${c.term}" mang nghĩa: ${c.meaning_vi}.`,
        })),
      });
    }
    if (p === '/api/english/magic-fill' && m === 'POST') {
      const term = String(body.term || '').trim();
      const low = term.toLowerCase();
      const ai = await _callGeminiJsonDirect(
        `Fill technical English SRS flashcard for electronics/automation term "${term}". Return JSON: term, ipa, word_class, category, meaning_vi, collocations, example_en, example_vi.`
      );
      if (ai && ai.meaning_vi) return _jsonResponse({ engine: 'gemini', ...ai });
      const cardHit = (snap.english_cards || []).find((c) => String(c.term || '').trim().toLowerCase() === low);
      if (cardHit) return _jsonResponse({ engine: 'database', ...cardHit });
      const glossHit = (snap.en_glossary || []).find((g) => {
        const ge = String(g.en || '').trim().toLowerCase();
        return ge === low || ge.includes(low) || low.includes(ge);
      });
      if (glossHit) {
        return _jsonResponse({
          engine: 'offline',
          term,
          ipa: '/.../',
          word_class: term.split(/\s+/).length >= 4 ? 'Lexical Chunk' : 'Noun',
          category: _normalizeEnCat(glossHit.category || body.category_hint, term),
          meaning_vi: glossHit.vi,
          collocations: `inspect ${term}, verify ${term}`,
          example_en: `Technicians inspect ${term} during routine drive and PLC diagnostics.`,
          example_vi: `Kỹ thuật viên kiểm tra ${glossHit.vi.toLowerCase()} trong quá trình chẩn đoán biến tần và PLC.`,
        });
      }
      return _jsonResponse({
        engine: 'offline',
        term,
        ipa: '/.../',
        word_class: term.includes(',') || term.split(' ').length >= 4 ? 'Lexical Chunk' : 'Noun',
        category: _normalizeEnCat(body.category_hint, term),
        meaning_vi: `Thuật ngữ kỹ thuật: ${term}`,
        collocations: `inspect ${term}, verify ${term}`,
        example_en: `Always verify ${term} according to the engineering datasheet.`,
        example_vi: `Luôn kiểm tra ${term} theo đúng tài liệu kỹ thuật.`,
      });
    }
    if (p === '/api/english/scan-mrl-records' && m === 'GET') {
      const cards = snap.english_cards || [];
      const existingLow = new Set(cards.map((c) => String(c.term || '').trim().toLowerCase()));
      const existingDrillsLow = new Set((snap.english_combat_drills || []).map((d) => String(d.source_vi || '').trim().toLowerCase()));

      const corpus = [];
      (snap.repair_cases || []).forEach((r) => {
        const txt = [
          r.brand_model || '',
          r.cold_check_raw || '',
          r.fault_symptom_raw || '',
          r.root_cause_raw || '',
          r.solution_raw || '',
          r.note || '',
          ...(r.fault_codes || []),
          ...(r.component_tags || []),
        ].join(' ');
        corpus.push({ id: r.id, scope: 'MRL Repair', title: r.brand_model || r.id, text: txt, vi_line: r.fault_symptom_raw || r.root_cause_raw || '' });
      });
      (snap.knowledge_items || []).forEach((k) => {
        const txt = [k.topic_model || '', k.key_takeaway || '', k.core_concept_workflow || '', k.actionable_application || ''].join(' ');
        corpus.push({ id: k.id, scope: 'MRL Knowledge', title: k.topic_model || k.id, text: txt, vi_line: k.key_takeaway || k.core_concept_workflow || '' });
      });
      (snap.plc_notes || []).forEach((pl) => {
        const txt = [pl.title || '', pl.core_summary || '', pl.code_snippet || ''].join(' ');
        corpus.push({ id: pl.id, scope: 'PLC', title: pl.title || pl.id, text: txt, vi_line: pl.core_summary || '' });
      });
      (snap.network_notes || []).forEach((n) => {
        const txt = [
          n.protocol || '',
          n.target_device || '',
          n.physical_wiring || '',
          n.comm_settings || '',
          n.troubleshooting_tips || '',
        ].join(' ');
        corpus.push({ id: n.id, scope: 'Network', title: n.target_device || n.protocol || n.id, text: txt, vi_line: n.troubleshooting_tips || n.physical_wiring || '' });
      });

      const candidateCards = [];
      const seenCands = new Set();
      (snap.en_glossary || []).forEach((g) => {
        const enT = String(g.en || '').trim();
        const viT = String(g.vi || '').trim();
        const lowEn = enT.toLowerCase();
        if (!enT || existingLow.has(lowEn) || seenCands.has(lowEn)) return;
        const baseEn = enT.replace(/\s*[\(\[].*?[\)\]]/g, '').trim().toLowerCase();
        for (const item of corpus) {
          const tLow = item.text.toLowerCase();
          if ((baseEn.length >= 4 && tLow.includes(baseEn)) || (viT.length >= 4 && tLow.includes(viT.toLowerCase()))) {
            seenCands.add(lowEn);
            candidateCards.push({
              term: enT,
              ipa: '/.../',
              word_class: enT.split(/\s+/).length >= 4 ? 'Lexical Chunk' : 'Noun',
              category: _normalizeEnCat(g.category, enT),
              meaning_vi: viT || g.note || enT,
              example_en: `Observed in ${item.id}: technicians inspect ${enT} during diagnostics.`,
              example_vi: `Trích từ ${item.id}: ${item.title}.`,
              linked_record_id: item.id,
              source_scope: item.scope,
            });
            break;
          }
        }
      });

      if (candidateCards.length < 6) {
        (snap.en_glossary || []).forEach((g) => {
          if (candidateCards.length >= 15) return;
          const enT = String(g.en || '').trim();
          const lowEn = enT.toLowerCase();
          if (!enT || existingLow.has(lowEn) || seenCands.has(lowEn)) return;
          seenCands.add(lowEn);
          candidateCards.push({
            term: enT,
            ipa: '/.../',
            word_class: enT.split(/\s+/).length >= 4 ? 'Lexical Chunk' : 'Noun',
            category: _normalizeEnCat(g.category, enT),
            meaning_vi: g.vi || g.note || enT,
            example_en: `Check ${enT} during system inspection.`,
            example_vi: g.vi || '',
            linked_record_id: 'GLOSSARY',
            source_scope: 'Glossary',
          });
        });
      }

      const candidateDrills = [];
      for (const item of corpus) {
        if (candidateDrills.length >= 6) break;
        const line = String(item.vi_line || '').split(/[\n.]/)[0].trim();
        if (line.length < 18 || existingDrillsLow.has(line.toLowerCase())) continue;
        existingDrillsLow.add(line.toLowerCase());
        const refTr = _offlineTechnicalTranslate(line, snap, 'vi', 'en');
        const terms = _extractMatchingTerms(line, snap).slice(0, 3).map((t) => t.en);
        candidateDrills.push({
          drill_mode: 'translation',
          category: item.scope === 'Network' ? 'Mạng truyền thông' : (item.scope === 'PLC' ? 'PLC & Tự động hóa' : 'Biến tần & Phần cứng'),
          source_vi: line,
          prompt_en: `Explain/report issue from ${item.id} (${item.title}) in Technical English:`,
          target_keywords: terms.length ? terms : ['inspect', 'fault'],
          reference_en: refTr,
          spoken_en: refTr,
          grammar_notes: `Trích xuất tự động từ ${item.id}.`,
          linked_record_id: item.id,
        });
      }

      return _jsonResponse({
        scanned_records: corpus.length,
        candidate_cards: candidateCards.slice(0, 15),
        candidate_drills: candidateDrills,
      });
    }
    if (p === '/api/english/extract-manual' && m === 'POST') {
      const txt = String(body.manual_text || '');
      const cards = snap.english_cards || [];
      const existingLow = new Set(cards.map((c) => String(c.term || '').toLowerCase()));

      const aiExt = await _callGeminiJsonDirect(
        `Extract 6 to 10 important technical English terms or lexical chunks from this industrial engineering manual excerpt and translate to Vietnamese.\nText:\n${txt.slice(0, 3000)}\nReturn JSON ONLY: {"summary_vi": "...", "terms": [{"term": "...", "ipa": "...", "word_class": "...", "category": "...", "meaning_vi": "...", "collocations": "...", "example_en": "...", "example_vi": "..."}]}`
      );
      if (aiExt && Array.isArray(aiExt.terms) && aiExt.terms.length) {
        const aiTerms = aiExt.terms.slice(0, 10).map((it) => ({
          term: String(it.term || '').trim(),
          ipa: String(it.ipa || '/.../'),
          word_class: String(it.word_class || 'Noun'),
          category: _normalizeEnCat(it.category, it.term),
          meaning_vi: String(it.meaning_vi || '').trim(),
          collocations: String(it.collocations || ''),
          example_en: String(it.example_en || ''),
          example_vi: String(it.example_vi || ''),
          already_in_bank: existingLow.has(String(it.term || '').trim().toLowerCase()),
        })).filter((it) => it.term && it.meaning_vi);
        if (aiTerms.length) {
          return _jsonResponse({
            engine: 'gemini',
            summary_vi: aiExt.summary_vi || `Đã bóc tách ${aiTerms.length} thuật ngữ bằng Gemini AI.`,
            terms: aiTerms,
          });
        }
      }

      const lowTxt = txt.toLowerCase();
      const sents = txt.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
      const findSent = (phrase) => sents.find((s) => s.toLowerCase().includes(phrase.toLowerCase())) || sents[0] || txt.slice(0, 160);
      const seen = new Set();
      const terms = [];

      [...cards, ...(snap.en_glossary || []).map((g) => ({ term: g.en, meaning_vi: g.vi, category: g.category, ipa: '' }))].forEach((entry) => {
        if (terms.length >= 10) return;
        const enT = String(entry.term || '').trim();
        const base = enT.replace(/\s*[\(\[].*?[\)\]]/g, '').trim().toLowerCase();
        if (base.length >= 4 && lowTxt.includes(base) && !seen.has(enT.toLowerCase())) {
          seen.add(enT.toLowerCase());
          terms.push({
            term: enT,
            ipa: entry.ipa || '/.../',
            word_class: enT.split(/\s+/).length >= 4 ? 'Lexical Chunk' : 'Noun',
            category: _normalizeEnCat(entry.category, enT),
            meaning_vi: entry.meaning_vi || enT,
            example_en: findSent(base),
            example_vi: entry.example_vi || `Ngữ cảnh Manual: ${entry.meaning_vi || enT}.`,
            already_in_bank: existingLow.has(enT.toLowerCase()),
          });
        }
      });

      const compMatches = txt.match(/\b(?:[A-Z]{2,6}\s+[A-Za-z]{3,14}|(?:DC|AC|PWM|IGBT|PLC|PID|RS485|PROFINET|Modbus)\s+[A-Za-z-]{3,16}|[a-z]+(?:ing|ed)\s+(?:resistor|capacitor|circuit|voltage|current|fault|alarm|sensor|module|signal))\b/g) || [];
      compMatches.forEach((mStr) => {
        if (terms.length >= 10) return;
        const clean = mStr.replace(/\s+/g, ' ').trim();
        if (clean.length < 5 || seen.has(clean.toLowerCase())) return;
        seen.add(clean.toLowerCase());
        terms.push({
          term: clean,
          ipa: '/.../',
          word_class: 'Noun',
          category: _normalizeEnCat('', clean),
          meaning_vi: `Cụm thuật ngữ trích từ Manual (${clean})`,
          example_en: findSent(clean),
          already_in_bank: existingLow.has(clean.toLowerCase()),
        });
      });

      return _jsonResponse({
        engine: 'offline',
        summary_vi: `Đã bóc tách ${terms.length} thuật ngữ từ Manual (Offline Mobile).`,
        terms: terms.slice(0, 10),
      });
    }
    if (p === '/api/english/bulk-ingest' && m === 'POST') {
      let insertedCards = 0;
      let insertedDrills = 0;
      const existingLow = new Set((snap.english_cards || []).map((c) => String(c.term || '').toLowerCase()));
      (body.cards || []).forEach((c) => {
        const term = String(c.term || c.term_or_chunk || '').trim();
        if (!term || existingLow.has(term.toLowerCase())) return;
        const id = _nextSeqId(snap.english_cards, 'ENG');
        snap.english_cards.unshift({
          id,
          term,
          ipa: c.ipa || '',
          word_class: c.word_class || 'Noun',
          category: _normalizeEnCat(c.category, term),
          meaning_vi: c.meaning_vi || term,
          collocations: c.collocations || '',
          example_en: c.example_en || '',
          example_vi: c.example_vi || '',
          linked_record_id: c.linked_record_id || c.source_ref || 'MOBILE',
          srs_stage: 'new',
          interval_days: 0,
          ease_factor: 2.5,
          repetitions: 0,
          next_review_at: '',
          last_reviewed_at: '',
          created_at: utcNowIso(),
          updated_at: utcNowIso(),
        });
        existingLow.add(term.toLowerCase());
        insertedCards += 1;
      });
      snap.english_combat_drills = snap.english_combat_drills || [];
      const existingPrompts = new Set(snap.english_combat_drills.map((d) => String(d.source_vi || '').trim().toLowerCase()));
      (body.drills || []).forEach((d) => {
        const pVi = String(d.source_vi || d.prompt_vi || '').trim();
        if (!pVi || existingPrompts.has(pVi.toLowerCase())) return;
        const dMode = (d.drill_mode || d.mode) === 'interview' ? 'interview' : 'translation';
        const did = _nextSeqId(snap.english_combat_drills, dMode === 'interview' ? 'CMB-INT' : 'CMB');
        snap.english_combat_drills.push({
          id: did,
          drill_mode: dMode,
          category: _normalizeEnCat(d.category || 'PLC & Tự động hóa'),
          source_vi: pVi,
          prompt_en: d.prompt_en || 'Translate or explain this engineering scenario in fluent English:',
          target_keywords: d.target_keywords || [],
          reference_en: d.reference_en || '',
          spoken_en: d.spoken_en || '',
          grammar_notes: d.grammar_notes || '',
          linked_record_id: d.linked_record_id || '',
          attempts: 0,
          last_score: 0,
          updated_at: utcNowIso(),
        });
        existingPrompts.add(pVi.toLowerCase());
        insertedDrills += 1;
      });
      await saveLocalSnapshot(snap);
      return _jsonResponse({ inserted_cards: insertedCards, inserted_drills: insertedDrills, ..._bootstrapPayloadFromSnap(snap) });
    }
    if (p === '/api/english/generate-quiz' && m === 'POST') {
      const count = Math.min(12, Math.max(4, Number(body.count || 8)));
      const catFilter = String(body.category || 'ALL');
      const manualText = String(body.manual_text || '').trim();
      let pool = (snap.english_cards || []).filter((c) => catFilter === 'ALL' || c.category === catFilter);
      if (!pool.length) pool = (snap.english_cards || []);

      if (manualText && getAiConfig().gemini_api_key) {
        const aiQuiz = await _callGeminiJsonDirect(
          `Create ${count} Technical English OpenQuiz questions (mix of mcq and cloze) from this industrial manual:\n${manualText.slice(0, 2800)}\nReturn JSON ONLY: JSON array of objects with keys quiz_type("mcq"|"cloze"), category, question_text, blank_answer, options(array of 4 strings), correct_index(0-3), explanation_vi, context_quote.`
        );
        if (Array.isArray(aiQuiz) && aiQuiz.length) {
          const formatted = aiQuiz.slice(0, count).map((q, idx) => ({
            id: `MOB-QZ-${Date.now()}-${idx}`,
            quiz_type: q.quiz_type === 'cloze' ? 'cloze' : 'mcq',
            category: _normalizeEnCat(q.category || catFilter),
            question_text: String(q.question_text || '').trim(),
            blank_answer: String(q.blank_answer || '').trim(),
            options: Array.isArray(q.options) ? q.options.slice(0, 4) : [],
            correct_index: Number(q.correct_index || 0),
            explanation_vi: String(q.explanation_vi || ''),
            context_quote: String(q.context_quote || ''),
            source_ref: 'GEMINI-MOBILE',
            status_code: 'review',
          })).filter((q) => q.question_text && q.options.length >= 2);
          if (formatted.length) {
            return _jsonResponse({
              engine: 'gemini',
              generated_count: formatted.length,
              items: formatted,
              generated: formatted,
              english_quizzes: snap.english_quizzes || [],
            });
          }
        }
      }

      const quizzes = pool.slice(0, count).map((c, idx) => {
        const isCloze = idx % 2 === 1 && c.example_en && c.example_en.toLowerCase().includes(c.term.toLowerCase());
        if (isCloze) {
          const masked = c.example_en.replace(new RegExp(_escapeRx(c.term), 'i'), '________');
          const opts = [c.term];
          (snap.english_cards || []).forEach((x) => {
            if (opts.length < 4 && x.id !== c.id && x.term && !opts.includes(x.term)) opts.push(x.term);
          });
          while (opts.length < 4) opts.push('scan cycle');
          const shift = idx % 4;
          const rotated = opts.map((_, i) => opts[(i + shift) % 4]);
          return {
            id: `MOB-CLZ-${Date.now()}-${idx}`,
            quiz_type: 'cloze',
            category: c.category,
            question_text: masked,
            blank_answer: c.term,
            options: rotated,
            correct_index: rotated.indexOf(c.term),
            explanation_vi: `${c.term}: ${c.meaning_vi}`,
            context_quote: c.example_vi || '',
            card_id: c.id,
            status_code: 'review',
          };
        }
        const opts = [c.meaning_vi];
        (snap.english_cards || []).forEach((x) => {
          if (opts.length < 4 && x.id !== c.id && x.meaning_vi && !opts.includes(x.meaning_vi)) opts.push(x.meaning_vi);
        });
        while (opts.length < 4) opts.push('Thông số điều khiển phụ trợ');
        const shift = idx % 4;
        const rotated = opts.map((_, i) => opts[(i + shift) % 4]);
        return {
          id: `MOB-QZ-${Date.now()}-${idx}`,
          quiz_type: 'mcq',
          category: c.category,
          question_text: `Thuật ngữ "${c.term}" (${c.ipa || ''}) có nghĩa chuyên ngành nào đúng nhất?`,
          blank_answer: '',
          options: rotated,
          correct_index: rotated.indexOf(c.meaning_vi),
          explanation_vi: `${c.term}: ${c.meaning_vi}`,
          context_quote: c.example_en || '',
          card_id: c.id,
          status_code: 'review',
        };
      });
      return _jsonResponse({
        engine: 'offline',
        generated_count: quizzes.length,
        items: quizzes,
        generated: quizzes,
        english_quizzes: snap.english_quizzes || [],
      });
    }
    if (p === '/api/en/translate' && m === 'POST') {
      const res = await _translateSingleOfflineOrHybrid(body.text, body.source_lang, body.target_lang, snap);
      return _jsonResponse(res);
    }
    if (p === '/api/en/translate-batch' && m === 'POST') {
      const res = await _translateBatchOfflineOrHybrid(body.texts, body.source_lang, body.target_lang, snap);
      return _jsonResponse(res);
    }
    if (p === '/api/sync/config') {
      if (m === 'GET') {
        const cfg = getSyncConfig();
        return _jsonResponse({ has_token: Boolean(cfg.github_token), gist_id: cfg.gist_id || '', auto_sync: cfg.auto_sync !== false, last_sync_at: cfg.last_sync_at || '', last_sync_status: cfg.last_sync_status || '' });
      }
      const saved = saveSyncConfig({ github_token: body.github_token, gist_id: body.gist_id, auto_sync: body.auto_sync });
      return _jsonResponse({ saved: true, has_token: Boolean(saved.github_token), gist_id: saved.gist_id || '', auto_sync: saved.auto_sync !== false });
    }
    if (p === '/api/sync/create-gist' && m === 'POST') {
      const res = await createPrivateGist(body.github_token || getSyncConfig().github_token);
      return _jsonResponse(res);
    }
    if ((p === '/api/sync' || p === '/api/sync/now') && m === 'POST') {
      const res = await syncNow(body.github_token, body.gist_id);
      return _jsonResponse(res);
    }
    if (p.startsWith('/api/excel/')) {
      return _jsonResponse(
        { detail: 'Xuất/Nhập Excel chỉ khả dụng khi kết nối máy tính (PC LAN). Trên điện thoại hãy dùng Sao lưu JSON / Cloud Sync.' },
        400
      );
    }

    return _jsonResponse({ ok: true, offline: true });
  }

  // Intercept same-origin /api/* calls for seamless Offline IndexedDB mode
  window.fetch = async function patchedFetch(input, init) {
    const rawUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    let urlObj = null;
    try { urlObj = new URL(rawUrl, window.location.href); } catch (_) { /* external/bad */ }
    const isSameApi = Boolean(urlObj && urlObj.origin === window.location.origin && urlObj.pathname.startsWith('/api/'));
    if (!isSameApi) {
      return _nativeFetch(input, init);
    }

    const method = (init && init.method) || (typeof input !== 'string' && input.method) || 'GET';

    // Bootstrap probes whether Python server is reachable (falls back immediately if static host)
    if (urlObj.pathname === '/api/bootstrap') {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 2200) : null;
      try {
        const res = await _nativeFetch(input, { ...(init || {}), signal: ctrl ? ctrl.signal : undefined });
        if (timer) clearTimeout(timer);
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (res.ok && ct.includes('json')) {
          const cloneData = await res.clone().json();
          if (cloneData && Array.isArray(cloneData.repair_cases)) {
            _mode = 'online';
            await _idbSet('snapshot', cloneData);
            _snapshot = cloneData;
            return res;
          }
        }
      } catch (_) {
        if (timer) clearTimeout(timer);
      }
      _mode = 'offline';
      return _handleOfflineApi(rawUrl, method, init);
    }

    if (_mode === 'offline') {
      return _handleOfflineApi(rawUrl, method, init);
    }

    try {
      const res = await _nativeFetch(input, init);
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (res.status === 404 && !ct.includes('json')) {
        _mode = 'offline';
        return _handleOfflineApi(rawUrl, method, init);
      }
      return res;
    } catch (err) {
      _mode = 'offline';
      return _handleOfflineApi(rawUrl, method, init);
    }
  };

  // -------------------------------------------------------------------------
  // Browser Two-Way Cloud Sync Engine (GitHub Private Gist API)
  // -------------------------------------------------------------------------
  function getSyncConfig() {
    try {
      const raw = localStorage.getItem(SYNC_CFG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore */ }
    return { github_token: '', gist_id: '', auto_sync: true, last_sync_at: '', last_sync_status: '' };
  }

  function saveSyncConfig(partial) {
    const cur = getSyncConfig();
    const next = { ...cur };
    if (partial.github_token !== undefined && partial.github_token !== '__KEEP__') {
      next.github_token = String(partial.github_token || '').trim();
    }
    if (partial.gist_id !== undefined) next.gist_id = String(partial.gist_id || '').trim();
    if (partial.auto_sync !== undefined) next.auto_sync = Boolean(partial.auto_sync);
    if (partial.last_sync_at !== undefined) next.last_sync_at = String(partial.last_sync_at || '');
    if (partial.last_sync_status !== undefined) next.last_sync_status = String(partial.last_sync_status || '');
    try { localStorage.setItem(SYNC_CFG_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  }

  function _mergeById(locList, remList, kind, tombstones, stats) {
    const locMap = new Map((locList || []).filter((x) => x && x.id).map((x) => [String(x.id), x]));
    const remMap = new Map((remList || []).filter((x) => x && x.id).map((x) => [String(x.id), x]));
    const ids = Array.from(new Set([...locMap.keys(), ...remMap.keys()])).sort();
    const out = [];
    ids.forEach((id) => {
      const tKey = `${kind}:${id}`;
      const tombTs = parseTs(tombstones[tKey] || '');
      const loc = locMap.get(id);
      const rem = remMap.get(id);
      const locTs = loc ? parseTs(loc.updated_at || loc.last_reviewed_at || loc.created_at) : 0;
      const remTs = rem ? parseTs(rem.updated_at || rem.last_reviewed_at || rem.created_at) : 0;
      const bestTs = Math.max(locTs, remTs);

      if (tombTs > 0 && tombTs >= bestTs) {
        if (loc) stats.deleted += 1;
        return;
      }
      if (tombTs > 0 && bestTs > tombTs) delete tombstones[tKey];

      if (rem && !loc) { stats.pulled += 1; out.push({ ...rem }); }
      else if (loc && !rem) { stats.pushed += 1; out.push({ ...loc }); }
      else if (rem && loc) {
        if (remTs > locTs) { stats.pulled += 1; out.push({ ...rem }); }
        else { if (locTs > remTs) stats.pushed += 1; out.push({ ...loc }); }
      }
    });
    return out;
  }

  function mergeSnapshots(localSnap, remoteSnap) {
    const stats = { pulled: 0, pushed: 0, deleted: 0 };
    if (!remoteSnap || typeof remoteSnap !== 'object') return { merged: { ...localSnap }, stats };

    const tombstones = {};
    [localSnap.tombstones || {}, remoteSnap.tombstones || {}].forEach((src) => {
      Object.entries(src).forEach(([k, v]) => {
        if (!tombstones[k] || parseTs(v) > parseTs(tombstones[k])) tombstones[k] = ensureIsoTs(v);
      });
    });

    const streakMap = new Map();
    [...(localSnap.english_streak_logs || []), ...(remoteSnap.english_streak_logs || [])].forEach((r) => {
      if (!r || !r.study_date) return;
      const prev = streakMap.get(r.study_date);
      if (!prev) streakMap.set(r.study_date, { ...r });
      else {
        prev.cards_reviewed = Math.max(Number(prev.cards_reviewed || 0), Number(r.cards_reviewed || 0));
        prev.combat_completed = Math.max(Number(prev.combat_completed || 0), Number(r.combat_completed || 0));
        prev.xp_earned = Math.max(Number(prev.xp_earned || 0), Number(r.xp_earned || 0));
        prev.goal_reached = Math.max(Number(prev.goal_reached || 0), Number(r.goal_reached || 0));
        if (parseTs(r.updated_at) > parseTs(prev.updated_at)) prev.updated_at = ensureIsoTs(r.updated_at);
      }
    });

    const locSp = localSnap.scratchpads || {};
    const remSp = remoteSnap.scratchpads || {};
    const mergedSp = {};
    new Set([...Object.keys(locSp), ...Object.keys(remSp), 'mrl', 'plc', 'network', 'english']).forEach((ws) => {
      const l = locSp[ws]; const r = remSp[ws];
      if (r && !l) mergedSp[ws] = r;
      else if (l && !r) mergedSp[ws] = l;
      else if (l && r) mergedSp[ws] = parseTs(r.updated_at) > parseTs(l.updated_at) ? r : l;
      else mergedSp[ws] = { workspace: ws, content: '', images_json: [], font_mode: 'sans', updated_at: '' };
    });

    const locRp = localSnap.review_progress || {};
    const remRp = remoteSnap.review_progress || {};
    const mergedRp = {};
    new Set([...Object.keys(locRp), ...Object.keys(remRp)]).forEach((ck) => {
      const l = locRp[ck]; const r = remRp[ck];
      if (r && !l) mergedRp[ck] = r;
      else if (l && !r) mergedRp[ck] = l;
      else mergedRp[ck] = parseTs(r.last_reviewed) > parseTs(l.last_reviewed) ? r : l;
    });

    const remNewerCats = parseTs(remoteSnap.exported_at) > parseTs(localSnap.exported_at) && remoteSnap.workspace_categories;
    const mergedCats = remNewerCats
      ? { ...(localSnap.workspace_categories || {}), ...(remoteSnap.workspace_categories || {}) }
      : { ...(remoteSnap.workspace_categories || {}), ...(localSnap.workspace_categories || {}) };

    const merged = {
      ...localSnap,
      schema_version: 2,
      exported_at: utcNowIso(),
      repair_cases: _mergeById(localSnap.repair_cases, remoteSnap.repair_cases, 'repair', tombstones, stats),
      knowledge_items: _mergeById(localSnap.knowledge_items, remoteSnap.knowledge_items, 'knowledge', tombstones, stats),
      plc_notes: _mergeById(localSnap.plc_notes, remoteSnap.plc_notes, 'plc', tombstones, stats),
      network_notes: _mergeById(localSnap.network_notes, remoteSnap.network_notes, 'network', tombstones, stats),
      english_cards: _mergeById(localSnap.english_cards, remoteSnap.english_cards, 'english_card', tombstones, stats),
      english_combat_drills: _mergeById(localSnap.english_combat_drills, remoteSnap.english_combat_drills, 'combat_drill', tombstones, stats),
      english_quizzes: _mergeById(localSnap.english_quizzes, remoteSnap.english_quizzes, 'english_quiz', tombstones, stats),
      english_streak_logs: Array.from(streakMap.values()).sort((a, b) => a.study_date.localeCompare(b.study_date)),
      scratchpads: mergedSp,
      review_progress: mergedRp,
      workspace_categories: mergedCats,
      en_glossary: (localSnap.en_glossary && localSnap.en_glossary.length) ? localSnap.en_glossary : (remoteSnap.en_glossary || []),
      translation_cache: _mergeTranslationMaps(localSnap.translation_cache, remoteSnap.translation_cache),
      tombstones,
    };
    _refreshDerivedFields(merged);
    return { merged, stats };
  }

  async function _ghFetch(url, method, token, body) {
    const res = await _nativeFetch(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`GitHub HTTP ${res.status}: ${txt.slice(0, 160)}`);
    }
    return res.json();
  }

  async function createPrivateGist(tokenOverride) {
    const cfg = getSyncConfig();
    const tok = String(tokenOverride || cfg.github_token || '').trim();
    if (!tok) throw new Error('Vui lòng nhập GitHub Personal Access Token (quyền gist)');
    if (_mode === 'online') {
      const res = await _nativeFetch('/api/sync/create-gist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_token: tok }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Tạo Gist thất bại');
      const data = await res.json();
      saveSyncConfig({ github_token: tok, gist_id: data.gist_id, last_sync_at: data.updated_at, last_sync_status: 'Đã tạo Private Gist' });
      return data;
    }
    const snap = await ensureLocalSnapshot();
    const data = await _ghFetch('https://api.github.com/gists', 'POST', tok, {
      description: 'MRL Workbench Two-Way Cloud Sync',
      public: false,
      files: { 'mrl_cloud_sync.json': { content: JSON.stringify(snap) } },
    });
    saveSyncConfig({ github_token: tok, gist_id: data.id, last_sync_at: utcNowIso(), last_sync_status: 'Đã tạo Private Gist (Mobile)' });
    return { gist_id: data.id, html_url: data.html_url, updated_at: utcNowIso() };
  }

  async function syncNow(tokenOverride, gistOverride) {
    const cfg = getSyncConfig();
    const tok = String(tokenOverride || cfg.github_token || '').trim();
    let gid = String(gistOverride || cfg.gist_id || '').trim();

    if (_mode === 'online') {
      const res = await _nativeFetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_token: tok || '__KEEP__', gist_id: gid }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Đồng bộ Cloud thất bại');
      }
      const data = await res.json();
      saveSyncConfig({
        github_token: tok || undefined,
        gist_id: data.gist_id,
        last_sync_at: data.last_sync_at,
        last_sync_status: data.cloud_sync?.last_sync_status || `↓${data.pulled} ↑${data.pushed} 🗑${data.deleted}`,
      });
      _setUnsyncedFlag(false);
      if (data.bootstrap && typeof applyBootstrapData === 'function') {
        await _idbSet('snapshot', data.bootstrap);
        _snapshot = data.bootstrap;
        applyBootstrapData(data.bootstrap, true);
      }
      return data;
    }

    if (!tok) throw new Error('Vui lòng nhập GitHub Personal Access Token để đồng bộ');
    if (!gid) {
      const created = await createPrivateGist(tok);
      gid = created.gist_id;
    }
    const gMeta = await _ghFetch(`https://api.github.com/gists/${encodeURIComponent(gid)}`, 'GET', tok);
    const fobj = gMeta.files?.['mrl_cloud_sync.json'] || Object.values(gMeta.files || {})[0];
    let remoteSnap = {};
    if (fobj) {
      let rawText = fobj.content || '{}';
      if (fobj.truncated && fobj.raw_url) {
        rawText = await _nativeFetch(fobj.raw_url).then((r) => r.text());
      }
      try { remoteSnap = JSON.parse(rawText); } catch (_) { remoteSnap = {}; }
    }
    const localSnap = await ensureLocalSnapshot();
    const { merged, stats } = mergeSnapshots(localSnap, remoteSnap);
    await saveLocalSnapshot(merged, false);
    await _ghFetch(`https://api.github.com/gists/${encodeURIComponent(gid)}`, 'PATCH', tok, {
      description: 'MRL Workbench Two-Way Cloud Sync',
      files: { 'mrl_cloud_sync.json': { content: JSON.stringify(merged) } },
    });
    const nowIso = utcNowIso();
    const statusMsg = `OK (Offline Mobile) · ↓${stats.pulled} ↑${stats.pushed} 🗑${stats.deleted}`;
    saveSyncConfig({ github_token: tok, gist_id: gid, last_sync_at: nowIso, last_sync_status: statusMsg });
    _setUnsyncedFlag(false);
    const boot = _bootstrapPayloadFromSnap(merged);
    if (typeof applyBootstrapData === 'function') applyBootstrapData(boot, true);
    return { ok: true, gist_id: gid, ...stats, last_sync_at: nowIso, bootstrap: boot };
  }

  function scheduleAutoPush() {
    const cfg = getSyncConfig();
    if (_mode !== 'offline' || !cfg.github_token || !cfg.gist_id || cfg.auto_sync === false) return;
    clearTimeout(_autoPushTimer);
    _autoPushTimer = setTimeout(() => {
      syncNow(cfg.github_token, cfg.gist_id).catch(() => {});
    }, 2000);
  }

  async function exportBackupJson() {
    const snap = _mode === 'online'
      ? await _nativeFetch('/mrl_initial_seed.json').then((r) => r.json())
      : await ensureLocalSnapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mrl_backup_${localDateKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  async function importBackupJson(file) {
    const txt = await file.text();
    const parsed = JSON.parse(txt);
    if (!parsed || !Array.isArray(parsed.repair_cases)) throw new Error('File JSON không đúng định dạng MRL');
    const localSnap = await ensureLocalSnapshot();
    const { merged, stats } = mergeSnapshots(localSnap, parsed);
    await saveLocalSnapshot(merged, true);
    if (typeof applyBootstrapData === 'function') applyBootstrapData(_bootstrapPayloadFromSnap(merged), true);
    return stats;
  }

  // -------------------------------------------------------------------------
  // Service Worker & OTA Auto-Update Registration
  // -------------------------------------------------------------------------
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!['http:', 'https:'].includes(location.protocol)) return;
    const swUrl = location.pathname.includes('mobile_dist') || document.querySelector('meta[name="mrl-build"]')
      ? './service-worker.js'
      : '/service-worker.js';
    navigator.serviceWorker.register(swUrl).then((reg) => {
      _swReg = reg;
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller && !_otaBannerShown) {
            _otaBannerShown = true;
            if (typeof showToast === 'function') {
              showToast('✨ Có bản cập nhật giao diện mới (OTA)! Đang áp dụng...', 'success');
            }
          }
        });
      });
    }).catch(() => {});
  }

  async function checkOtaUpdate() {
    if (_swReg && typeof _swReg.update === 'function') {
      await _swReg.update().catch(() => {});
    }
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys().catch(() => []);
      await Promise.all(keys.filter((k) => k.startsWith('mrl-pwa-')).map((k) => caches.delete(k)));
    }
    window.location.reload();
  }

  registerServiceWorker();

  window.MRLCoreStore = {
    getMode: () => _mode,
    resolveAssetUrl,
    hasUnsyncedChanges,
    ensureLocalSnapshot,
    saveLocalSnapshot,
    getAiConfig,
    saveAiConfig,
    checkOtaUpdate,
    utcNowIso,
    evaluateFlashcardOffline: evaluateFlashcardOfflineJS,
    followUpFlashcardOffline: buildFlashcardFollowUpOfflineJS,
  };

  window.MRLSyncEngine = {
    getConfig: getSyncConfig,
    saveConfig: saveSyncConfig,
    mergeSnapshots,
    createPrivateGist,
    syncNow,
    scheduleAutoPush,
    exportBackupJson,
    importBackupJson,
  };
})();
