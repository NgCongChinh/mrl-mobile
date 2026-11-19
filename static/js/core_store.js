/* ==========================================================================
   MRL Shared Core Store, Transparent Offline Router, Two-Way Gist Sync & OTA
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

  let _mode = 'unknown'; // 'unknown' | 'online' | 'offline'
  let _snapshot = null;
  let _initPromise = null;
  let _autoPushTimer = null;
  let _swReg = null;
  let _otaBannerShown = false;

  const STATUS_LABELS = {
    mastered: '🟢 ĐÃ LÀM CHỦ',
    review: '🟡 CẦN XEM LẠI',
    researching: '🔴 ĐANG NGHIÊN CỨU',
    unclassified: '⚪ CHƯA PHÂN LOẠI',
  };

  function utcNowIso() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  function localDateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
    const iso = ensureIsoTs(val);
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
      const isDue = st === 'new' || st === 'learning' || !nxtMs || nxtMs <= nowMs;
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
      (r.component_tags || []).forEach((t) => { compMap[t] = (compMap[t] || 0) + 1; });
      (r.fault_codes || []).forEach((f) => { faultMap[f] = (faultMap[f] || 0) + 1; });
    });
    knws.forEach((k) => {
      (k.component_tags || []).forEach((t) => { compMap[t] = (compMap[t] || 0) + 1; });
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
      component_tags: Object.entries(compMap).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count })),
      fault_codes: Object.entries(faultMap).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([code, count]) => ({ code, count })),
    };
    snap.srs_counts = _computeSrsCounts(snap.english_cards || []);
    snap.english_streak = _computeStreakSummary(snap.english_streak_logs || []);

    // Mirror english_cards -> english_vocab & en_vocabulary for compatibility
    const cards = snap.english_cards || [];
    if (cards.length) {
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
        vi_term: c.meaning_vi || '',
        en_term: c.term || '',
        category: c.category || 'TECH',
        example_vi: c.example_vi || '',
        example_en: c.example_en || '',
        source_ref: c.linked_record_id || '',
        rating: c.srs_stage === 'mastered' ? 'mastered' : (c.srs_stage === 'new' ? 'researching' : 'review'),
      }));
    }
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
      tombstones: {},
    };
  }

  async function ensureLocalSnapshot() {
    if (_snapshot) return _snapshot;
    let stored = await _idbGet('snapshot');
    if (!stored || !Array.isArray(stored.repair_cases)) {
      stored = await _fetchInitialSeed();
      _refreshDerivedFields(stored);
      await _idbSet('snapshot', stored);
    } else {
      _refreshDerivedFields(stored);
    }
    _snapshot = stored;
    return _snapshot;
  }

  async function saveLocalSnapshot(snap, scheduleSync = true) {
    snap.exported_at = utcNowIso();
    _refreshDerivedFields(snap);
    _snapshot = snap;
    await _idbSet('snapshot', snap);
    if (scheduleSync) scheduleAutoPush();
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
          const maxDim = 1080;
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

  async function _callGeminiJsonDirect(promptText) {
    const cfg = getAiConfig();
    const key = (cfg.gemini_api_key || '').trim();
    if (!key) return null;
    const model = cfg.gemini_model || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    try {
      const res = await _nativeFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.35, responseMimeType: 'application/json' },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const m = txt.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      return m ? JSON.parse(m[1]) : JSON.parse(txt);
    } catch (_) {
      return null;
    }
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
        qr_svg: '',
        cloud_sync: {
          has_token: Boolean(cfg.github_token),
          gist_id: cfg.gist_id || '',
          auto_sync: cfg.auto_sync !== false,
          last_sync_at: cfg.last_sync_at || '',
          last_sync_status: cfg.last_sync_status || '',
        },
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
      const steps = (body.steps || []).length
        ? body.steps.map((s, idx) => ({ step_id: Date.now() + idx, step_order: idx + 1, symptom: s.symptom || '', root_cause: s.root_cause || '', solution: s.solution || '' }))
        : [{ step_id: Date.now(), step_order: 1, symptom: body.fault_symptom_raw || '', root_cause: body.root_cause_raw || '', solution: body.solution_raw || '' }];
      const rec = {
        id,
        record_date: body.record_date || localDateKey(),
        device_category: body.device_category || 'VFD',
        brand_model: body.brand_model || id,
        fault_symptom_raw: steps.map((s) => s.symptom).filter(Boolean).join('\n'),
        root_cause_raw: steps.map((s) => s.root_cause).filter(Boolean).join('\n'),
        solution_raw: steps.map((s) => s.solution).filter(Boolean).join('\n'),
        note: body.note || '',
        status_code: sc,
        status_label: sl,
        component_tags: body.component_tags || [],
        fault_codes: body.fault_codes || [],
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
    let match = p.match(/^\/api\/repair-cases\/([^/]+)\/status$/);
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
        const steps = (body.steps || []).length ? body.steps.map((s, i) => ({ ...s, step_order: i + 1 })) : cur.steps;
        const updated = {
          ...cur,
          ...body,
          id,
          status_code: sc,
          status_label: sl,
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

    // ---- Attachments & Camera Capture (compressed DataURL) ----
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
    match = p.match(/^\/api\/workspace-categories\/([^/]+)$/);
    if (match && m === 'PUT') {
      const sc = decodeURIComponent(match[1]);
      snap.workspace_categories = snap.workspace_categories || {};
      snap.workspace_categories[sc] = (body.items || []).map((it) => ({
        key: it.key || it.label,
        label: it.label || it.key,
      }));
      await saveLocalSnapshot(snap);
      return _jsonResponse({ scope: sc, items: snap.workspace_categories[sc], workspace_categories: snap.workspace_categories });
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
      const clean = decodeURIComponent(match[1]).toUpperCase();
      return _jsonResponse({
        tag: clean,
        repair_cases: (snap.repair_cases || []).filter((r) => (r.component_tags || []).includes(clean) || (r.fault_codes || []).includes(clean)),
        knowledge_items: (snap.knowledge_items || []).filter((k) => (k.component_tags || []).includes(clean)),
      });
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
      card.last_reviewed_at = utcNowIso();
      card.next_review_at = nextDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
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
      ids.slice(0, 10).forEach((cid) => {
        const c = (snap.english_cards || []).find((x) => x.id === cid);
        if (!c) return;
        let ivl = Number(c.interval_days || 0);
        c.repetitions = Number(c.repetitions || 0) + 1;
        if (ratio >= 0.66) {
          ivl = ivl <= 0 ? 1 : Math.max(2, Math.round(ivl * 1.6));
          c.srs_stage = ivl >= 21 ? 'mastered' : (ivl <= 1 ? 'learning' : 'review');
          const d = new Date(); d.setDate(d.getDate() + ivl);
          c.next_review_at = d.toISOString().replace(/\.\d{3}Z$/, 'Z');
        } else {
          ivl = Math.min(ivl, 1);
          c.srs_stage = 'learning';
          c.next_review_at = utcNowIso();
        }
        c.interval_days = ivl;
        c.last_reviewed_at = utcNowIso();
        c.updated_at = utcNowIso();
        synced.push({ id: c.id, term: c.term, srs_stage: c.srs_stage, interval_days: ivl });
      });
      _recordStreakHit(snap, Math.min(2, synced.length), 0, 15);
      await saveLocalSnapshot(snap);
      return _jsonResponse({ synced, ..._bootstrapPayloadFromSnap(snap) });
    }
    if (p === '/api/english/evaluate-combat' && m === 'POST') {
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
      _recordStreakHit(snap, 0, 1, 18);
      await saveLocalSnapshot(snap);
      return _jsonResponse({
        engine: aiRes ? 'gemini' : 'offline',
        mode: body.mode || 'speaking',
        score,
        verdict: aiRes?.verdict || (missing.length ? `Khớp ${matched.length}/${kws.length} từ khóa bắt buộc (Chế độ Offline Mobile).` : 'Xuất sắc! Bạn đã dùng đủ toàn bộ từ khóa mục tiêu (Offline Mobile).'),
        user_original: body.user_en || '',
        corrected_user_en: aiRes?.corrected_user_en || body.user_en || '',
        grammar_notes: aiRes?.grammar_notes || [missing.length ? `Cần bổ sung: ${missing.join(', ')}` : 'Cấu trúc rõ ràng, giữ vững phản xạ tự nhiên.'],
        natural_en_report: aiRes?.natural_en_report || body.reference_en || body.user_en,
        natural_en_interview: aiRes?.natural_en_interview || drill?.spoken_en || body.reference_en || body.user_en,
        matched_keywords: matched,
        missing_keywords: missing,
        core_vocab: [],
        active_recall_synced: [],
        ..._bootstrapPayloadFromSnap(snap),
      });
    }
    if (p === '/api/english/generate-reading' && m === 'POST') {
      const count = Math.min(10, Math.max(5, Number(body.count || 7)));
      const cards = (snap.english_cards || []);
      const picked = [...cards.filter((c) => c.is_due), ...cards.filter((c) => !c.is_due)].slice(0, count);
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
      const ai = await _callGeminiJsonDirect(
        `Fill technical English SRS flashcard for electronics/automation term "${term}". Return JSON: term, ipa, word_class, category, meaning_vi, collocations, example_en, example_vi.`
      );
      return _jsonResponse(ai || {
        term,
        ipa: '/.../',
        word_class: term.includes(',') || term.split(' ').length >= 4 ? 'Lexical Chunk' : 'Noun',
        category: 'PLC & Tự động hóa',
        meaning_vi: `Thuật ngữ kỹ thuật: ${term}`,
        collocations: `inspect ${term}, verify ${term}`,
        example_en: `Always verify ${term} according to the engineering datasheet.`,
        example_vi: `Luôn kiểm tra ${term} theo đúng tài liệu kỹ thuật.`,
      });
    }
    if (p === '/api/english/scan-mrl-records' && m === 'GET') {
      const cards = snap.english_cards || [];
      const existingLow = new Set(cards.map((c) => String(c.term || '').toLowerCase()));
      const candidates = [];
      (snap.en_glossary || []).forEach((g) => {
        if (!g.en || existingLow.has(g.en.toLowerCase())) return;
        candidates.push({
          term: g.en,
          ipa: '/.../',
          word_class: 'Noun',
          category: g.category === 'NET' ? 'Mạng truyền thông' : (g.category === 'PLC' ? 'PLC & Tự động hóa' : 'Biến tần & Phần cứng'),
          meaning_vi: g.vi || g.note || g.en,
          example_en: `Check ${g.en} during system inspection.`,
          example_vi: g.vi || '',
          linked_record_id: 'GLOSSARY',
        });
      });
      return _jsonResponse({
        scanned_records: (snap.repair_cases?.length || 0) + (snap.knowledge_items?.length || 0) + (snap.plc_notes?.length || 0) + (snap.network_notes?.length || 0),
        candidate_cards: candidates.slice(0, 12),
        candidate_drills: [],
      });
    }
    if (p === '/api/english/extract-manual' && m === 'POST') {
      const txt = String(body.manual_text || '');
      const cards = snap.english_cards || [];
      const existingLow = new Set(cards.map((c) => String(c.term || '').toLowerCase()));
      const matches = txt.match(/\b(?:pre-charge resistor|inrush current|bootstrap capacitor|optocoupler|gate driver|scan cycle|wiring diagram|terminating resistors?|ground loop|dc bus|undervoltage|overcurrent)\b/gi) || [];
      const seen = new Set();
      const terms = [];
      matches.forEach((mStr) => {
        const clean = mStr.trim();
        if (seen.has(clean.toLowerCase())) return;
        seen.add(clean.toLowerCase());
        terms.push({
          term: clean,
          ipa: '/.../',
          word_class: 'Noun',
          category: 'Biến tần & Phần cứng',
          meaning_vi: `Thuật ngữ kỹ thuật bóc tách từ Manual (${clean})`,
          example_en: txt.split(/[.!?]/).find((s) => s.toLowerCase().includes(clean.toLowerCase()))?.trim() || '',
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
          category: c.category || 'PLC & Tự động hóa',
          meaning_vi: c.meaning_vi || term,
          collocations: c.collocations || '',
          example_en: c.example_en || '',
          example_vi: c.example_vi || '',
          linked_record_id: c.linked_record_id || 'MOBILE',
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
      await saveLocalSnapshot(snap);
      return _jsonResponse({ inserted_cards: insertedCards, inserted_drills: 0, ..._bootstrapPayloadFromSnap(snap) });
    }
    if (p === '/api/english/generate-quiz' && m === 'POST') {
      const cards = (snap.english_cards || []).slice(0, Math.min(12, Math.max(4, Number(body.count || 8))));
      const quizzes = cards.map((c, idx) => {
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
          options: rotated,
          correct_index: rotated.indexOf(c.meaning_vi),
          explanation_vi: `${c.term}: ${c.meaning_vi}`,
          context_quote: c.example_en || '',
          card_id: c.id,
        };
      });
      return _jsonResponse({ engine: 'offline', generated: quizzes.length, quizzes, english_quizzes: snap.english_quizzes || [] });
    }
    if (p === '/api/en/translate' && m === 'POST') {
      const txt = String(body.text || '').trim().toLowerCase();
      const hit = (snap.en_glossary || []).find((g) => String(g.vi || '').toLowerCase() === txt || String(g.en || '').toLowerCase() === txt);
      return _jsonResponse({ translated: hit ? `${hit.vi} ⇄ ${hit.en}` : txt, note: hit?.note || '' });
    }
    if (p === '/api/en/translate-batch' && m === 'POST') {
      const out = {};
      (body.texts || []).forEach((t) => { out[t] = t; });
      return _jsonResponse({ translations: out });
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
    const fobj = gMeta.files?.mrl_cloud_sync?.json || gMeta.files?.['mrl_cloud_sync.json'] || Object.values(gMeta.files || {})[0];
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
    ensureLocalSnapshot,
    saveLocalSnapshot,
    getAiConfig,
    saveAiConfig,
    checkOtaUpdate,
    utcNowIso,
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
