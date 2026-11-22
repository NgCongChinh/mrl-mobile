// ---------------------------------------------------------------------------
// TIA Portal Editor Tab Strip & Cross-Workspace Split Editor (Khung 1 / Khung 2)
// ---------------------------------------------------------------------------
const _DRILL_TAB_SVG = '<svg class="etab-svg-ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>';

function _wsShortLabel(ws) {
  if (ws === 'plc') return 'PLC';
  if (ws === 'network') return 'NET';
  if (ws === 'english') return 'ENG';
  return 'MRL';
}

function _inferKindForDrillId(ws, id) {
  if (!id || id === 'all') return null;
  if (ws === 'plc') return 'plc';
  if (ws === 'network') return 'network';
  if (state.knowledgeItems.some((k) => k.id === id)) return 'knowledge';
  return 'repair';
}

function _describeDrillTarget(ws, focusKind, focusId) {
  const w = ws || state.activeWorkspace || 'mrl';
  const fid = (focusId && focusId !== 'all') ? focusId : null;
  const fKind = fid ? (focusKind || _inferKindForDrillId(w, fid)) : null;
  const key = `drill:${w}:${fid || 'all'}`;
  const isEn = state.appLang === 'en';
  const wsShort = _wsShortLabel(w);

  const isLiveP1 = state.activeWorkspace === w &&
    state.activeTab === 'flashcards' &&
    typeof getCurrentDrillKey === 'function' &&
    getCurrentDrillKey() === key;

  let curIdx = 0;
  let total = 0;
  if (isLiveP1) {
    total = (state.flashcard.deck || []).length;
    curIdx = Number(state.flashcard.index) || 0;
  } else {
    const sess = state.drillSessions?.[key];
    if (sess && typeof sess.deckLength === 'number') {
      total = sess.deckLength;
      curIdx = Number(sess.index) || 0;
    } else if (typeof buildDrillDeckForSession === 'function') {
      const tmpSess = sess || {
        key,
        ws: w,
        focusItem: fid ? { kind: fKind, id: fid } : null,
        mode: w === 'english' ? 'en_vocab' : 'deep',
        statusFilter: fid ? 'ALL' : 'ACTIVE',
        typeFilter: 'ALL',
        unsolidOnly: false,
      };
      const built = buildDrillDeckForSession(tmpSess);
      total = built.length;
      curIdx = Number(sess?.index) || 0;
    }
  }

  const prog = total > 0 ? ` (${Math.min(total, curIdx + 1)}/${total})` : '';
  const badge = fid
    ? (isEn ? `Drill: ${fid}` : `Ôn: ${fid}`)
    : (isEn ? `${wsShort} Drill` : `Ôn tập ${wsShort}`);
  const rec = fid && typeof _findRecordByKindId === 'function' ? _findRecordByKindId(fKind, fid) : null;
  const recTitle = rec && typeof _getItemTitle === 'function' ? _getItemTitle(fKind, rec) : '';

  return {
    key,
    kind: 'drill',
    id: fid || 'all',
    ws: w,
    focusKind: fKind,
    focusId: fid,
    badge,
    title: prog.trim(),
    progressText: prog,
    subTitle: recTitle || (fid ? '' : wsShort),
  };
}

function _describeTarget(kind, id, ws) {
  if (kind === 'drill') {
    const strId = String(id || '');
    if (strId.startsWith('drill:') && typeof parseDrillTabKey === 'function') {
      const p = parseDrillTabKey(strId);
      if (p) return _describeDrillTarget(p.ws, p.focusItem?.kind || null, p.focusItem?.id || null);
    }
    const w = ws || state.activeWorkspace || 'mrl';
    const focusId = (!strId || strId === 'all') ? null : strId;
    return _describeDrillTarget(w, _inferKindForDrillId(w, focusId), focusId);
  }
  if (kind === 'scratchpad') {
    const w = ws || 'plc';
    const n = { plc: 'Nháp PLC', network: 'Nháp NET', mrl: 'Nháp MRL', english: 'Nháp Tiếng Anh' };
    return { key: `scratchpad:${w}`, kind: 'scratchpad', id: null, ws: w, badge: `NHÁP ${w === 'english' ? 'ENG' : w.toUpperCase()}`, title: n[w] || 'Vở nháp' };
  }
  if (kind === 'repair') {
    const c = state.repairCases.find((x) => x.id === id);
    return c ? { key: `repair:${c.id}`, kind: 'repair', id: c.id, ws: 'mrl', badge: c.id, title: c.brand_model } : null;
  }
  if (kind === 'knowledge') {
    const k = state.knowledgeItems.find((x) => x.id === id);
    return k ? { key: `knowledge:${k.id}`, kind: 'knowledge', id: k.id, ws: 'mrl', badge: k.id, title: k.topic_model } : null;
  }
  if (kind === 'plc') {
    const p = state.plcNotes.find((x) => x.id === id);
    return p ? { key: `plc:${p.id}`, kind: 'plc', id: p.id, ws: 'plc', badge: p.id, title: p.title } : null;
  }
  if (kind === 'network') {
    const n = state.networkNotes.find((x) => x.id === id);
    return n ? { key: `network:${n.id}`, kind: 'network', id: n.id, ws: 'network', badge: n.id, title: n.target_device } : null;
  }
  return null;
}

function getPrimaryTargetMeta() {
  if (!state.activeWorkspace) return null;
  if (state.activeTab === 'repairs' && state.selectedRepairId) return _describeTarget('repair', state.selectedRepairId, 'mrl');
  if (state.activeTab === 'knowledge' && state.selectedKnowledgeId) return _describeTarget('knowledge', state.selectedKnowledgeId, 'mrl');
  if (state.activeTab === 'plc' && state.selectedPlcId) return _describeTarget('plc', state.selectedPlcId, 'plc');
  if (state.activeTab === 'network' && state.selectedNetworkId) return _describeTarget('network', state.selectedNetworkId, 'network');
  if (state.activeTab === 'scratchpad') return _describeTarget('scratchpad', null, state.activeWorkspace);
  if (state.activeTab === 'dictionary') return { key: 'dictionary:mrl', kind: 'dictionary', id: null, ws: 'mrl', badge: 'TRA CỨU', title: 'Linh kiện & mã lỗi' };
  if (state.activeTab === 'flashcards') {
    const fi = state.flashcard.focusItem;
    const validFi = fi && typeof _wsForItemKind === 'function' && _wsForItemKind(fi.kind) === state.activeWorkspace ? fi : null;
    return _describeDrillTarget(state.activeWorkspace, validFi?.kind || null, validFi?.id || null);
  }
  if (state.activeTab === 'en-quiz') return { key: 'english:quiz', kind: 'en-quiz', id: null, ws: 'english', badge: 'OPENQUIZ SRS', title: 'Ôn tập SRS & Đa chế độ' };
  if (state.activeTab === 'en-coach') return { key: 'english:coach', kind: 'en-coach', id: null, ws: 'english', badge: 'THỰC CHIẾN 1-1', title: 'Dịch câu & Phản xạ nói' };
  if (state.activeTab === 'en-reading') return { key: 'english:reading', kind: 'en-reading', id: null, ws: 'english', badge: 'ĐỌC HIỂU AI', title: 'Đọc hiểu Manual & Tình huống' };
  if (state.activeTab === 'en-vocab-bank') return { key: 'english:vocab', kind: 'en-vocab-bank', id: null, ws: 'english', badge: 'KHO TỪ VỰNG', title: 'Từ vựng & Lexical Chunks' };
  if (state.activeTab === 'en-ingest') return { key: 'english:ingest', kind: 'en-ingest', id: null, ws: 'english', badge: 'PHỄU NẠP', title: 'Nạp dữ liệu nhanh & Manual' };
  return null;
}

function getPane2TargetMeta() {
  if (!state.splitMode) return null;
  if (state.pane2.group === 'drill') return _describeTarget('drill', state.pane2.drillKey || state.pane2.id, state.pane2.ws);
  if (state.pane2.group === 'scratchpad') return _describeTarget('scratchpad', null, state.pane2.ws || state.activeWorkspace || 'plc');
  return _describeTarget(state.pane2.group, state.pane2.id, state.pane2.ws);
}

function upsertEditorTab(meta) {
  if (!meta) return;
  const idx = state.editorTabs.findIndex((t) => t.key === meta.key);
  if (idx >= 0) {
    state.editorTabs[idx] = { ...state.editorTabs[idx], ...meta };
  } else {
    state.editorTabs.push(meta);
    if (state.editorTabs.length > 14) {
      const p1Key = getPrimaryTargetMeta()?.key;
      const p2Key = state.splitMode ? getPane2TargetMeta()?.key : null;
      const evictIdx = state.editorTabs.findIndex((t) => t.key !== p1Key && t.key !== p2Key);
      state.editorTabs.splice(evictIdx >= 0 ? evictIdx : 0, 1);
    }
  }
}

function syncPrimaryEditorTab() {
  const p1 = getPrimaryTargetMeta();
  if (p1 && ['repair', 'knowledge', 'plc', 'network', 'scratchpad', 'drill'].includes(p1.kind)) {
    upsertEditorTab(p1);
  }
  const p1Label = document.getElementById('pane1-label');
  if (p1Label) {
    if (p1?.kind === 'drill') {
      p1Label.textContent = `${p1.badge}${p1.progressText || ''}${p1.subTitle ? ' · ' + p1.subTitle : ''}`;
    } else {
      p1Label.textContent = p1 ? `${p1.badge} · ${p1.title}` : 'KHUNG CHÍNH';
    }
  }
  if (typeof _translateUiLeafNodes === 'function') {
    _translateUiLeafNodes(document.getElementById('pane1-bar'), state.appLang === 'en');
  }
  renderEditorTabs();
}

function renderEditorTabs() {
  const listEl = document.getElementById('editor-tabs-list');
  if (!listEl) return;
  if (!listEl._wheelBound) {
    listEl._wheelBound = true;
    listEl.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        listEl.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }
  const p1Key = getPrimaryTargetMeta()?.key;
  const p2Key = state.splitMode ? getPane2TargetMeta()?.key : null;

  const clearBtn = document.getElementById('btn-clear-tabs');

  if (!state.editorTabs.length) {
    listEl.innerHTML = `<span class="mono" style="padding:0 12px;display:flex;align-items:center;font-size:12px;color:var(--text-3);">CHƯA CÓ TAB NÀO MỞ</span>`;
    clearBtn?.classList.add('hidden');
    if (typeof _translateUiLeafNodes === 'function') _translateUiLeafNodes(listEl, state.appLang === 'en');
    return;
  }

  const tabsHtml = state.editorTabs.map((rawTab, idx) => {
    const t = rawTab.kind === 'drill'
      ? _describeDrillTarget(rawTab.ws, rawTab.focusKind, rawTab.focusId)
      : rawTab;
    if (rawTab.kind === 'drill') state.editorTabs[idx] = t;

    const isP1 = t.key === p1Key;
    const isP2 = t.key === p2Key;
    const mark = (isP1 && isP2) ? '1|2' : (isP1 ? '1' : (isP2 ? '2' : ''));
    const closeTitle = state.appLang === 'en' ? 'Close tab' : 'Đóng tab';

    if (t.kind === 'drill') {
      const fullTip = `${t.badge}${t.progressText || ''}${t.subTitle ? ' — ' + t.subTitle : ''}`;
      return `
      <div class="etab etab-drill ${isP1 ? 'is-p1' : ''} ${isP2 ? 'is-p2' : ''}" data-ctx-tab-key="${escapeHtml(t.key)}" onclick="activateEditorTab('${escapeHtml(t.key)}', event)" title="${escapeHtml(fullTip)}">
        ${_DRILL_TAB_SVG}
        <span class="etab-badge" data-no-i18n="1">${escapeHtml(t.badge)}</span>
        ${t.progressText ? `<span class="etab-drill-prog" data-no-i18n="1">${escapeHtml(t.progressText.trim())}</span>` : ''}
        ${(state.splitMode && mark) ? `<span class="etab-pane-mark">${mark}</span>` : ''}
        <button type="button" class="etab-close" onclick="closeEditorTab('${escapeHtml(t.key)}', event)" title="${closeTitle}">×</button>
      </div>`;
    }

    return `
      <div class="etab ${isP1 ? 'is-p1' : ''} ${isP2 ? 'is-p2' : ''}" data-ctx-tab-key="${escapeHtml(t.key)}" onclick="activateEditorTab('${escapeHtml(t.key)}', event)" title="${escapeHtml(t.badge + ' — ' + t.title)}">
        <span class="etab-badge">${escapeHtml(t.badge)}</span>
        <span class="etab-title">${escapeHtml(t.title)}</span>
        ${(state.splitMode && mark) ? `<span class="etab-pane-mark">${mark}</span>` : ''}
        <button type="button" class="etab-close" onclick="closeEditorTab('${escapeHtml(t.key)}', event)" title="${closeTitle}">×</button>
      </div>`;
  }).join('');
  listEl.innerHTML = tabsHtml;
  clearBtn?.classList.toggle('hidden', state.editorTabs.length <= 2);
  if (typeof _translateUiLeafNodes === 'function') _translateUiLeafNodes(listEl, state.appLang === 'en');
}

function closeAllEditorTabs(ev) {
  if (ev) ev.stopPropagation();
  const p1Key = getPrimaryTargetMeta()?.key;
  const p2Key = state.splitMode ? getPane2TargetMeta()?.key : null;
  state.editorTabs = state.editorTabs.filter((t) => t.key === p1Key || t.key === p2Key);
  renderEditorTabs();
}

function closeOtherEditorTabs(keepKey) {
  const target = state.editorTabs.find((t) => t.key === keepKey);
  if (!target) return;
  const p1Key = getPrimaryTargetMeta()?.key;
  const p2Key = state.splitMode ? getPane2TargetMeta()?.key : null;
  state.editorTabs = [target];
  if (keepKey !== p1Key && keepKey !== p2Key) {
    openTargetInPrimary(target);
  } else {
    renderEditorTabs();
  }
}

function closeRightEditorTabs(fromKey) {
  const idx = state.editorTabs.findIndex((t) => t.key === fromKey);
  if (idx < 0) return;
  state.editorTabs = state.editorTabs.slice(0, idx + 1);
  renderEditorTabs();
}

function removeDeletedFromTabsAndPane2(kind, id) {
  const key = `${kind}:${id}`;
  state.editorTabs = state.editorTabs.filter((t) => t.key !== key);
  if (state.pane2 && state.pane2.group === kind && state.pane2.id === id) {
    state.pane2.id = null;
  }
  renderEditorTabs();
}

function closeEditorTab(key, ev) {
  if (ev) ev.stopPropagation();
  const idx = state.editorTabs.findIndex((t) => t.key === key);
  if (idx < 0) return;
  const p1Key = getPrimaryTargetMeta()?.key;
  const p2Key = state.splitMode ? getPane2TargetMeta()?.key : null;
  state.editorTabs.splice(idx, 1);

  if (String(key).startsWith('drill:') && typeof parseDrillTabKey === 'function') {
    const parsed = parseDrillTabKey(key);
    const mem = parsed ? state.workspaceMemory?.[parsed.ws] : null;
    if (mem && mem.lastDrillKey === key) {
      mem.lastDrillKey = null;
      mem.drillSnapshot = null;
    }
  }

  if (key === p1Key && state.activeWorkspace) {
    const nextTab = state.editorTabs[idx] || state.editorTabs[idx - 1] || state.editorTabs[0];
    if (nextTab) {
      openTargetInPrimary(nextTab);
    } else if (state.activeTab === 'flashcards' && typeof WORKSPACE_META !== 'undefined' && WORKSPACE_META[state.activeWorkspace]) {
      switchTab(WORKSPACE_META[state.activeWorkspace].defaultTab);
    }
  }
  if (state.splitMode && key === p2Key) {
    state.pane2.group = 'scratchpad';
    state.pane2.ws = state.activeWorkspace || 'plc';
    state.pane2.id = state.pane2.ws;
    state.pane2.drillKey = null;
    renderPane2();
  }
  renderEditorTabs();
}

function openTargetInPrimary(meta, opts = {}) {
  if (!meta) return;
  if (meta.kind === 'drill') {
    enterWorkspace(meta.ws || state.activeWorkspace || 'plc', 'flashcards', {
      keepFocusItem: true,
      drillKey: meta.key,
      preserveDrillState: true,
      fromHistory: Boolean(opts.fromHistory),
    });
  } else if (meta.kind === 'scratchpad') {
    enterWorkspace(meta.ws || 'plc', 'scratchpad', { fromHistory: Boolean(opts.fromHistory) });
  } else if (meta.kind === 'repair') {
    state.repairFilters = { category: 'ALL', status: 'ALL', q: '' };
    state.selectedRepairId = meta.id;
    if (!state.repairsListPinned) state.repairsListCollapsed = true;
    enterWorkspace('mrl', 'repairs', { fromHistory: Boolean(opts.fromHistory) });
  } else if (meta.kind === 'knowledge') {
    state.knowledgeFilters = { group: 'ALL', mode: 'ALL', category: 'ALL', status: 'ALL', q: '' };
    state.selectedKnowledgeId = meta.id;
    if (!state.knowledgeListPinned) state.knowledgeListCollapsed = true;
    enterWorkspace('mrl', 'knowledge', { fromHistory: Boolean(opts.fromHistory) });
  } else if (meta.kind === 'plc') {
    state.plcFilters = { category: 'ALL', status: 'ALL', q: '' };
    state.selectedPlcId = meta.id;
    if (!state.plcListPinned) state.plcListCollapsed = true;
    enterWorkspace('plc', 'plc', { fromHistory: Boolean(opts.fromHistory) });
  } else if (meta.kind === 'network') {
    state.networkFilters = { protocol: 'ALL', status: 'ALL', q: '' };
    state.selectedNetworkId = meta.id;
    if (!state.networkListPinned) state.networkListCollapsed = true;
    enterWorkspace('network', 'network', { fromHistory: Boolean(opts.fromHistory) });
  }
}

function openTargetInSecondary(meta) {
  if (!meta) return;
  state.pane2Initialized = true;
  if (meta.kind === 'drill') {
    state.pane2.group = 'drill';
    state.pane2.drillKey = meta.key;
    state.pane2.id = meta.key;
    state.pane2.ws = meta.ws || state.activeWorkspace || 'plc';
  } else if (meta.kind === 'scratchpad') {
    state.pane2.group = 'scratchpad';
    state.pane2.ws = meta.ws || state.activeWorkspace || 'plc';
    state.pane2.id = state.pane2.ws;
    state.pane2.drillKey = null;
  } else {
    state.pane2.group = meta.kind;
    state.pane2.id = meta.id;
    state.pane2.ws = meta.ws;
    state.pane2.drillKey = null;
  }
  state.pane2.browserOpen = false;
  if (!state.splitMode) toggleSplitMode('vertical');
  else {
    renderPane2();
    renderEditorTabs();
  }
}

function activateEditorTab(key, ev) {
  const tab = state.editorTabs.find((t) => t.key === key);
  if (!tab) return;
  if (ev?.shiftKey || (state.splitMode && state.activePane === 'secondary')) {
    openTargetInSecondary(tab);
  } else {
    openTargetInPrimary(tab);
  }
}

function setActivePane(pane) {
  if (!state.splitMode) pane = 'primary';
  if (state.activePane === pane) return;
  state.activePane = pane;
  document.getElementById('pane-primary')?.classList.toggle('active-pane', pane === 'primary');
  document.getElementById('pane-secondary')?.classList.toggle('active-pane', pane === 'secondary');
}

function applySplitLayout() {
  const body = document.getElementById('workspace-body');
  const p1 = document.getElementById('pane-primary');
  const p1Bar = document.getElementById('pane1-bar');
  const resizer = document.getElementById('split-resizer');
  const p2 = document.getElementById('pane-secondary');
  const btnV = document.getElementById('btn-split-vertical');
  const btnH = document.getElementById('btn-split-horizontal');
  const btnSwap = document.getElementById('btn-swap-panes');
  const btnClose = document.getElementById('btn-close-split');
  if (!body || !p1 || !p2 || !resizer) return;

  const isSplit = Boolean(state.splitMode);
  body.classList.toggle('is-split', isSplit);
  body.classList.toggle('split-horizontal', state.splitMode === 'horizontal');
  p1Bar?.classList.toggle('hidden', !isSplit);
  resizer.classList.toggle('hidden', !isSplit);
  p2.classList.toggle('hidden', !isSplit);
  btnSwap?.classList.toggle('hidden', !isSplit);
  btnClose?.classList.toggle('hidden', !isSplit);
  btnV?.classList.toggle('split-on', state.splitMode === 'vertical');
  btnH?.classList.toggle('split-on', state.splitMode === 'horizontal');

  if (isSplit) {
    const pct = Math.max(22, Math.min(78, Number(state.splitRatio) || 50));
    p1.style.flex = `0 0 calc(${pct}% - 3px)`;
    p1.classList.toggle('active-pane', state.activePane === 'primary');
    p2.classList.toggle('active-pane', state.activePane === 'secondary');
  } else {
    state.activePane = 'primary';
    p1.style.flex = '1 1 0%';
    p1.classList.add('active-pane');
  }
}

function toggleSplitMode(mode = 'vertical') {
  if (state.splitMode === mode) {
    closeSplitPane();
    return;
  }
  const wasClosed = !state.splitMode;
  state.splitMode = mode;

  if (wasClosed && !state.pane2Initialized) {
    state.pane2Initialized = true;
    const p1 = getPrimaryTargetMeta();
    if (p1 && p1.kind === 'drill' && p1.focusKind && p1.focusId) {
      state.pane2 = { ...state.pane2, group: p1.focusKind, id: p1.focusId, ws: p1.ws, drillKey: null };
    } else if (p1 && p1.kind !== 'scratchpad') {
      state.pane2.group = 'scratchpad';
      state.pane2.ws = state.activeWorkspace || 'plc';
      state.pane2.id = state.pane2.ws;
      state.pane2.drillKey = null;
    } else {
      const ws = state.activeWorkspace || 'plc';
      if (ws === 'plc' && state.plcNotes.length) {
        state.pane2 = { ...state.pane2, group: 'plc', id: state.selectedPlcId || state.plcNotes[0].id, ws: 'plc', drillKey: null };
      } else if (ws === 'network' && state.networkNotes.length) {
        state.pane2 = { ...state.pane2, group: 'network', id: state.selectedNetworkId || state.networkNotes[0].id, ws: 'network', drillKey: null };
      } else if (state.repairCases.length) {
        state.pane2 = { ...state.pane2, group: 'repair', id: state.selectedRepairId || state.repairCases[0].id, ws: 'mrl', drillKey: null };
      } else {
        state.pane2 = { ...state.pane2, group: 'scratchpad', id: ws, ws, drillKey: null };
      }
    }
  }

  // Auto-collapse middle list panes when entering split view unless pinned so both panes are spacious
  if (wasClosed) {
    if (state.selectedRepairId && !state.repairsListPinned) state.repairsListCollapsed = true;
    if (state.selectedKnowledgeId && !state.knowledgeListPinned) state.knowledgeListCollapsed = true;
    if (state.selectedPlcId && !state.plcListPinned) state.plcListCollapsed = true;
    if (state.selectedNetworkId && !state.networkListPinned) state.networkListCollapsed = true;
    if (state.activeTab === 'repairs') renderRepairsView();
    else if (state.activeTab === 'knowledge') renderKnowledgeView();
    else if (state.activeTab === 'plc') renderPlcView();
    else if (state.activeTab === 'network') renderNetworkView();
  }

  applySplitLayout();
  renderPane2();
  syncPrimaryEditorTab();
  if (state.activeTab === 'scratchpad') renderScratchpadView();
}

function closeSplitPane() {
  state.splitMode = null;
  state.activePane = 'primary';
  state.pane2.browserOpen = false;
  applySplitLayout();
  renderEditorTabs();
  if (state.activeTab === 'scratchpad') renderScratchpadView();
}

function swapSplitPanes() {
  if (!state.splitMode) return;
  const p1 = getPrimaryTargetMeta();
  const p2 = getPane2TargetMeta();
  if (!p1 || !p2) return;
  if (['repair', 'knowledge', 'plc', 'network', 'scratchpad', 'drill'].includes(p2.kind)) {
    openTargetInPrimary(p2);
  }
  if (['repair', 'knowledge', 'plc', 'network', 'scratchpad', 'drill'].includes(p1.kind)) {
    state.pane2Initialized = true;
    if (p1.kind === 'drill') {
      state.pane2.group = 'drill';
      state.pane2.drillKey = p1.key;
      state.pane2.id = p1.key;
      state.pane2.ws = p1.ws;
    } else if (p1.kind === 'scratchpad') {
      state.pane2.group = 'scratchpad';
      state.pane2.ws = p1.ws;
      state.pane2.id = p1.ws;
      state.pane2.drillKey = null;
    } else {
      state.pane2.group = p1.kind;
      state.pane2.id = p1.id;
      state.pane2.ws = p1.ws;
      state.pane2.drillKey = null;
    }
  }
  renderPane2();
  syncPrimaryEditorTab();
}

function pinPrimaryToSecondary(ev) {
  if (ev) ev.stopPropagation();
  const p1 = getPrimaryTargetMeta();
  if (!p1) return;
  if (p1.kind === 'dictionary') {
    showToast('Chọn một bài học, ca sửa, tab Ôn tập hoặc Nháp để ghim sang Khung 2', 'info');
    return;
  }
  openTargetInSecondary(p1);
  setActivePane('secondary');
}

function _initSplitResizer() {
  const resizer = document.getElementById('split-resizer');
  const body = document.getElementById('workspace-body');
  if (!resizer || !body || resizer._bound) return;
  resizer._bound = true;

  resizer.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0 || !state.splitMode) return;
    ev.preventDefault();
    resizer.classList.add('dragging');
    const isH = state.splitMode === 'horizontal';
    const rect = body.getBoundingClientRect();

    const onMove = (mv) => {
      const pct = isH
        ? ((mv.clientY - rect.top) / Math.max(200, rect.height)) * 100
        : ((mv.clientX - rect.left) / Math.max(300, rect.width)) * 100;
      state.splitRatio = Math.max(22, Math.min(78, Math.round(pct * 10) / 10));
      applySplitLayout();
    };
    const onUp = () => {
      resizer.classList.remove('dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (state.activeTab === 'scratchpad') renderScratchpadView();
      if (state.pane2.group === 'scratchpad') renderPane2Scratchpad();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

function _getDrillEntriesForPane2() {
  const seen = new Set();
  const list = [];
  const pushKey = (key) => {
    if (!key || seen.has(key) || !String(key).startsWith('drill:')) return;
    seen.add(key);
    const meta = _describeTarget('drill', key);
    if (!meta) return;
    list.push({
      id: key,
      ws: meta.ws,
      label: `${meta.badge}${meta.progressText || ''}${meta.subTitle ? ' · ' + meta.subTitle : ''}`,
      sub: _wsShortLabel(meta.ws),
    });
  };
  (state.editorTabs || []).filter((t) => t.kind === 'drill').forEach((t) => pushKey(t.key));
  Object.keys(state.drillSessions || {}).forEach(pushKey);
  const p1 = getPrimaryTargetMeta();
  if (p1 && ['repair', 'knowledge', 'plc', 'network'].includes(p1.kind) && p1.id) {
    pushKey(`drill:${p1.ws}:${p1.id}`);
  }
  const curWs = state.activeWorkspace && state.activeWorkspace !== 'english' ? state.activeWorkspace : 'plc';
  pushKey(`drill:${curWs}:all`);
  return list;
}

function _getPane2ItemList(group) {
  if (group === 'drill') return _getDrillEntriesForPane2();
  if (group === 'plc') return state.plcNotes.map((p) => ({ id: p.id, label: `${p.id} · ${p.title}`, sub: p.category || p.plc_brand_platform || 'PLC' }));
  if (group === 'network') return state.networkNotes.map((n) => ({ id: n.id, label: `${n.id} · ${n.target_device}`, sub: n.protocol }));
  if (group === 'repair') return state.repairCases.map((c) => ({ id: c.id, label: `${c.id} · ${c.brand_model}`, sub: categoryLabel(c.device_category) }));
  if (group === 'knowledge') return state.knowledgeItems.map((k) => ({ id: k.id, label: `${k.id} · ${k.topic_model}`, sub: groupLabel(k.source_group) }));
  return [
    { id: 'plc', label: 'Nháp Lập trình PLC', sub: 'PLC' },
    { id: 'network', label: 'Nháp Mạng Truyền thông (NET)', sub: 'NET' },
    { id: 'mrl', label: 'Nháp MRL (Sửa chữa & SOP)', sub: 'MRL' },
    { id: 'english', label: 'Nháp Tiếng Anh (Đọc Manual)', sub: 'ENG' },
  ];
}

function setPane2Group(group) {
  state.pane2Initialized = true;
  state.pane2.group = group;
  if (group === 'scratchpad') {
    const w = state.pane2.ws || state.activeWorkspace || 'plc';
    state.pane2.ws = ['plc', 'network', 'mrl', 'english'].includes(w) ? w : 'plc';
    state.pane2.id = state.pane2.ws;
    state.pane2.drillKey = null;
  } else if (group === 'drill') {
    const items = _getPane2ItemList('drill');
    const chosen = items.find((it) => it.id === (state.pane2.drillKey || state.pane2.id)) || items[0] || null;
    state.pane2.drillKey = chosen ? chosen.id : `drill:${state.activeWorkspace || 'plc'}:all`;
    state.pane2.id = state.pane2.drillKey;
    state.pane2.ws = chosen?.ws || (typeof parseDrillTabKey === 'function' ? parseDrillTabKey(state.pane2.drillKey)?.ws : null) || state.activeWorkspace || 'plc';
  } else {
    state.pane2.drillKey = null;
    const items = _getPane2ItemList(group);
    if (!items.some((it) => it.id === state.pane2.id)) {
      state.pane2.id = items.length ? items[0].id : null;
    }
    state.pane2.ws = group === 'plc' ? 'plc' : (group === 'network' ? 'network' : 'mrl');
  }
  setActivePane('secondary');
  renderPane2();
}

function onPane2SelectChange() {
  const sel = document.getElementById('pane2-item-select');
  if (!sel) return;
  if (state.pane2.group === 'scratchpad') {
    state.pane2.ws = sel.value;
    state.pane2.id = sel.value;
    state.pane2.drillKey = null;
  } else if (state.pane2.group === 'drill') {
    state.pane2.drillKey = sel.value;
    state.pane2.id = sel.value;
    if (typeof parseDrillTabKey === 'function') {
      const p = parseDrillTabKey(sel.value);
      if (p) state.pane2.ws = p.ws;
    }
  } else {
    state.pane2.id = sel.value;
    state.pane2.drillKey = null;
  }
  setActivePane('secondary');
  renderPane2();
}

function togglePane2Browser() {
  state.pane2.browserOpen = !state.pane2.browserOpen;
  renderPane2Browser();
}

function renderPane2Browser() {
  const box = document.getElementById('pane2-browser');
  const btn = document.getElementById('pane2-browse-btn');
  if (!box) return;
  box.classList.toggle('hidden', !state.pane2.browserOpen);
  btn?.classList.toggle('pin-active', state.pane2.browserOpen);
  if (!state.pane2.browserOpen) return;

  const drillEntries = _getDrillEntriesForPane2().map((d) => ({
    group: 'drill',
    ws: d.ws,
    id: d.id,
    badge: _describeTarget('drill', d.id)?.badge || d.sub,
    tag: 'ÔN TẬP',
    title: d.label,
  }));

  const allEntries = [
    ...drillEntries,
    ...state.plcNotes.map((p) => ({ group: 'plc', ws: 'plc', id: p.id, badge: p.id, tag: 'PLC', title: p.title })),
    ...state.networkNotes.map((n) => ({ group: 'network', ws: 'network', id: n.id, badge: n.id, tag: 'NET', title: n.target_device })),
    ...state.repairCases.map((c) => ({ group: 'repair', ws: 'mrl', id: c.id, badge: c.id, tag: 'CA SỬA', title: c.brand_model })),
    ...state.knowledgeItems.map((k) => ({ group: 'knowledge', ws: 'mrl', id: k.id, badge: k.id, tag: 'SOP', title: k.topic_model })),
    { group: 'scratchpad', ws: 'plc', id: 'plc', badge: 'NHÁP PLC', tag: 'NHÁP', title: 'Vở nháp Lập trình PLC' },
    { group: 'scratchpad', ws: 'network', id: 'network', badge: 'NHÁP NET', tag: 'NHÁP', title: 'Vở nháp Mạng Truyền thông' },
    { group: 'scratchpad', ws: 'mrl', id: 'mrl', badge: 'NHÁP MRL', tag: 'NHÁP', title: 'Vở nháp MRL' },
  ];

  box.innerHTML = `
    <div class="pane2-browser-top">
      <input id="pane2-browser-search" class="inp mono" style="flex:1;font-size:12px;" type="text"
             placeholder="Tìm xuyên phân hệ: PLC-003, NET-001, Ôn tập, Yaskawa, Modbus, Nháp..."
             value="${escapeHtml(state.pane2.browserQuery || '')}" oninput="onPane2BrowserFilter(this.value)" />
      <button type="button" class="btn btn-sm" onclick="togglePane2Browser()">Đóng</button>
    </div>
    <div id="pane2-browser-list" class="pane2-browser-list"></div>`;
  state._pane2AllEntries = allEntries;
  onPane2BrowserFilter(state.pane2.browserQuery || '');
}

function onPane2BrowserFilter(val) {
  state.pane2.browserQuery = val || '';
  const listEl = document.getElementById('pane2-browser-list');
  if (!listEl) return;
  const q = state.pane2.browserQuery.trim().toLowerCase();
  const entries = (state._pane2AllEntries || []).filter((e) => !q || `${e.tag} ${e.badge} ${e.title}`.toLowerCase().includes(q));
  if (!entries.length) {
    listEl.innerHTML = `<div class="empty" style="padding:18px;">KHÔNG TÌM THẤY MỤC PHÙ HỢP</div>`;
    return;
  }
  listEl.innerHTML = entries.slice(0, 60).map((e) => `
    <div class="row" onclick="selectPane2BrowserItem('${e.group}', '${escapeHtml(e.id)}', '${e.ws}')">
      <div class="row-top">
        <span class="row-id">${escapeHtml(e.badge)}</span><span>·</span><span class="row-cat">${escapeHtml(e.tag)}</span>
      </div>
      <div class="row-main"><div class="row-title">${escapeHtml(e.title)}</div></div>
    </div>`).join('');
}

function selectPane2BrowserItem(group, id, ws) {
  state.pane2.group = group;
  state.pane2.id = id;
  state.pane2.ws = ws;
  state.pane2.drillKey = group === 'drill' ? id : null;
  state.pane2.browserOpen = false;
  renderPane2();
}

let _pane2ScratchTimer = null;
function insertPastedImageIntoPane2Scratchpad(file) {
  const ws = state.pane2.ws || state.activeWorkspace || 'plc';
  if (!state.scratchpads[ws]) state.scratchpads[ws] = { workspace: ws, content: '', images_json: [], font_mode: 'sans' };
  const pad = state.scratchpads[ws];
  const canvas = document.getElementById('pane2-scratchpad-canvas');
  const layer = document.getElementById('pane2-scratchpad-images-layer');
  addCanvasImageFile(canvas, layer, pad.images_json, file, 360, () => savePane2ScratchpadNow(false));
}

function renderPane2Scratchpad() {
  const ws = state.pane2.ws || state.activeWorkspace || 'plc';
  if (!state.scratchpads[ws]) state.scratchpads[ws] = { workspace: ws, content: '', images_json: [], font_mode: 'sans' };
  const pad = state.scratchpads[ws];
  if (!Array.isArray(pad.images_json)) pad.images_json = [];
  const isMono = pad.font_mode === 'mono';
  const contentEl = document.getElementById('pane2-content');
  if (!contentEl) return;

  if (!document.getElementById('pane2-scratchpad-canvas')) {
    contentEl.innerHTML = `
      <div class="pane2-scratch-bar">
        <span class="mono" style="font-size:12px;color:var(--amber);font-weight:700;" id="p2-sp-title"></span>
        <span id="p2-sp-status" class="mono" style="margin-left:auto;font-size:12px;color:var(--green);">ĐÃ LƯU TỰ ĐỘNG</span>
        <button type="button" class="btn btn-sm" onclick="pickCanvasImageFile((f)=>insertPastedImageIntoPane2Scratchpad(f))">+ Ảnh</button>
        <button type="button" id="p2-sp-font-btn" class="btn btn-sm" onclick="togglePane2ScratchpadFont()"></button>
        <button type="button" class="btn btn-sm btn-primary" onclick="savePane2ScratchpadNow(true)">Lưu</button>
        <button type="button" class="btn btn-sm btn-danger" onclick="clearPane2Scratchpad()">Xóa trắng</button>
      </div>
      <div class="scratchpad-wrap" style="padding:14px 16px 24px;">
        <div id="pane2-scratchpad-canvas" class="scratchpad-canvas" tabindex="0">
          <textarea id="pane2-scratchpad-textarea" class="scratchpad-textarea" spellcheck="false" placeholder="Ghi nháp song song với bài học bên cạnh... (Nhấn Ctrl+V dán ảnh & kéo thả tự do)"></textarea>
          <div id="pane2-scratchpad-images-layer" class="canvas-images-layer"></div>
        </div>
      </div>`;

    const ta = document.getElementById('pane2-scratchpad-textarea');
    const canvas = document.getElementById('pane2-scratchpad-canvas');
    ta.addEventListener('input', () => {
      const curWs = state.pane2.ws || 'plc';
      if (!state.scratchpads[curWs]) state.scratchpads[curWs] = { workspace: curWs, content: '', images_json: [], font_mode: 'sans' };
      state.scratchpads[curWs].content = ta.value;
      const st = document.getElementById('p2-sp-status');
      if (st) { st.textContent = state.appLang === 'en' ? 'TYPING...' : 'ĐANG GÕ...'; st.style.color = 'var(--amber)'; }
      clearTimeout(_pane2ScratchTimer);
      _pane2ScratchTimer = setTimeout(() => savePane2ScratchpadNow(false), 450);
    });
    canvas.addEventListener('paste', (ev) => {
      const items = ev.clipboardData?.items;
      if (!items) return;
      let imgFile = null;
      for (const it of items) { if (it.type && it.type.startsWith('image/')) { imgFile = it.getAsFile(); break; } }
      if (!imgFile) return;
      ev.preventDefault();
      ev.stopPropagation();
      insertPastedImageIntoPane2Scratchpad(imgFile);
    });
  }

  document.getElementById('p2-sp-title').textContent = `VỞ NHÁP · ${ws.toUpperCase()}`;
  document.getElementById('p2-sp-font-btn').textContent = `Font: ${isMono ? 'Mono' : 'Thường'}`;
  const ta = document.getElementById('pane2-scratchpad-textarea');
  if (ta.value !== (pad.content || '')) ta.value = pad.content || '';
  ta.classList.toggle('mono-mode', isMono);
  const canvas = document.getElementById('pane2-scratchpad-canvas');
  const layer = document.getElementById('pane2-scratchpad-images-layer');
  renderFloatingCanvasLayer(canvas, layer, pad.images_json, 380, () => savePane2ScratchpadNow(false));
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

async function savePane2ScratchpadNow(showNotify = false) {
  clearTimeout(_pane2ScratchTimer);
  const ws = state.pane2.ws || state.activeWorkspace || 'plc';
  if (!state.scratchpads[ws]) state.scratchpads[ws] = { workspace: ws, content: '', images_json: [], font_mode: 'sans' };
  const pad = state.scratchpads[ws];
  const ta = document.getElementById('pane2-scratchpad-textarea');
  if (ta) pad.content = ta.value;

  const stEl = document.getElementById('p2-sp-status');
  try {
    const res = await fetch(`/api/scratchpads/${encodeURIComponent(ws)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: pad.content || '', images_json: pad.images_json || [], font_mode: pad.font_mode || 'sans' }),
    });
    if (!res.ok) throw new Error('Lưu nháp thất bại');
    const saved = await res.json();
    state.scratchpads[ws] = saved;
    if (stEl) { stEl.textContent = 'ĐÃ LƯU TỰ ĐỘNG'; stEl.style.color = 'var(--green)'; }
    if (state.activeWorkspace === ws && state.activeTab === 'scratchpad') renderScratchpadView();
    if (showNotify) showToast(`Đã lưu nháp ${ws.toUpperCase()}`, 'success');
  } catch (err) {
    if (stEl) { stEl.textContent = 'LỖI LƯU'; stEl.style.color = 'var(--red)'; }
    if (showNotify) showToast(err.message, 'error');
  }
}

function togglePane2ScratchpadFont() {
  const ws = state.pane2.ws || 'plc';
  if (!state.scratchpads[ws]) state.scratchpads[ws] = { workspace: ws, content: '', images_json: [], font_mode: 'sans' };
  state.scratchpads[ws].font_mode = state.scratchpads[ws].font_mode === 'mono' ? 'sans' : 'mono';
  renderPane2Scratchpad();
  savePane2ScratchpadNow(false);
}

async function clearPane2Scratchpad() {
  if (!await uiConfirm('Xóa sạch chữ và ảnh trên trang nháp này?')) return;
  const ws = state.pane2.ws || 'plc';
  state.scratchpads[ws] = { workspace: ws, content: '', images_json: [], font_mode: state.scratchpads[ws]?.font_mode || 'sans' };
  const ta = document.getElementById('pane2-scratchpad-textarea');
  if (ta) ta.value = '';
  renderPane2Scratchpad();
  await savePane2ScratchpadNow(true);
}

function _ensurePane2DrillSession() {
  const rawKey = state.pane2.drillKey || state.pane2.id || `drill:${state.activeWorkspace || 'plc'}:all`;
  if (!state.drillSessions) state.drillSessions = {};
  let sess = state.drillSessions[rawKey];
  if (!sess && typeof parseDrillTabKey === 'function') {
    const parsed = parseDrillTabKey(rawKey);
    if (parsed) {
      sess = {
        key: rawKey,
        ws: parsed.ws,
        focusItem: parsed.focusItem,
        mode: parsed.ws === 'english' ? 'en_vocab' : 'deep',
        statusFilter: parsed.focusItem ? 'ALL' : 'ACTIVE',
        typeFilter: 'ALL',
        unsolidOnly: false,
        showDraftBox: true,
        index: 0,
        cardKey: null,
        flipped: false,
        showHint: false,
        showContext: false,
        editingDraftOnBack: false,
        evaluations: {},
        followUps: {},
        quizAnswers: {},
        supplementSaved: {},
      };
      state.drillSessions[rawKey] = sess;
    }
  }
  return sess || null;
}

function _syncP1IfSameDrill(drillKey, sess) {
  if (
    state.activeTab === 'flashcards' &&
    typeof getCurrentDrillKey === 'function' &&
    getCurrentDrillKey() === drillKey &&
    sess
  ) {
    state.flashcard.index = sess.index;
    state.flashcard.flipped = sess.flipped;
    state.flashcard.showHint = sess.showHint;
    if (sess.evaluations) state.flashcard.evaluations = { ...state.flashcard.evaluations, ...sess.evaluations };
    if (sess.quizAnswers) state.flashcard.quizAnswers = { ...state.flashcard.quizAnswers, ...sess.quizAnswers };
    if (typeof renderFlashcardStage === 'function') renderFlashcardStage();
  }
  renderEditorTabs();
}

function p2MoveDrill(delta) {
  const sess = _ensurePane2DrillSession();
  if (!sess || typeof buildDrillDeckForSession !== 'function') return;
  if (typeof flushPendingDrillDraft === 'function') flushPendingDrillDraft();
  const deck = buildDrillDeckForSession(sess);
  if (!deck.length) return;
  sess.index = ((sess.index || 0) + delta + deck.length) % deck.length;
  sess.cardKey = deck[sess.index]?.cardKey || null;
  sess.deckLength = deck.length;
  sess.flipped = false;
  sess.showHint = false;
  renderPane2Drill();
  _syncP1IfSameDrill(sess.key, sess);
}

function p2FlipDrill() {
  const sess = _ensurePane2DrillSession();
  if (!sess || typeof buildDrillDeckForSession !== 'function') return;
  if (typeof flushPendingDrillDraft === 'function') flushPendingDrillDraft();
  const deck = buildDrillDeckForSession(sess);
  const card = deck[sess.index] || deck[0];
  if (!card || card.quiz) return;
  sess.flipped = !sess.flipped;
  if (sess.flipped && typeof loadDrillDraft === 'function' && !card.isSummary && card.kind !== 'en_vocab') {
    const draft = loadDrillDraft(card.cardKey).trim();
    if (draft.length >= 5) {
      sess.evaluations = sess.evaluations || {};
      const offlineEv = window.MRLCoreStore?.evaluateFlashcardOffline?.(card.answerText, draft);
      if (offlineEv) {
        sess.evaluations[card.cardKey] = { ...offlineEv, evaluatedDraft: draft, loading: false };
      }
    }
  }
  renderPane2Drill();
  _syncP1IfSameDrill(sess.key, sess);
}

function p2ToggleDrillHint() {
  const sess = _ensurePane2DrillSession();
  if (!sess) return;
  sess.showHint = !sess.showHint;
  renderPane2Drill();
}

async function p2SelectQuizOption(optIdx) {
  const sess = _ensurePane2DrillSession();
  if (!sess || typeof buildDrillDeckForSession !== 'function') return;
  const deck = buildDrillDeckForSession(sess);
  const card = deck[sess.index] || deck[0];
  if (!card?.quiz) return;
  sess.quizAnswers = sess.quizAnswers || {};
  if (sess.quizAnswers[card.cardKey] !== undefined) return;
  sess.quizAnswers[card.cardKey] = optIdx;
  if (typeof saveCardProgress === 'function') {
    await saveCardProgress(card, optIdx === card.quiz.correctIdx ? 'solid' : 'forgot');
  }
  renderPane2Drill();
  _syncP1IfSameDrill(sess.key, sess);
}

async function p2RateDrill(rating) {
  const sess = _ensurePane2DrillSession();
  if (!sess || typeof buildDrillDeckForSession !== 'function') return;
  const deck = buildDrillDeckForSession(sess);
  const card = deck[sess.index] || deck[0];
  if (!card) return;
  if (typeof saveCardProgress === 'function') await saveCardProgress(card, rating);
  showToast(
    rating === 'forgot' ? 'Đã ghi nhận Quên!' : (rating === 'fuzzy' ? 'Nhớ mờ' : 'Thuộc chắc!'),
    rating === 'solid' ? 'success' : 'info'
  );
  if ((sess.index || 0) + 1 < deck.length) {
    p2MoveDrill(1);
  } else {
    renderPane2Drill();
    _syncP1IfSameDrill(sess.key, sess);
  }
}

async function p2EvaluateDrill(preferAi = true) {
  const sess = _ensurePane2DrillSession();
  if (!sess || typeof buildDrillDeckForSession !== 'function' || typeof loadDrillDraft !== 'function') return;
  const deck = buildDrillDeckForSession(sess);
  const card = deck[sess.index] || deck[0];
  if (!card || card.quiz || card.isSummary || card.kind === 'en_vocab') return;
  const draft = loadDrillDraft(card.cardKey).trim();
  if (draft.length < 2) {
    showToast('Hãy gõ nhanh câu trả lời trước khi chấm điểm', 'info');
    return;
  }
  sess.evaluations = sess.evaluations || {};
  const offlineEv = window.MRLCoreStore?.evaluateFlashcardOffline?.(card.answerText, draft) || {};
  sess.evaluations[card.cardKey] = { ...offlineEv, evaluatedDraft: draft, loading: preferAi };
  renderPane2Drill();
  if (!preferAi) {
    _syncP1IfSameDrill(sess.key, sess);
    return;
  }
  try {
    const res = await fetch('/api/flashcards/evaluate-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_kind: card.kind,
        item_id: card.id,
        question: card.question,
        reference_answer: card.answerText,
        user_answer: draft,
        section_title: card.sectionTitle || card.badge || '',
        record_title: card.title || '',
        mode: 'ai',
      }),
    });
    const parsedJson = await res.json().catch(() => null);
    if (res.ok && parsedJson) {
      sess.evaluations[card.cardKey] = { ...parsedJson, evaluatedDraft: draft, loading: false };
    } else {
      sess.evaluations[card.cardKey] = {
        ...offlineEv,
        evaluatedDraft: draft,
        loading: false,
        ai_error: parsedJson?.ai_error || parsedJson?.detail || `HTTP ${res.status}`,
      };
    }
  } catch (err) {
    sess.evaluations[card.cardKey] = {
      ...offlineEv,
      evaluatedDraft: draft,
      loading: false,
      ai_error: err?.message || 'Network error',
    };
  }
  renderPane2Drill();
  _syncP1IfSameDrill(sess.key, sess);
}

function renderPane2Drill() {
  const contentEl = document.getElementById('pane2-content');
  if (!contentEl) return;
  const sess = _ensurePane2DrillSession();
  if (!sess || typeof buildDrillDeckForSession !== 'function') {
    contentEl.innerHTML = '<div class="empty">KHÔNG CÓ PHIÊN ÔN TẬP</div>';
    return;
  }
  const deck = buildDrillDeckForSession(sess);
  sess.deckLength = deck.length;
  const meta = _describeDrillTarget(sess.ws, sess.focusItem?.kind || null, sess.focusItem?.id || null);
  const isEn = state.appLang === 'en';

  if (!deck.length) {
    contentEl.innerHTML = `
      <div class="p2-drill-wrap">
        <div class="fc-bar">
          <span data-no-i18n="1">${escapeHtml(meta.badge)}</span>
          <button type="button" class="btn btn-sm" onclick="openTargetInPrimary(_describeTarget('drill','${escapeHtml(sess.key)}','${escapeHtml(sess.ws)}'))">↗ ${isEn ? 'Open in Pane 1' : 'Mở ở Khung 1'}</button>
        </div>
        <div class="fc-card" style="text-align:center;padding:32px 16px;">
          <div class="mono" style="color:var(--green);font-size:12.5px;">${isEn ? 'EMPTY DRILL' : 'CHƯA CÓ THẺ ÔN TẬP'}</div>
        </div>
      </div>`;
    return;
  }

  if ((sess.index || 0) >= deck.length) sess.index = 0;
  const card = deck[sess.index] || deck[0];
  sess.cardKey = card.cardKey;
  const flipped = Boolean(sess.flipped);
  const pct = Math.round(((sess.index + 1) / deck.length) * 100);
  const draftVal = typeof loadDrillDraft === 'function' ? loadDrillDraft(card.cardKey) : '';
  const savedRating = state.reviewProgress?.[card.cardKey]?.rating || '';
  const lvlClass = savedRating ? `lvl-${savedRating}` : 'lvl-new';
  const lvlText = savedRating === 'solid' ? '🟢 THUỘC CHẮC' : (savedRating === 'fuzzy' ? '🟡 NHỚ MỜ' : (savedRating === 'forgot' ? '🔴 CẦN NHỚ LẠI' : '⚪ CHƯA ÔN'));

  let bodyHtml = '';
  if (card.quiz) {
    const chosen = sess.quizAnswers?.[card.cardKey];
    const answered = chosen !== undefined;
    const keys = ['A', 'B', 'C', 'D'];
    bodyHtml = `
      <div class="fc-question-box">
        <div class="fc-question-head"><span>TRẮC NGHIỆM</span></div>
        <div class="fc-question-text">${escapeHtml(card.question)}</div>
      </div>
      <div class="fc-quiz-opts">
        ${card.quiz.options.map((opt, idx) => {
          let cls = '';
          if (answered) {
            if (idx === card.quiz.correctIdx) cls = 'is-correct';
            else if (idx === chosen) cls = 'is-wrong';
          }
          return `<button type="button" class="fc-quiz-opt ${cls}" ${answered ? 'disabled' : ''} onclick="p2SelectQuizOption(${idx})"><span class="q-key">${keys[idx]}</span><span>${escapeHtml(opt)}</span></button>`;
        }).join('')}
      </div>
      ${answered ? `<div class="fc-answer">${card.answerHtml}</div>` : ''}`;
  } else {
    const ev = (sess.evaluations && sess.evaluations[card.cardKey]) || (state.flashcard.evaluations && state.flashcard.evaluations[card.cardKey]) || null;
    const evBadge = ev
      ? `<div class="fc-grader-card" style="padding:8px 10px;" data-no-i18n="1">
           <div class="fc-grader-scores">
             <span class="fc-engine-badge ${ev.engine === 'gemini' ? 'is-ai' : 'is-offline'}">${ev.engine === 'gemini' ? '🤖 AI 2 Tầng' : '⚡ Offline Rubric'}</span>
             <span class="fc-score-chip">Khớp ý lõi: <b>${Number(ev.note_match_score ?? 0)}%</b></span>
             <button type="button" class="btn btn-sm btn-indigo" onclick="p2EvaluateDrill(true)" ${ev.loading ? 'disabled' : ''}>${ev.loading ? '⏳ Đang soi AI...' : '🤖 Chấm AI'}</button>
           </div>
           ${ev.ai_error ? `<div class="mono" style="margin-top:4px;font-size:11px;color:var(--red);">${escapeHtml(ev.ai_error)}</div>` : ''}
         </div>`
      : '';
    bodyHtml = `
      <div class="fc-question-box">
        <div class="fc-question-head">
          <span>CÂU HỎI KIỂM TRA TRÍ NHỚ</span>
          ${card.hint ? `<button type="button" class="btn btn-sm" style="padding:2px 7px;font-size:12px;" onclick="p2ToggleDrillHint()">${sess.showHint ? 'Ẩn gợi ý' : 'Gợi ý'}</button>` : ''}
        </div>
        <div class="fc-question-text">${escapeHtml(card.question)}</div>
        ${card.hint && sess.showHint ? `<div class="fc-hint-box">💡 ${escapeHtml(card.hint)}</div>` : ''}
      </div>
      ${!flipped ? `
        <div class="fc-draft-wrap">
          <div class="fc-draft-head"><span>TỰ GÕ CÂU TRẢ LỜI (TỰ LƯU NHÁP)</span></div>
          <textarea id="p2-fc-draft" class="fc-draft-input" spellcheck="false" placeholder="Gõ nhanh những gì bạn nhớ được...">${escapeHtml(draftVal)}</textarea>
        </div>` : `
        <div class="fc-answer stack">
          ${evBadge}
          <div class="fc-compare">
            <div class="fc-compare-col">
              <div class="fc-compare-lbl">CÂU TRẢ LỜI BẠN TỰ NHỚ</div>
              <div class="fc-user-text">${draftVal.trim() ? escapeHtml(draftVal) : '<span style="color:var(--text-3);">(Chưa gõ nháp)</span>'}</div>
            </div>
            <div class="fc-compare-col ref-col">
              <div class="fc-compare-lbl">ĐÁP ÁN CHUẨN TRONG BÀI</div>
              ${card.answerHtml}
            </div>
          </div>
          <div class="fc-rate-bar">
            <span class="fc-rate-lbl">CHẤM NHỚ:</span>
            <button type="button" class="fc-rate-btn rate-forgot ${savedRating === 'forgot' ? 'active' : ''}" onclick="p2RateDrill('forgot')">🔴 Quên</button>
            <button type="button" class="fc-rate-btn rate-fuzzy ${savedRating === 'fuzzy' ? 'active' : ''}" onclick="p2RateDrill('fuzzy')">🟡 Nhớ mờ</button>
            <button type="button" class="fc-rate-btn rate-solid ${savedRating === 'solid' ? 'active' : ''}" onclick="p2RateDrill('solid')">🟢 Thuộc chắc</button>
          </div>
        </div>`}`;
  }

  contentEl.innerHTML = `
    <div class="p2-drill-wrap">
      <div class="fc-bar">
        <span data-no-i18n="1">${escapeHtml(meta.badge)} · ${pad2(sess.index + 1)}/${pad2(deck.length)}</span>
        <button type="button" class="btn btn-sm" onclick="openTargetInPrimary(_describeTarget('drill','${escapeHtml(sess.key)}','${escapeHtml(sess.ws)}'))">↗ ${isEn ? 'Focus Pane 1' : 'Mở Khung 1'}</button>
      </div>
      <div class="fc-progress"><div style="width:${pct}%"></div></div>
      <div class="fc-card" style="padding:14px 16px;">
        <div class="stack">
          <div class="fc-breadcrumbs">
            <span class="d-id">${escapeHtml(card.id)}</span>
            <span class="fc-kind-pill">${escapeHtml(card.badge)}</span>
            <span class="fc-lvl-pill ${lvlClass}">${lvlText}</span>
          </div>
          <div class="d-title" style="font-size:15.5px;">${escapeHtml(card.title)}</div>
          ${bodyHtml}
        </div>
        <div class="fc-ctl">
          <div class="grp">
            <button type="button" class="btn btn-sm" onclick="p2MoveDrill(-1)">← Trước</button>
            <button type="button" class="btn btn-sm" onclick="p2MoveDrill(1)">Tiếp →</button>
          </div>
          <div class="grp">
            ${!card.quiz ? `<button type="button" id="p2-flip-btn" class="btn btn-sm btn-primary" onclick="p2FlipDrill()">${flipped ? 'Ẩn đáp án' : (draftVal.trim().length >= 5 ? '⚡ Lật & Chấm' : 'Lật thẻ')}</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;

  const p2Ta = document.getElementById('p2-fc-draft');
  if (p2Ta) {
    p2Ta.addEventListener('input', () => {
      if (typeof persistDrillDraftDebounced === 'function') persistDrillDraftDebounced(card.cardKey, p2Ta.value);
      const fb = document.getElementById('p2-flip-btn');
      if (fb) fb.textContent = p2Ta.value.trim().length >= 5 ? '⚡ Lật & Chấm' : 'Lật thẻ';
    });
  }
}

function renderPane2() {
  if (!state.splitMode) return;
  const group = state.pane2.group || 'scratchpad';
  ['plc', 'network', 'repair', 'knowledge', 'scratchpad', 'drill'].forEach((g) => {
    document.getElementById(`p2-pill-${g}`)?.classList.toggle('active', g === group);
  });

  const sel = document.getElementById('pane2-item-select');
  const items = _getPane2ItemList(group);
  if (sel) {
    const curVal = group === 'scratchpad'
      ? (state.pane2.ws || 'plc')
      : (group === 'drill' ? (state.pane2.drillKey || state.pane2.id || '') : (state.pane2.id || ''));
    sel.innerHTML = items.length
      ? items.map((it) => `<option value="${escapeHtml(it.id)}">${escapeHtml(it.label)}</option>`).join('')
      : `<option value="">(Trống)</option>`;
    if (items.some((it) => it.id === curVal)) sel.value = curVal;
    else if (items.length) {
      sel.value = items[0].id;
      if (group === 'scratchpad') state.pane2.ws = items[0].id;
      else if (group === 'drill') {
        state.pane2.drillKey = items[0].id;
        state.pane2.id = items[0].id;
        state.pane2.ws = items[0].ws || state.activeWorkspace || 'plc';
      } else state.pane2.id = items[0].id;
    }
  }

  renderPane2Browser();
  const meta = getPane2TargetMeta();
  if (meta) upsertEditorTab(meta);
  renderEditorTabs();

  const contentEl = document.getElementById('pane2-content');
  if (!contentEl) return;

  if (group === 'drill') {
    renderPane2Drill();
    if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
    return;
  }

  if (group === 'scratchpad') {
    renderPane2Scratchpad();
    return;
  }

  const opts = { showNav: false, showDropzone: false, codePrefix: 'p2-', pane: 'secondary' };
  if (group === 'plc') {
    const p = state.plcNotes.find((x) => x.id === state.pane2.id) || state.plcNotes[0];
    contentEl.innerHTML = p ? buildPlcDetailHtml(p, opts) : '<div class="empty">KHÔNG CÓ BÀI PLC</div>';
    _hydrateInlineSectionEditor(contentEl);
  } else if (group === 'network') {
    const n = state.networkNotes.find((x) => x.id === state.pane2.id) || state.networkNotes[0];
    contentEl.innerHTML = n ? buildNetworkDetailHtml(n, opts) : '<div class="empty">KHÔNG CÓ CẤU HÌNH MẠNG</div>';
    _hydrateInlineSectionEditor(contentEl);
  } else if (group === 'repair') {
    const c = state.repairCases.find((x) => x.id === state.pane2.id) || state.repairCases[0];
    contentEl.innerHTML = c ? buildRepairDetailHtml(c, opts) : '<div class="empty">KHÔNG CÓ CA SỬA CHỮA</div>';
  } else if (group === 'knowledge') {
    const k = state.knowledgeItems.find((x) => x.id === state.pane2.id) || state.knowledgeItems[0];
    contentEl.innerHTML = k ? buildKnowledgeDetailHtml(k, opts) : '<div class="empty">KHÔNG CÓ BÀI KIẾN THỨC</div>';
    _hydrateInlineSectionEditor(contentEl);
  }
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

