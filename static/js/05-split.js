// ---------------------------------------------------------------------------
// TIA Portal Editor Tab Strip & Cross-Workspace Split Editor (Khung 1 / Khung 2)
// ---------------------------------------------------------------------------
function _describeTarget(kind, id, ws) {
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
  if (state.activeTab === 'flashcards') return { key: `flashcards:${state.activeWorkspace}`, kind: 'flashcards', id: null, ws: state.activeWorkspace, badge: 'ÔN TẬP', title: `Flashcard ${state.activeWorkspace.toUpperCase()}` };
  if (state.activeTab === 'en-quiz') return { key: 'english:quiz', kind: 'en-quiz', id: null, ws: 'english', badge: 'OPENQUIZ SRS', title: 'Ôn tập SRS & Đa chế độ' };
  if (state.activeTab === 'en-coach') return { key: 'english:coach', kind: 'en-coach', id: null, ws: 'english', badge: 'THỰC CHIẾN 1-1', title: 'Dịch câu & Phản xạ nói' };
  if (state.activeTab === 'en-reading') return { key: 'english:reading', kind: 'en-reading', id: null, ws: 'english', badge: 'ĐỌC HIỂU AI', title: 'Đọc hiểu Manual & Tình huống' };
  if (state.activeTab === 'en-vocab-bank') return { key: 'english:vocab', kind: 'en-vocab-bank', id: null, ws: 'english', badge: 'KHO TỪ VỰNG', title: 'Từ vựng & Lexical Chunks' };
  if (state.activeTab === 'en-ingest') return { key: 'english:ingest', kind: 'en-ingest', id: null, ws: 'english', badge: 'PHỄU NẠP', title: 'Nạp dữ liệu nhanh & Manual' };
  return null;
}

function getPane2TargetMeta() {
  if (!state.splitMode) return null;
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
    if (state.editorTabs.length > 14) state.editorTabs.shift();
  }
}

function syncPrimaryEditorTab() {
  const p1 = getPrimaryTargetMeta();
  if (p1 && ['repair', 'knowledge', 'plc', 'network', 'scratchpad'].includes(p1.kind)) {
    upsertEditorTab(p1);
  }
  const p1Label = document.getElementById('pane1-label');
  if (p1Label) p1Label.textContent = p1 ? `${p1.badge} · ${p1.title}` : 'KHUNG CHÍNH';
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

  const tabsHtml = state.editorTabs.map((t) => {
    const isP1 = t.key === p1Key;
    const isP2 = t.key === p2Key;
    const mark = (isP1 && isP2) ? '1|2' : (isP1 ? '1' : (isP2 ? '2' : ''));
    return `
      <div class="etab ${isP1 ? 'is-p1' : ''} ${isP2 ? 'is-p2' : ''}" data-ctx-tab-key="${escapeHtml(t.key)}" onclick="activateEditorTab('${escapeHtml(t.key)}', event)" title="${escapeHtml(t.badge + ' — ' + t.title)}">
        <span class="etab-badge">${escapeHtml(t.badge)}</span>
        <span class="etab-title">${escapeHtml(t.title)}</span>
        ${(state.splitMode && mark) ? `<span class="etab-pane-mark">${mark}</span>` : ''}
        <button type="button" class="etab-close" onclick="closeEditorTab('${escapeHtml(t.key)}', event)" title="Đóng tab">×</button>
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
  state.editorTabs.splice(idx, 1);
  renderEditorTabs();
}

function openTargetInPrimary(meta) {
  if (!meta) return;
  if (meta.kind === 'scratchpad') {
    enterWorkspace(meta.ws || 'plc', 'scratchpad');
  } else if (meta.kind === 'repair') {
    state.repairFilters = { category: 'ALL', status: 'ALL', q: '' };
    state.selectedRepairId = meta.id;
    if (!state.repairsListPinned) state.repairsListCollapsed = true;
    enterWorkspace('mrl', 'repairs');
  } else if (meta.kind === 'knowledge') {
    state.knowledgeFilters = { group: 'ALL', mode: 'ALL', category: 'ALL', status: 'ALL', q: '' };
    state.selectedKnowledgeId = meta.id;
    if (!state.knowledgeListPinned) state.knowledgeListCollapsed = true;
    enterWorkspace('mrl', 'knowledge');
  } else if (meta.kind === 'plc') {
    state.plcFilters = { category: 'ALL', status: 'ALL', q: '' };
    state.selectedPlcId = meta.id;
    if (!state.plcListPinned) state.plcListCollapsed = true;
    enterWorkspace('plc', 'plc');
  } else if (meta.kind === 'network') {
    state.networkFilters = { protocol: 'ALL', status: 'ALL', q: '' };
    state.selectedNetworkId = meta.id;
    if (!state.networkListPinned) state.networkListCollapsed = true;
    enterWorkspace('network', 'network');
  }
}

function openTargetInSecondary(meta) {
  if (!meta) return;
  state.pane2Initialized = true;
  if (meta.kind === 'scratchpad') {
    state.pane2.group = 'scratchpad';
    state.pane2.ws = meta.ws || state.activeWorkspace || 'plc';
    state.pane2.id = state.pane2.ws;
  } else {
    state.pane2.group = meta.kind;
    state.pane2.id = meta.id;
    state.pane2.ws = meta.ws;
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
    if (p1 && p1.kind !== 'scratchpad') {
      state.pane2.group = 'scratchpad';
      state.pane2.ws = state.activeWorkspace || 'plc';
      state.pane2.id = state.pane2.ws;
    } else {
      const ws = state.activeWorkspace || 'plc';
      if (ws === 'plc' && state.plcNotes.length) {
        state.pane2 = { ...state.pane2, group: 'plc', id: state.selectedPlcId || state.plcNotes[0].id, ws: 'plc' };
      } else if (ws === 'network' && state.networkNotes.length) {
        state.pane2 = { ...state.pane2, group: 'network', id: state.selectedNetworkId || state.networkNotes[0].id, ws: 'network' };
      } else if (state.repairCases.length) {
        state.pane2 = { ...state.pane2, group: 'repair', id: state.selectedRepairId || state.repairCases[0].id, ws: 'mrl' };
      } else {
        state.pane2 = { ...state.pane2, group: 'scratchpad', id: ws, ws };
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
  if (['repair', 'knowledge', 'plc', 'network', 'scratchpad'].includes(p2.kind)) {
    openTargetInPrimary(p2);
  }
  if (['repair', 'knowledge', 'plc', 'network', 'scratchpad'].includes(p1.kind)) {
    state.pane2Initialized = true;
    if (p1.kind === 'scratchpad') {
      state.pane2.group = 'scratchpad';
      state.pane2.ws = p1.ws;
      state.pane2.id = p1.ws;
    } else {
      state.pane2.group = p1.kind;
      state.pane2.id = p1.id;
      state.pane2.ws = p1.ws;
    }
  }
  renderPane2();
  syncPrimaryEditorTab();
}

function pinPrimaryToSecondary(ev) {
  if (ev) ev.stopPropagation();
  const p1 = getPrimaryTargetMeta();
  if (!p1) return;
  if (p1.kind === 'dictionary' || p1.kind === 'flashcards') {
    showToast('Chọn một bài học, ca sửa hoặc Nháp để ghim sang Khung 2', 'info');
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

function _getPane2ItemList(group) {
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
  } else {
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
  } else {
    state.pane2.id = sel.value;
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

  const allEntries = [
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
             placeholder="Tìm xuyên phân hệ: PLC-003, NET-001, Yaskawa, Modbus, Nháp..."
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

function renderPane2() {
  if (!state.splitMode) return;
  const group = state.pane2.group || 'scratchpad';
  ['plc', 'network', 'repair', 'knowledge', 'scratchpad'].forEach((g) => {
    document.getElementById(`p2-pill-${g}`)?.classList.toggle('active', g === group);
  });

  const sel = document.getElementById('pane2-item-select');
  const items = _getPane2ItemList(group);
  if (sel) {
    const curVal = group === 'scratchpad' ? (state.pane2.ws || 'plc') : (state.pane2.id || '');
    sel.innerHTML = items.length
      ? items.map((it) => `<option value="${escapeHtml(it.id)}">${escapeHtml(it.label)}</option>`).join('')
      : `<option value="">(Trống)</option>`;
    if (items.some((it) => it.id === curVal)) sel.value = curVal;
    else if (items.length) {
      sel.value = items[0].id;
      if (group === 'scratchpad') state.pane2.ws = items[0].id;
      else state.pane2.id = items[0].id;
    }
  }

  renderPane2Browser();
  const meta = getPane2TargetMeta();
  if (meta) upsertEditorTab(meta);
  renderEditorTabs();

  const contentEl = document.getElementById('pane2-content');
  if (!contentEl) return;

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

