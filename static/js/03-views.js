// ---------------------------------------------------------------------------
// 01 Nhật ký ca sửa chữa (Inline Editing + Auto-Save + Bench Workflow)
// ---------------------------------------------------------------------------
const COLD_CHECK_TEMPLATE_ROWS = [
  { vi: 'Ngoại quan', en: 'Visual Inspection' },
  { vi: 'Cầu chì / Nguồn vào', en: 'Fuse / Input Power' },
  { vi: 'Cầu chỉnh lưu / DC Bus', en: 'Rectifier Bridge / DC Bus' },
  { vi: 'Tụ lọc / ESR', en: 'Filter Capacitors / ESR' },
  { vi: 'IGBT / MOSFET', en: 'IGBT / MOSFET' },
  { vi: 'Driver / Opto', en: 'Driver / Optocoupler' },
];

function _coldCheckStatusMeta(status, isEn = _repairIsEnLang()) {
  const s = String(status || 'none').toLowerCase();
  if (s === 'ok') return { code: 'ok', label: '🟢 OK', next: 'suspect', cls: 'cc-st-badge-ok' };
  if (s === 'suspect') return { code: 'suspect', label: isEn ? '🟡 Suspect' : '🟡 Nghi ngờ', next: 'fault', cls: 'cc-st-badge-suspect' };
  if (s === 'fault') return { code: 'fault', label: isEn ? '🔴 Fault' : '🔴 Hỏng', next: 'none', cls: 'cc-st-badge-fault' };
  return { code: 'none', label: '—', next: 'ok', cls: 'cc-st-badge-none' };
}

function _resolveColdCheckRowsForCase(c) {
  if (!c) return [];
  if (window.MRLCoreStore && typeof window.MRLCoreStore.resolveColdCheckRows === 'function') {
    return window.MRLCoreStore.resolveColdCheckRows(c.cold_check_json, c.cold_check_raw);
  }
  return Array.isArray(c.cold_check_json) ? c.cold_check_json : [];
}

function _serializeColdCheckRowsJS(rows) {
  if (window.MRLCoreStore && typeof window.MRLCoreStore.serializeColdCheckRowsToText === 'function') {
    return window.MRLCoreStore.serializeColdCheckRowsToText(rows);
  }
  return '';
}

function _isCapRowJS(r) {
  if (!r) return false;
  if (window.MRLCoreStore && typeof window.MRLCoreStore.isCapacitorColdRow === 'function') {
    return window.MRLCoreStore.isCapacitorColdRow(r.item, r.caps);
  }
  return (Array.isArray(r.caps) && r.caps.length > 0) || /tụ|capacitor|\bcap\b|\besr\b/i.test(String(r.item || ''));
}

function _cloneCapItemsJS(caps) {
  return Array.isArray(caps) ? caps.map((x) => ({ ...x })) : [];
}

function _getCapsForRow(r) {
  if (!r) return [];
  if (Array.isArray(r.caps)) return _cloneCapItemsJS(r.caps);
  if (r.result && window.MRLCoreStore && typeof window.MRLCoreStore.parseCapacitorLines === 'function') {
    return window.MRLCoreStore.parseCapacitorLines(r.result);
  }
  return [];
}

function _serializeCapsJS(caps) {
  if (window.MRLCoreStore && typeof window.MRLCoreStore.serializeCapsToResult === 'function') {
    return window.MRLCoreStore.serializeCapsToResult(caps);
  }
  return '';
}

function _preserveColdRowForPayload(r, idx) {
  const obj = {
    id: r.id && !String(r.id).startsWith('cc-draft-') ? r.id : `cc-${idx + 1}`,
    item: String(r.item || '').trim(),
    result: String(r.result || '').trim(),
    status: r.status || 'none',
  };
  if (Array.isArray(r.caps)) {
    obj.caps = _cloneCapItemsJS(r.caps);
  } else if (_isCapRowJS(obj)) {
    obj.caps = _getCapsForRow(obj);
  }
  return obj;
}

function _getDisplayColdRowsForCase(c) {
  if (!c) return [];
  const saved = _resolveColdCheckRowsForCase(c).map((r) => ({
    ...r,
    ...(Array.isArray(r.caps) ? { caps: _cloneCapItemsJS(r.caps) } : {}),
    _isDraft: false,
  }));
  const drafts = (state.repairDraftColdRows && Array.isArray(state.repairDraftColdRows[c.id]))
    ? state.repairDraftColdRows[c.id]
    : [];
  const combined = [...saved];
  drafts.forEach((d) => {
    const itemCopy = {
      id: d.id || `cc-draft-${Date.now()}`,
      item: d.item || '',
      result: d.result || '',
      status: d.status || 'none',
      ...(Array.isArray(d.caps) ? { caps: _cloneCapItemsJS(d.caps) } : {}),
      _isDraft: true,
      _insertAt: typeof d._insertAt === 'number' ? d._insertAt : null,
    };
    if (typeof itemCopy._insertAt === 'number' && itemCopy._insertAt >= 0 && itemCopy._insertAt <= combined.length) {
      combined.splice(itemCopy._insertAt, 0, itemCopy);
    } else {
      combined.push(itemCopy);
    }
  });
  return combined;
}

function _autoResizeRepairTextarea(ta, minH = 68) {
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = `${Math.max(minH, ta.scrollHeight + 4)}px`;
}

function _repairIsEnLang() {
  return typeof state !== 'undefined' && state.appLang === 'en';
}

function _getRepairCaseById(id) {
  return (state.repairCases || []).find((x) => x.id === id) || null;
}

function _rbSvgPlus() {
  return '<svg class="rb-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M8 3.2v9.6M3.2 8h9.6"/></svg>';
}

function _rbSvgClose() {
  return '<svg class="rb-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
}

function _rbSvgBilingual() {
  return '<svg class="rb-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M2.8 8h10.4M8 2.5a8.5 8.5 0 0 1 0 11M8 2.5a8.5 8.5 0 0 0 0 11"/></svg>';
}

function _isPlaceholderRepairTextJS(val) {
  const s = String(val || '').trim().toLowerCase();
  if (!s) return true;
  const cleaned = s.replace(/^[\s\-–—]+|[\s\-–—]+$/g, '');
  return cleaned === '' || cleaned === 'chưa ghi nhận' || cleaned === 'n/a' || cleaned === 'none';
}

function _normalizeRepairBlocksForCase(rawBlocks) {
  if (window.MRLCoreStore && typeof window.MRLCoreStore.normalizeRepairBlocks === 'function') {
    return window.MRLCoreStore.normalizeRepairBlocks(rawBlocks);
  }
  let parsed = rawBlocks;
  if (typeof rawBlocks === 'string') {
    try { parsed = JSON.parse(rawBlocks.trim() || '[]'); } catch (_) { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  const out = [];
  for (const b of parsed) {
    if (!b || typeof b !== 'object') continue;
    const title = String(b.title || '').trim();
    const normRows = [];
    for (const r of (Array.isArray(b.rows) ? b.rows : [])) {
      if (!r || typeof r !== 'object') continue;
      const label = String(r.label || '').trim();
      const content = String(r.content || '').trim();
      if (!label && !content) continue;
      normRows.push({
        id: String(r.id || '').trim() || `row-${normRows.length + 1}`,
        label,
        content,
      });
    }
    if (!title && !normRows.length) continue;
    out.push({
      id: String(b.id || '').trim() || `blk-${out.length + 1}`,
      title,
      rows: normRows,
    });
  }
  return out;
}

function _resolveRepairBlocksForCase(c) {
  if (!c) return [];
  if (window.MRLCoreStore && typeof window.MRLCoreStore.convertLegacyStepsToBlocks === 'function') {
    return window.MRLCoreStore.convertLegacyStepsToBlocks(c, c.steps);
  }
  const existing = _normalizeRepairBlocksForCase(c.repair_blocks_json);
  if (existing.length) return existing;
  const srcSteps = Array.isArray(c.steps) ? c.steps : [];
  const legacy = [];
  srcSteps.forEach((st) => {
    if (!st || typeof st !== 'object') return;
    const sym = _isPlaceholderRepairTextJS(st.symptom) ? '' : String(st.symptom || '').trim();
    const cause = _isPlaceholderRepairTextJS(st.root_cause) ? '' : String(st.root_cause || '').trim();
    const sol = _isPlaceholderRepairTextJS(st.solution) ? '' : String(st.solution || '').trim();
    if (sym || cause || sol) legacy.push({ symptom: sym, root_cause: cause, solution: sol });
  });
  if (!legacy.length) {
    const sym = _isPlaceholderRepairTextJS(c.fault_symptom_raw) ? '' : String(c.fault_symptom_raw || '').trim();
    const cause = _isPlaceholderRepairTextJS(c.root_cause_raw) ? '' : String(c.root_cause_raw || '').trim();
    const sol = _isPlaceholderRepairTextJS(c.solution_raw) ? '' : String(c.solution_raw || '').trim();
    if (sym || cause || sol) legacy.push({ symptom: sym, root_cause: cause, solution: sol });
  }
  const multi = legacy.length > 1;
  return legacy.map((st, idx) => {
    const rows = [];
    if (st.symptom) rows.push({ id: `row-${rows.length + 1}`, label: 'Hiện tượng / Điểm đo', content: st.symptom });
    if (st.root_cause) rows.push({ id: `row-${rows.length + 1}`, label: 'Nguyên nhân gốc rễ', content: st.root_cause });
    if (st.solution) rows.push({ id: `row-${rows.length + 1}`, label: 'Cách xử lý & Linh kiện', content: st.solution });
    return { id: `blk-${idx + 1}`, title: multi ? `Bước ${pad2(idx + 1)}` : 'Quy trình bắt bệnh & Xử lý', rows };
  }).filter((b) => b.rows.length > 0);
}

function _serializeRepairBlocksJS(blocks) {
  if (window.MRLCoreStore && typeof window.MRLCoreStore.serializeRepairBlocksToText === 'function') {
    return window.MRLCoreStore.serializeRepairBlocksToText(blocks);
  }
  return _normalizeRepairBlocksForCase(blocks).map((blk) => {
    const lines = blk.title ? [`[${blk.title}]`] : [];
    blk.rows.forEach((r) => {
      if (r.label && r.content) lines.push(`- ${r.label}: ${r.content}`);
      else if (r.label || r.content) lines.push(`- ${r.label || r.content}`);
    });
    return lines.join('\n');
  }).filter(Boolean).join('\n\n');
}

function _getDisplayRepairBlocksForCase(c) {
  if (!c) return [];
  const saved = _resolveRepairBlocksForCase(c);
  const caseDraft = state.repairDraftBlocks && state.repairDraftBlocks[c.id];
  const rowsMap = (caseDraft && caseDraft.rows) || {};
  const draftBlocks = (caseDraft && Array.isArray(caseDraft.blocks)) ? caseDraft.blocks : [];

  const merged = saved.map((b) => {
    const rows = (b.rows || []).map((r) => ({ ...r }));
    const dRows = Array.isArray(rowsMap[b.id]) ? rowsMap[b.id] : [];
    const sortedDrafts = [...dRows].sort((a, z) => {
      const ia = typeof a._insertAt === 'number' ? a._insertAt : 999999;
      const iz = typeof z._insertAt === 'number' ? z._insertAt : 999999;
      return ia - iz;
    });
    let offset = 0;
    sortedDrafts.forEach((d) => {
      const clone = { ...d, _isDraft: true };
      if (typeof d._insertAt === 'number') {
        const pos = Math.max(0, Math.min(d._insertAt + offset, rows.length));
        rows.splice(pos, 0, clone);
        offset += 1;
      } else {
        rows.push(clone);
      }
    });
    return { ...b, rows };
  });

  draftBlocks.forEach((db) => {
    merged.push({
      ...db,
      _isDraft: true,
      rows: (db.rows || []).map((r) => ({ ...r, _isDraft: true })),
    });
  });

  return merged;
}

function _getDisplayStepsForCase(c) {
  return [];
}

function _recomputeRepairTagsDictionary() {
  const compMap = {};
  const faultMap = {};
  (state.repairCases || []).forEach((r) => {
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
  (state.knowledgeItems || []).forEach((k) => {
    (k.component_tags || []).forEach((t) => {
      if (!compMap[t]) compMap[t] = { tag: t, repair_count: 0, knowledge_count: 0, total: 0 };
      compMap[t].knowledge_count += 1;
      compMap[t].total += 1;
    });
  });
  state.tagsDictionary = {
    component_tags: Object.values(compMap).sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag)),
    fault_codes: Object.values(faultMap).sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag)),
  };
}

function getFilteredRepairCases() {
  const { category, status, q } = state.repairFilters;
  const needle = (q || '').trim().toLowerCase().replace(/^#/, '');
  return state.repairCases.filter((c) => {
    if (category !== 'ALL' && c.device_category !== category) return false;
    if (status !== 'ALL' && c.status_code !== status) return false;
    if (needle) {
      const blocksStr = _serializeRepairBlocksJS(_resolveRepairBlocksForCase(c));
      const stepsStr = (c.steps || []).map((s) => `${s.symptom} ${s.root_cause} ${s.solution}`).join(' ');
      const hay = `${c.id} ${c.device_category} ${categoryLabel(c.device_category)} ${c.brand_model} ${c.cold_check_raw || ''} ${blocksStr} ${c.fault_symptom_raw} ${c.root_cause_raw} ${c.solution_raw} ${c.note} ${(c.component_tags || []).join(' ')} ${(c.fault_codes || []).join(' ')} ${stepsStr}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}
function setRepairCategory(cat) {
  state.repairFilters.category = cat;
  state.repairsListCollapsed = false;
  renderRepairsView();
}
function onRepairFilterChange() {
  state.repairFilters.status = document.getElementById('repair-status-filter').value;
  const qi = document.getElementById('repair-search-input');
  state.repairFilters.q = qi.value;
  document.getElementById('repair-search-clear').classList.toggle('hidden', !qi.value);
  state.repairsListCollapsed = false;
  renderRepairsView();
}
function clearRepairSearch() { document.getElementById('repair-search-input').value = ''; onRepairFilterChange(); }
function selectRepairCase(id) {
  if (state.repairInlineEdit && state.repairInlineEdit.caseId !== id) {
    flushActiveRepairInlineEdit();
  }
  state.repairTagAdd = null;
  state.selectedRepairId = id;
  if (!state.repairsListPinned) state.repairsListCollapsed = true;
  renderRepairsView();
  const pane = document.getElementById('repair-detail');
  if (pane) pane.scrollTop = 0;
  if (typeof pushNavHistory === 'function') pushNavHistory();
}

function renderRepairsView() {
  const splitEl = document.querySelector('#view-repairs .split');
  if (splitEl) splitEl.classList.toggle('list-collapsed', state.repairsListCollapsed);

  const counts = { ALL: state.repairCases.length };
  state.repairCases.forEach((c) => { counts[c.device_category] = (counts[c.device_category] || 0) + 1; });
  document.getElementById('repair-category-pills').innerHTML = chipsHtml(REPAIR_CATEGORIES, state.repairFilters.category, counts, 'setRepairCategory', 'repair');

  const filtered = getFilteredRepairCases();
  document.getElementById('repair-list-count').textContent = filtered.length;
  if (filtered.length > 0 && !filtered.some((c) => c.id === state.selectedRepairId)) state.selectedRepairId = filtered[0].id;

  const listEl = document.getElementById('repair-list');
  if (filtered.length === 0) {
    listEl.classList.remove('has-selection');
    listEl.innerHTML = `<div class="empty">KHÔNG CÓ CA PHÙ HỢP</div>`;
    document.getElementById('repair-detail').innerHTML = `<div class="empty">CHƯA CHỌN CA BỆNH</div>`;
    return;
  }
  listEl.classList.add('has-selection');
  listEl.innerHTML = filtered.map((c) => {
    const sel = c.id === state.selectedRepairId;
    const blockCnt = _resolveRepairBlocksForCase(c).length;
    const titleLine = String(c.brand_model || '').replace(/\s*\n+\s*/g, ' — ');
    const stLabel = (STATUS_META[c.status_code] || STATUS_META.unclassified).label;
    return `
      <div class="row ${sel ? 'selected' : ''}" data-ctx-record-kind="repair" data-ctx-record-id="${escapeHtml(c.id)}" onclick="selectRepairCase('${escapeHtml(c.id)}')">
        <div class="row-top">
          <span class="row-id">${escapeHtml(c.id)}</span>
          <span>·</span>
          <span class="row-cat">${escapeHtml(categoryLabel(c.device_category))}</span>
          <span class="led led-${c.status_code}" title="${escapeHtml(stLabel)}"></span>
        </div>
        <div class="row-main">
          <div class="row-title" title="${escapeHtml(c.brand_model)}">${escapeHtml(titleLine)}</div>
          <span class="row-step-count">${blockCnt} mục</span>
        </div>
      </div>`;
  }).join('');

  const curIdx = Math.max(0, filtered.findIndex((c) => c.id === state.selectedRepairId));
  renderRepairDetail(filtered[curIdx], curIdx, filtered.length);
}

function _repairCellBodyHtml(value, c) {
  const cleanVal = String(value || '').trim();
  return cleanVal
    ? highlightTagsHtml(cleanVal, c?.component_tags, c?.fault_codes)
    : '<span class="none">— Chưa ghi nhận —</span>';
}

function specRow(cls, field, key, value, c, stepIdx, inline = true) {
  // Backward-compatible guard for legacy 4-arg calls: specRow(cls, key, value, c)
  if (c === undefined && value && typeof value === 'object' && 'id' in value) {
    c = value;
    value = key;
    key = field;
    field = cls;
    stepIdx = 0;
    inline = false;
  }
  const cid = escapeHtml(c?.id || '');
  const body = _repairCellBodyHtml(value, c);
  const canInline = Boolean(inline && cid && typeof stepIdx === 'number');
  const attrs = canInline
    ? `class="spec-v rep-editable" data-step-idx="${stepIdx}" data-step-field="${field}" onclick="onRepairEditableClick(event, function(){ startRepairStepFieldEdit('${cid}', ${stepIdx}, '${field}'); })"`
    : `class="spec-v"`;
  return `<div class="spec-row ${cls}"><div class="spec-k">${key}</div><div ${attrs}>${body}</div></div>`;
}

function renderRepairInteractiveTagsHtml(c, inline = true) {
  const faults = c.fault_codes || [];
  const comps = c.component_tags || [];
  const cid = escapeHtml(c.id);

  if (!inline) {
    return renderTagPills(comps, faults) || '<span class="mono" style="font-size:12px;color:var(--text-3);">CHƯA GẮN MÃ</span>';
  }

  const faultChips = faults.map((f) => {
    const ef = escapeHtml(f);
    return `<span class="tag tag-fault tag-chip">
      <button type="button" class="tag-chip-lbl" onclick="event.stopPropagation(); openCrossRefDrawer('${ef}')" title="Mã lỗi ${ef}">${ef}</button>
      <button type="button" class="tag-chip-x" onclick="removeRepairTagInline('${cid}', 'fault', '${ef}', event)" title="Xóa mã lỗi ${ef}" aria-label="Xóa ${ef}">×</button>
    </span>`;
  }).join('');

  const compChips = comps.map((t) => {
    const et = escapeHtml(t);
    return `<span class="tag tag-comp tag-chip">
      <button type="button" class="tag-chip-lbl" onclick="event.stopPropagation(); openCrossRefDrawer('${et}')" title="Linh kiện ${et}">${et}</button>
      <button type="button" class="tag-chip-x" onclick="removeRepairTagInline('${cid}', 'comp', '${et}', event)" title="Xóa thẻ ${et}" aria-label="Xóa ${et}">×</button>
    </span>`;
  }).join('');

  const activeAdd = state.repairTagAdd && state.repairTagAdd.caseId === c.id ? state.repairTagAdd.kind : null;

  const renderSlot = (kind, btnCls, lbl, ph) => {
    if (activeAdd === kind) {
      return `<span class="rep-tag-add-slot" data-tag-slot="${kind}">
        <span class="tag-inline-wrap">
          <input id="rep-tag-inp-${cid}-${kind}" class="tag-inline-inp mono" type="text" placeholder="${ph}"
                 onkeydown="onRepairTagInputKeydown(event, '${cid}', '${kind}')"
                 onblur="onRepairTagInputBlur(event, '${cid}', '${kind}')" />
          <button type="button" class="tag-inline-ok" onmousedown="event.preventDefault()" onclick="commitRepairTagInput('${cid}', '${kind}')" title="Thêm (Enter)">↵</button>
          <button type="button" class="tag-inline-cancel" onmousedown="event.preventDefault()" onclick="closeRepairTagInput()" title="Hủy (Esc)">×</button>
        </span>
      </span>`;
    }
    return `<span class="rep-tag-add-slot" data-tag-slot="${kind}">
      <button type="button" class="tag-add-btn ${btnCls}" onclick="openRepairTagInput('${cid}', '${kind}')">${lbl}</button>
    </span>`;
  };

  return faultChips + compChips
    + renderSlot('fault', 'tag-add-fault', '+ Mã lỗi', 'oL1, U1...')
    + renderSlot('comp', 'tag-add-comp', '+ Linh kiện', 'A3120, IGBT...');
}

function _coldCheckCellHtml(val, c, placeholder = '—') {
  const clean = String(val || '').trim();
  return clean
    ? highlightTagsHtml(clean, c?.component_tags, c?.fault_codes)
    : `<span class="none">${escapeHtml(placeholder)}</span>`;
}

function _coldCheckCountMetaHtml(rows, isEn = _repairIsEnLang()) {
  const total = (rows || []).length;
  const faultCount = (rows || []).filter((r) => String(r.status || 'none') === 'fault').length;
  const suspectCount = (rows || []).filter((r) => String(r.status || 'none') === 'suspect').length;
  const parts = [`${total} ${isEn ? (total === 1 ? 'item' : 'items') : 'hạng mục'}`];
  if (faultCount > 0) {
    parts.push(`<span class="cc-cnt-fault">${faultCount} ${isEn ? 'fault' : 'hỏng'}</span>`);
  }
  if (suspectCount > 0) {
    parts.push(`<span class="cc-cnt-suspect">${suspectCount} ${isEn ? 'suspect' : 'nghi ngờ'}</span>`);
  }
  return parts.join(' · ');
}

function _renderCapGridRowHtml(cid, ccIdx, cap, capIdx, inline = true, isEn = _repairIsEnLang()) {
  const capId = escapeHtml(cap.id || `cap-${capIdx + 1}`);
  const unit = escapeHtml(cap.cap_unit || 'µF');
  if (!inline) {
    return `
      <div class="cc-cap-row readonly" data-cap-idx="${capIdx}" data-cap-id="${capId}">
        <div class="cc-cap-spec-col"><span class="cc-cap-spec-txt">${escapeHtml(cap.spec || '—')}</span></div>
        <div class="cc-cap-meas-col">
          ${cap.cap_val ? `<span class="cc-cap-val-txt mono">${escapeHtml(cap.cap_val)} ${unit}</span>` : '<span class="none">—</span>'}
          ${cap.esr_val ? `<span class="cc-cap-sep">|</span><span class="cc-cap-esr-lbl">ESR</span><span class="cc-cap-esr-txt mono">${escapeHtml(cap.esr_val)} Ω</span>` : ''}
          ${cap.note ? `<span class="cc-cap-note-txt">${escapeHtml(cap.note)}</span>` : ''}
        </div>
      </div>`;
  }
  return `
    <div class="cc-cap-row" data-cap-idx="${capIdx}" data-cap-id="${capId}">
      <div class="cc-cap-spec-col">
        <input type="text" class="cc-cap-inp cc-cap-spec" data-cap-field="spec" spellcheck="false"
               placeholder="${isEn ? 'e.g. 470µF/50V' : 'VD: 470µF/50V'}"
               value="${escapeHtml(cap.spec || '')}"
               onkeydown="onCapInputKeydown(event, '${cid}', ${ccIdx}, ${capIdx}, 'spec')"
               onblur="onCapInputBlur(event, '${cid}', ${ccIdx})" />
      </div>
      <div class="cc-cap-meas-col">
        <div class="cc-cap-val-group">
          <input type="text" class="cc-cap-inp cc-cap-val mono" data-cap-field="cap_val" spellcheck="false"
                 placeholder="${isEn ? 'Meas' : 'Đo'}"
                 value="${escapeHtml(cap.cap_val || '')}"
                 onkeydown="onCapInputKeydown(event, '${cid}', ${ccIdx}, ${capIdx}, 'cap_val')"
                 onblur="onCapInputBlur(event, '${cid}', ${ccIdx})" />
          <button type="button" class="cc-cap-unit-btn" tabindex="-1" data-cap-unit="${unit}" data-no-i18n="1"
                  onmousedown="event.preventDefault()"
                  onclick="cycleCapRowUnitInline('${cid}', ${ccIdx}, ${capIdx}, this, event)"
                  title="${isEn ? 'Click to switch µF / mF / nF' : 'Bấm xoay vòng đơn vị µF → mF → nF'}">${unit}</button>
        </div>
        <span class="cc-cap-sep">|</span>
        <div class="cc-cap-esr-group">
          <span class="cc-cap-esr-lbl">ESR</span>
          <input type="text" class="cc-cap-inp cc-cap-esr mono" data-cap-field="esr_val" spellcheck="false"
                 placeholder="0.00"
                 value="${escapeHtml(cap.esr_val || '')}"
                 onkeydown="onCapInputKeydown(event, '${cid}', ${ccIdx}, ${capIdx}, 'esr_val')"
                 onblur="onCapInputBlur(event, '${cid}', ${ccIdx})" />
          <span class="cc-cap-ohm">Ω</span>
        </div>
        <input type="text" class="cc-cap-inp cc-cap-note" data-cap-field="note" spellcheck="false"
               placeholder="${isEn ? 'note...' : 'ghi chú...'}"
               value="${escapeHtml(cap.note || '')}"
               onkeydown="onCapInputKeydown(event, '${cid}', ${ccIdx}, ${capIdx}, 'note')"
               onblur="onCapInputBlur(event, '${cid}', ${ccIdx})" />
      </div>
      <button type="button" class="cc-cap-del-btn" tabindex="-1"
              onmousedown="event.preventDefault()"
              onclick="deleteCapRowInline('${cid}', ${ccIdx}, ${capIdx}, event)"
              title="${isEn ? 'Remove capacitor' : 'Xóa hàng tụ'}"
              aria-label="${isEn ? 'Remove capacitor' : 'Xóa hàng tụ'}">×</button>
    </div>`;
}

function renderRepairColdCheckBlockHtml(c, inline = true) {
  const rows = _getDisplayColdRowsForCase(c);
  const cid = escapeHtml(c.id);
  const isEn = _repairIsEnLang();

  if (!rows.length) {
    if (!inline) return '';
    return `
      <div class="rep-collapsed-bar rep-cold-bar">
        <button type="button" class="rep-collapsed-trigger" onclick="addColdCheckRowInline('${cid}', true)">${isEn ? '+ Add Cold Check' : '+ Thêm đo nguội (Cold Check)'}</button>
        <button type="button" class="btn btn-sm rep-tpl-btn" onclick="insertColdCheckTemplateInline('${cid}')">⚡ ${isEn ? 'Insert Cold Check Template' : 'Chèn mẫu đo nguội'}</button>
      </div>`;
  }

  const rowsHtml = rows.map((r, idx) => {
    const st = ['none', 'ok', 'suspect', 'fault'].includes(String(r.status || 'none')) ? String(r.status || 'none') : 'none';
    const meta = _coldCheckStatusMeta(st, isEn);
    const itemPh = isEn ? 'Component...' : 'Thành phần...';
    const resPh = isEn ? 'Measurement / Result...' : 'Kết quả / Thông số đo...';
    const itemHtml = _coldCheckCellHtml(r.item, c, itemPh);
    const isCap = _isCapRowJS(r);

    const itemAttrs = inline
      ? `class="cc-cell cc-cell-item cc-editable" data-cc-idx="${idx}" data-cc-field="item" onmousedown="onColdCheckCellMouseDown('${cid}', ${idx})" onclick="onRepairEditableClick(event, function(){ startColdCheckCellEdit('${cid}', ${idx}, 'item'); })"`
      : `class="cc-cell cc-cell-item"`;

    let resultTdHtml = '';
    if (isCap) {
      const caps = _getCapsForRow(r);
      const capsHtml = caps.map((cap, capIdx) => _renderCapGridRowHtml(cid, idx, cap, capIdx, inline, isEn)).join('');
      resultTdHtml = `
        <td class="cc-td-result cc-td-caps" data-no-i18n="1">
          <div class="cc-cell cc-cell-caps" data-cc-idx="${idx}" data-cc-field="caps" data-no-i18n="1">
            <div class="cc-cap-grid ${inline ? '' : 'readonly'}" data-cc-idx="${idx}">${capsHtml}</div>
            ${inline ? `<div class="cc-cap-foot"><button type="button" class="cc-cap-add-btn" tabindex="-1" onmousedown="event.preventDefault()" onclick="addCapRowInline('${cid}', ${idx})">${isEn ? '+ Add cap' : '+ Thêm tụ'}</button></div>` : ''}
          </div>
        </td>`;
    } else {
      const resHtml = _coldCheckCellHtml(r.result, c, resPh);
      const resAttrs = inline
        ? `class="cc-cell cc-cell-result cc-editable" data-cc-idx="${idx}" data-cc-field="result" onmousedown="onColdCheckCellMouseDown('${cid}', ${idx})" onclick="onRepairEditableClick(event, function(){ startColdCheckCellEdit('${cid}', ${idx}, 'result'); })"`
        : `class="cc-cell cc-cell-result"`;
      resultTdHtml = `<td class="cc-td-result"><div ${resAttrs}>${resHtml}</div></td>`;
    }

    const statusEl = inline
      ? `<button type="button" class="cc-status-btn ${meta.cls}" data-no-i18n="1" data-cc-status-idx="${idx}" onmousedown="event.preventDefault()" onclick="cycleColdCheckStatusInline('${cid}', ${idx}, event)" title="${isEn ? 'Click to cycle status (— / OK / Suspect / Fault)' : 'Chạm để đổi nhanh trạng thái (— / OK / Nghi ngờ / Hỏng)'}">${escapeHtml(meta.label)}</button>`
      : `<span class="cc-status-pill ${meta.cls}" data-no-i18n="1">${escapeHtml(meta.label)}</span>`;

    return `
      <tr class="cc-row cc-st-${st}" data-cc-idx="${idx}" data-cc-id="${escapeHtml(r.id || '')}">
        <td class="cc-td-item"><div ${itemAttrs}>${itemHtml}</div></td>
        ${resultTdHtml}
        <td class="cc-td-status">${statusEl}</td>
        ${inline ? `<td class="cc-td-act"><button type="button" class="cc-del-btn" onmousedown="event.preventDefault()" onclick="deleteColdCheckRowInline('${cid}', ${idx}, event)" title="${isEn ? 'Delete row' : 'Xóa dòng'}" aria-label="${isEn ? 'Delete row' : 'Xóa dòng'}">×</button></td>` : ''}
      </tr>`;
  }).join('');

  return `
    <div class="cold-check-card">
      <div class="cold-check-head">
        <div class="cc-head-left">
          <span>${isEn ? 'INTAKE &amp; COLD CHECK' : 'TIẾP NHẬN &amp; ĐO NGUỘI (COLD CHECK)'}</span>
          <span class="cc-count-meta" data-no-i18n="1">${_coldCheckCountMetaHtml(rows, isEn)}</span>
        </div>
        <span class="rep-head-acts">
          <span class="rep-save-st" data-save-st="cold"></span>
          ${inline ? `<button type="button" class="btn btn-sm rep-tpl-btn" onmousedown="event.preventDefault()" onclick="insertColdCheckTemplateInline('${cid}')">⚡ ${isEn ? 'Template' : 'Mẫu đo nguội'}</button>` : ''}
          ${inline ? `<button type="button" class="btn btn-sm cc-add-btn" onmousedown="event.preventDefault()" onclick="addColdCheckRowInline('${cid}', true)">+ ${isEn ? 'Add row' : 'Thêm dòng'}</button>` : ''}
        </span>
      </div>
      <div class="cc-table-wrap">
        <table class="cc-table">
          <colgroup>
            <col class="cc-col-item" />
            <col class="cc-col-result" />
            <col class="cc-col-status" />
            ${inline ? '<col class="cc-col-act" />' : ''}
          </colgroup>
          <thead>
            <tr>
              <th>${isEn ? 'COMPONENT / CHECKPOINT' : 'THÀNH PHẦN KIỂM TRA'}</th>
              <th>${isEn ? 'RESULT / MEASUREMENTS' : 'KẾT QUẢ / THÔNG SỐ ĐO'}</th>
              <th style="text-align:center;">${isEn ? 'STATUS' : 'TRẠNG THÁI'}</th>
              ${inline ? '<th></th>' : ''}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;
}

function renderRepairNoteBlockHtml(c, inline = true) {
  const cleanNote = String(c.note || '').trim();
  const cid = escapeHtml(c.id);
  if (!cleanNote) {
    if (!inline) return '';
    return `
      <div class="rep-collapsed-bar rep-note-bar">
        <button type="button" class="rep-collapsed-trigger" onclick="startRepairNoteEdit('${cid}')">+ Thêm lưu ý cấp nguồn test (24VDC / DC bus, chân jump, dòng boot...)</button>
      </div>`;
  }
  return `
    <div class="warn">
      <div class="warn-title">
        <span>LƯU Ý CẤP NGUỒN TEST &amp; CẤU HÌNH VẬN HÀNH</span>
        <span class="rep-head-acts">
          <span class="rep-save-st" data-save-st="note"></span>
        </span>
      </div>
      <div class="warn-body ${inline ? 'rep-editable' : ''}" data-rep-note-body="${cid}" ${inline ? `onclick="onRepairEditableClick(event, function(){ startRepairNoteEdit('${cid}'); })"` : ''}>${highlightTagsHtml(cleanNote, c.component_tags, c.fault_codes)}</div>
    </div>`;
}

function _repairBlockCellHtml(value, c, placeholder) {
  const cleanVal = String(value || '').trim();
  return cleanVal
    ? highlightTagsHtml(cleanVal, c?.component_tags, c?.fault_codes)
    : `<span class="none">${escapeHtml(placeholder || '')}</span>`;
}

function renderRepairBlocksSectionHtml(c, inline = true) {
  const isEn = _repairIsEnLang();
  const blocks = _getDisplayRepairBlocksForCase(c);
  const cid = escapeHtml(c.id);

  if (!blocks.length) {
    if (!inline) return '';
    return `
      <div class="rb-add-block-bar">
        <button type="button" class="rb-add-block-btn" onmousedown="event.preventDefault()" onclick="addRepairBlockInline('${cid}')">
          ${_rbSvgPlus()}
          <span>${isEn ? 'Add Section' : 'Thêm mục mới'}</span>
        </button>
      </div>`;
  }

  const labelPh = isEn ? 'Item / Test point...' : 'Hạng mục / Điểm đo...';
  const contentPh = isEn ? 'Details / Result...' : 'Nội dung / Kết quả đo...';
  const untitledPh = isEn ? 'Untitled section (click to edit)' : 'Chưa đặt tên mục (chạm để sửa)';

  const blocksHtml = blocks.map((blk, bi) => {
    const blkTitle = String(blk.title || '').trim();
    const blkDomKey = `rb-bilingual-${c.id}-${bi}`;
    const rows = Array.isArray(blk.rows) ? blk.rows : [];

    const rowsHtml = rows.length
      ? rows.map((r, ri) => {
          const lblHtml = _repairBlockCellHtml(r.label, c, labelPh);
          const cntHtml = _repairBlockCellHtml(r.content, c, contentPh);
          const lblAttrs = inline
            ? `class="rb-cell rb-cell-label rb-editable" data-rb-idx="${bi}" data-rb-row="${ri}" data-rb-field="label" onmousedown="onRepairBlockRowMouseDown('${cid}', ${bi}, ${ri})" onclick="onRepairEditableClick(event, function(){ startRepairBlockCellEdit('${cid}', ${bi}, ${ri}, 'label'); })"`
            : `class="rb-cell rb-cell-label"`;
          const cntAttrs = inline
            ? `class="rb-cell rb-cell-content rb-editable" data-rb-idx="${bi}" data-rb-row="${ri}" data-rb-field="content" onmousedown="onRepairBlockRowMouseDown('${cid}', ${bi}, ${ri})" onclick="onRepairEditableClick(event, function(){ startRepairBlockCellEdit('${cid}', ${bi}, ${ri}, 'content'); })"`
            : `class="rb-cell rb-cell-content"`;

          return `
            <tr class="rb-row" data-rb-idx="${bi}" data-rb-row="${ri}">
              <td class="rb-td-label">
                <div ${lblAttrs}>${lblHtml}</div>
                ${inline ? `<button type="button" class="rb-row-del-btn rb-row-del-mobile" onmousedown="event.preventDefault()" onclick="deleteRepairBlockRowInline('${cid}', ${bi}, ${ri}, event)" title="${isEn ? 'Delete row' : 'Xóa dòng'}" aria-label="${isEn ? 'Delete row' : 'Xóa dòng'}">${_rbSvgClose()}</button>` : ''}
              </td>
              <td class="rb-td-content"><div ${cntAttrs}>${cntHtml}</div></td>
              ${inline ? `<td class="rb-td-del"><button type="button" class="rb-row-del-btn" onmousedown="event.preventDefault()" onclick="deleteRepairBlockRowInline('${cid}', ${bi}, ${ri}, event)" title="${isEn ? 'Delete row' : 'Xóa dòng'}" aria-label="${isEn ? 'Delete row' : 'Xóa dòng'}">${_rbSvgClose()}</button></td>` : ''}
            </tr>`;
        }).join('')
      : (inline ? `
          <tr class="rb-empty-row">
            <td colspan="3">
              <button type="button" class="rb-empty-row-btn" onmousedown="event.preventDefault()" onclick="addRepairBlockRowInline('${cid}', ${bi})">
                ${_rbSvgPlus()}
                <span>${isEn ? 'Add first row...' : 'Chạm để thêm dòng đầu tiên...'}</span>
              </button>
            </td>
          </tr>` : '');

    const titleAttrs = inline
      ? `class="rb-title rb-editable" data-rb-title="${bi}" onmousedown="onRepairBlockElementMouseDown('${cid}', ${bi})" onclick="onRepairEditableClick(event, function(){ startRepairBlockTitleEdit('${cid}', ${bi}); })"`
      : `class="rb-title"`;

    return `
      <div class="rb-block" data-rb-idx="${bi}" data-rb-id="${escapeHtml(blk.id || '')}">
        <div class="rb-head">
          <div class="rb-title-host" data-rb-title-host="${bi}">
            <div ${titleAttrs}>${blkTitle ? escapeHtml(blkTitle) : `<span class="rb-title-empty">${escapeHtml(untitledPh)}</span>`}</div>
          </div>
          <div class="rb-head-acts">
            <span class="rep-save-st" data-save-st="rb-${bi}"></span>
            <button type="button" class="btn btn-sm rb-bi-btn" data-rb-bi-btn="${escapeHtml(blkDomKey)}" onmousedown="event.preventDefault()" onclick="toggleRepairBlockBilingual('${cid}', ${bi})" title="${isEn ? 'Translate this section VI ⇄ EN' : 'Đối chiếu Song ngữ Việt ⇄ Anh mục này'}">
              ${_rbSvgBilingual()}
              <span>${isEn ? 'Bilingual' : 'Song ngữ'}</span>
            </button>
            ${inline ? `<button type="button" class="btn btn-sm btn-primary rb-add-row-btn" onmousedown="event.preventDefault()" onclick="addRepairBlockRowInline('${cid}', ${bi})">${_rbSvgPlus()}<span>${isEn ? 'Add row' : 'Thêm dòng'}</span></button>` : ''}
            ${inline ? `<button type="button" class="btn btn-sm btn-danger rb-del-btn" onmousedown="event.preventDefault()" onclick="deleteRepairBlockInline('${cid}', ${bi})" title="${isEn ? 'Delete section' : 'Xóa mục này'}">${_rbSvgClose()}<span>${isEn ? 'Delete' : 'Xóa mục'}</span></button>` : ''}
          </div>
        </div>
        <div id="${escapeHtml(blkDomKey)}" class="bilingual-sec-wrap rb-bilingual hidden"></div>
        <div class="rb-table-wrap">
          <table class="rb-table">
            <colgroup>
              <col class="rb-col-label" />
              <col class="rb-col-content" />
              ${inline ? '<col class="rb-col-del" />' : ''}
            </colgroup>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="rb-list">${blocksHtml}</div>
    ${inline ? `
      <div class="rb-add-block-bar">
        <button type="button" class="rb-add-block-btn" onmousedown="event.preventDefault()" onclick="addRepairBlockInline('${cid}')">
          ${_rbSvgPlus()}
          <span>${isEn ? 'Add Section' : 'Thêm mục mới'}</span>
        </button>
      </div>` : ''}`;
}

function buildRepairDetailHtml(c, opts = {}) {
  const { showNav = true, currentIdx = 0, total = 1, showDropzone = true, pane = 'primary' } = opts;
  const inline = opts.inline !== undefined ? opts.inline : (pane !== 'secondary');
  const cid = escapeHtml(c.id);
  const coldHtml = renderRepairColdCheckBlockHtml(c, inline);
  const blocksHtml = renderRepairBlocksSectionHtml(c, inline);
  const noteHtml = renderRepairNoteBlockHtml(c, inline);

  return `
    <div class="detail-inner" data-repair-detail-id="${cid}">
      ${showNav ? renderFocusNavBar('repairs', currentIdx, total) : ''}
      <div class="d-head" data-ctx-record-kind="repair" data-ctx-record-id="${cid}">
        <div style="min-width:0; flex:1 1 320px;">
          <div class="d-meta">
            <span class="d-id">${cid}</span>
            <span>${escapeHtml(categoryLabel(c.device_category))}</span>
            <span>${escapeHtml(c.record_date || '----------')}</span>
            ${ledHtml(c.status_code)}
          </div>
          <div class="d-title-wrap" data-rep-title-wrap="${cid}">
            <div class="d-title ${inline ? 'rep-editable-title' : ''}" ${inline ? `onclick="onRepairEditableClick(event, function(){ startRepairTitleEdit('${cid}'); })"` : ''}>${escapeHtml(c.brand_model)}</div>
            <span class="rep-save-st" data-save-st="title"></span>
          </div>
          <div class="tags rep-tags-bar" data-rep-tags-bar="${cid}">${renderRepairInteractiveTagsHtml(c, inline)}</div>
        </div>
        <div class="d-controls">
          ${renderStatusSwitcher('repair', c.id, c.status_code)}
          <div class="d-btns">
            <button class="btn btn-sm" onclick="startDrillForItem('repair', '${cid}')" title="Ôn tập chuyên sâu các bước &amp; lưu ý của ca này">🎯 Ôn bài này</button>
            <button class="btn btn-sm" onclick="openRepairModal('${cid}')">Sửa</button>
            <button class="btn btn-sm btn-danger" onclick="deleteRecord('repair', '${cid}')">Xóa</button>
          </div>
        </div>
      </div>

      <div id="repair-bilingual-host-${cid}" class="bilingual-sec-wrap hidden"></div>

      ${coldHtml ? `<div class="sec rep-cold-host" data-rep-block="cold">${coldHtml}</div>` : ''}

      ${blocksHtml ? `<div class="sec rep-blocks-host" data-rep-block="blocks">${blocksHtml}</div>` : ''}

      ${noteHtml ? `<div class="sec rep-note-host" data-rep-block="note">${noteHtml}</div>` : ''}

      ${renderAttachmentSection('repair', c.id, c.attachments || [], showDropzone)}
    </div>`;
}

// ---------------------------------------------------------------------------
// Repair Case Inline Editing + Auto-Save Engine
// ---------------------------------------------------------------------------
function onRepairEditableClick(event, callback) {
  if (!event || !callback) return;
  if (event.target.closest(
    'button, a, input, textarea, select, .itag, .en-term-hl, .study-word, .vocab-hl, [data-copy], .code-copy-btn, .rep-inline-editor'
  )) return;
  const codeAncestor = event.target?.closest?.('code');
  if (codeAncestor && (codeAncestor.dataset.copy !== undefined || codeAncestor.querySelector('button, .copy-btn'))) return;
  const sel = typeof window.getSelection === 'function' ? window.getSelection() : null;
  if (sel && sel.toString().trim().length > 0) return;
  callback();
}

function _setRepairSaveStatus(statusKey, stateKind, text) {
  const root = document.getElementById('repair-detail');
  if (!root || !statusKey) return;
  const el = root.querySelector(`[data-save-st="${statusKey}"]`);
  if (!el) return;
  el.className = `rep-save-st ${stateKind || ''}`.trim();
  el.textContent = text || '';
  if (stateKind === 'saved') {
    const stamp = `${Date.now()}_${Math.random()}`;
    el.dataset.stStamp = stamp;
    setTimeout(() => {
      if (el.dataset.stStamp === stamp) {
        el.textContent = '';
        el.className = 'rep-save-st';
      }
    }, 1800);
  }
}

function _restoreTitleHost(hostEl, c) {
  if (!hostEl || !c) return;
  const cid = escapeHtml(c.id);
  delete hostEl.dataset.viHtmlOrig;
  delete hostEl.dataset.viTextOrig;
  hostEl.classList.remove('rep-inline-editing');
  hostEl.innerHTML = `
    <div class="d-title rep-editable-title" onclick="onRepairEditableClick(event, function(){ startRepairTitleEdit('${cid}'); })">${escapeHtml(c.brand_model)}</div>
    <span class="rep-save-st" data-save-st="title"></span>`;
}

function _restoreFieldHost(ed, c, overrideVal = null) {
  if (!ed || !c) return;
  const val = overrideVal !== null ? overrideVal : ed.origValue;
  if (ed.target === 'title') {
    _restoreTitleHost(ed.hostEl, { ...c, brand_model: val });
    return;
  }
  if (ed.target === 'cold-cell' && ed.hostEl) {
    const isEn = _repairIsEnLang();
    const ph = ed.field === 'item'
      ? (isEn ? 'Component...' : 'Thành phần...')
      : (isEn ? 'Measurement / Result...' : 'Kết quả / Thông số đo...');
    delete ed.hostEl.dataset.viHtmlOrig;
    delete ed.hostEl.dataset.viTextOrig;
    ed.hostEl.classList.remove('rep-inline-editing');
    ed.hostEl.classList.add('cc-editable');
    ed.hostEl.innerHTML = _coldCheckCellHtml(val, c, ph);
    return;
  }
  if (ed.target === 'note') {
    const noteHost = document.querySelector('#repair-detail .rep-note-host');
    if (noteHost) noteHost.innerHTML = renderRepairNoteBlockHtml({ ...c, note: val }, true);
    return;
  }
  if (ed.target === 'rb-title' && ed.hostEl) {
    const cid = escapeHtml(c.id);
    const bi = ed.blkIdx;
    const isEn = _repairIsEnLang();
    const untitledPh = isEn ? 'Untitled section (click to edit)' : 'Chưa đặt tên mục (chạm để sửa)';
    const cleanTitle = String(val || '').trim();
    delete ed.hostEl.dataset.viHtmlOrig;
    delete ed.hostEl.dataset.viTextOrig;
    ed.hostEl.classList.remove('rep-inline-editing');
    ed.hostEl.innerHTML = `<div class="rb-title rb-editable" data-rb-title="${bi}" onmousedown="onRepairBlockElementMouseDown('${cid}', ${bi})" onclick="onRepairEditableClick(event, function(){ startRepairBlockTitleEdit('${cid}', ${bi}); })">${cleanTitle ? escapeHtml(cleanTitle) : `<span class="rb-title-empty">${escapeHtml(untitledPh)}</span>`}</div>`;
    return;
  }
  if (ed.target === 'rb-cell' && ed.hostEl) {
    const isEn = _repairIsEnLang();
    const ph = ed.field === 'label'
      ? (isEn ? 'Item / Test point...' : 'Hạng mục / Điểm đo...')
      : (isEn ? 'Details / Result...' : 'Nội dung / Kết quả đo...');
    delete ed.hostEl.dataset.viHtmlOrig;
    delete ed.hostEl.dataset.viTextOrig;
    ed.hostEl.classList.remove('rep-inline-editing');
    ed.hostEl.classList.add('rb-editable');
    ed.hostEl.innerHTML = _repairBlockCellHtml(val, c, ph);
    return;
  }
  if (ed.target === 'step' && ed.hostEl) {
    delete ed.hostEl.dataset.viHtmlOrig;
    delete ed.hostEl.dataset.viTextOrig;
    ed.hostEl.classList.remove('rep-inline-editing');
    ed.hostEl.classList.add('rep-editable');
    ed.hostEl.innerHTML = _repairCellBodyHtml(val, c);
  }
}

function _mountRepairInlineEditor(hostEl, config) {
  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;

  delete hostEl.dataset.viHtmlOrig;
  delete hostEl.dataset.viTextOrig;
  hostEl.classList.remove('rep-editable');
  hostEl.classList.add('rep-inline-editing');

  hostEl.innerHTML = `
    <div class="rep-inline-editor">
      <textarea class="inp ${config.singleLine ? 'mono rep-inline-title-ta' : ''} rep-inline-ta" rows="${config.rows || 2}" spellcheck="false" placeholder="${escapeHtml(config.placeholder || '')}"></textarea>
    </div>`;

  const ta = hostEl.querySelector('.rep-inline-ta');
  ta.value = config.initialValue || '';
  _autoResizeRepairTextarea(ta, config.singleLine ? 38 : 72);
  ta.focus({ preventScroll: true });
  try {
    const len = ta.value.length;
    ta.setSelectionRange(len, len);
  } catch (_) {}

  ta.addEventListener('input', () => _autoResizeRepairTextarea(ta, config.singleLine ? 38 : 72));
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelActiveRepairInlineEdit();
      return;
    }
    if (((e.ctrlKey || e.metaKey) && e.key === 'Enter') || (config.singleLine && e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      e.stopPropagation();
      commitActiveRepairInlineEdit();
    }
  });
  ta.addEventListener('blur', () => {
    const ed = state.repairInlineEdit;
    if (!ed || ed.hostEl !== hostEl || ed.cancelling || ed.saving) return;
    commitActiveRepairInlineEdit();
  });

  if (pane) pane.scrollTop = savedScroll;
}

function onColdCheckCellMouseDown(caseId, rowIdx) {
  const ed = state.repairInlineEdit;
  if (ed && ed.target === 'cold-cell' && ed.caseId === caseId && ed.rowIdx === rowIdx) {
    ed._movingWithinRow = true;
  }
}

async function startColdCheckCellEdit(caseId, rowIdx, field) {
  const cur = state.repairInlineEdit;
  if (cur && cur.caseId === caseId && cur.target === 'cold-cell' && cur.rowIdx === rowIdx && cur.field === field) {
    return;
  }
  if (cur) {
    const keepBlankDraftRow = Boolean(
      cur.target === 'cold-cell' && cur.caseId === caseId && cur.rowIdx === rowIdx && cur.field !== field
    );
    await commitActiveRepairInlineEdit({ keepBlankDraftRow });
  }

  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const rows = _getDisplayColdRowsForCase(c);
  const row = rows[rowIdx];
  if (field === 'result' && row && _isCapRowJS(row)) {
    _focusCapGridFirstInput(caseId, rowIdx);
    return;
  }
  const hostEl = document.querySelector(`#repair-detail .cc-cell[data-cc-idx="${rowIdx}"][data-cc-field="${field}"]`);
  if (!row || !hostEl) return;

  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;
  const orig = String(row[field] || '');
  const isEn = _repairIsEnLang();

  delete hostEl.dataset.viHtmlOrig;
  delete hostEl.dataset.viTextOrig;
  hostEl.classList.remove('cc-editable');
  hostEl.classList.add('rep-inline-editing');

  state.repairInlineEdit = {
    caseId,
    target: 'cold-cell',
    stepIdx: -1,
    rowIdx,
    rowId: row.id || '',
    isDraft: Boolean(row._isDraft),
    field,
    origValue: orig,
    hostEl,
    saving: false,
    cancelling: false,
    _movingWithinRow: false,
    _handledKeyAction: false,
  };

  if (field === 'item') {
    const ph = isEn ? 'Component / Checkpoint...' : 'Thành phần kiểm tra...';
    hostEl.innerHTML = `<input type="text" class="inp cc-inline-inp" spellcheck="false" placeholder="${escapeHtml(ph)}" />`;
    const inp = hostEl.querySelector('.cc-inline-inp');
    inp.value = orig;
    inp.focus({ preventScroll: true });
    try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (_) {}

    inp.addEventListener('keydown', async (e) => {
      const ed = state.repairInlineEdit;
      if (!ed || ed.hostEl !== hostEl) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        ed._handledKeyAction = true;
        cancelActiveRepairInlineEdit();
        return;
      }
      if ((e.key === 'Tab' && !e.shiftKey) || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        ed._handledKeyAction = true;
        await commitActiveRepairInlineEdit({
          keepBlankDraftRow: true,
          nextCell: { caseId, rowIdx, field: 'result' },
        });
      }
    });
    inp.addEventListener('blur', () => {
      const ed = state.repairInlineEdit;
      if (!ed || ed.hostEl !== hostEl || ed.cancelling || ed.saving || ed._handledKeyAction) return;
      commitActiveRepairInlineEdit({ keepBlankDraftRow: Boolean(ed._movingWithinRow) });
    });
  } else {
    const ph = isEn
      ? 'Result / Measurements (Enter newline, Ctrl+Enter new row)...'
      : 'Kết quả / Thông số đo (Enter xuống dòng, Ctrl+Enter thêm dòng)...';
    hostEl.innerHTML = `<textarea class="inp cc-inline-ta" rows="1" spellcheck="false" placeholder="${escapeHtml(ph)}"></textarea>`;
    const ta = hostEl.querySelector('.cc-inline-ta');
    ta.value = orig;
    _autoResizeRepairTextarea(ta, 36);
    ta.focus({ preventScroll: true });
    try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (_) {}

    ta.addEventListener('input', () => _autoResizeRepairTextarea(ta, 36));
    ta.addEventListener('keydown', async (e) => {
      const ed = state.repairInlineEdit;
      if (!ed || ed.hostEl !== hostEl) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        ed._handledKeyAction = true;
        cancelActiveRepairInlineEdit();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        ed._handledKeyAction = true;
        await commitActiveRepairInlineEdit({
          addRowAfter: { caseId, afterIdx: rowIdx },
        });
      }
    });
    ta.addEventListener('blur', () => {
      const ed = state.repairInlineEdit;
      if (!ed || ed.hostEl !== hostEl || ed.cancelling || ed.saving || ed._handledKeyAction) return;
      commitActiveRepairInlineEdit({ keepBlankDraftRow: Boolean(ed._movingWithinRow) });
    });
  }

  if (pane) pane.scrollTop = savedScroll;
}

async function addColdCheckRowInline(caseId, autoFocus = true, insertAt = null) {
  if (state.repairInlineEdit) {
    await commitActiveRepairInlineEdit();
  }
  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;

  const savedRows = _resolveColdCheckRowsForCase(c);
  state.repairDraftColdRows[caseId] = state.repairDraftColdRows[caseId] || [];
  const draftId = `cc-draft-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const safeInsert = typeof insertAt === 'number' ? Math.max(0, Math.min(insertAt, savedRows.length)) : null;
  state.repairDraftColdRows[caseId].push({
    id: draftId,
    item: '',
    result: '',
    status: 'none',
    _isDraft: true,
    _insertAt: safeInsert,
  });

  const coldHost = document.querySelector('#repair-detail .rep-cold-host');
  if (coldHost) coldHost.innerHTML = renderRepairColdCheckBlockHtml(c, true);
  if (pane) pane.scrollTop = savedScroll;

  const displayRows = _getDisplayColdRowsForCase(c);
  const targetIdx = Math.max(0, displayRows.findIndex((r) => r.id === draftId));
  if (autoFocus) {
    await startColdCheckCellEdit(caseId, targetIdx, 'item');
  }
  if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

async function insertColdCheckTemplateInline(caseId) {
  if (state.repairInlineEdit) {
    await commitActiveRepairInlineEdit();
  }
  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const isEn = _repairIsEnLang();
  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;

  const curRows = _resolveColdCheckRowsForCase(c);
  const existingKeys = new Set(curRows.map((r) => String(r.item || '').trim().toLowerCase()).filter(Boolean));
  const toAdd = [];
  COLD_CHECK_TEMPLATE_ROWS.forEach((tpl, idx) => {
    const kVi = tpl.vi.toLowerCase();
    const kEn = tpl.en.toLowerCase();
    if (existingKeys.has(kVi) || existingKeys.has(kEn)) return;
    const label = isEn ? tpl.en : tpl.vi;
    existingKeys.add(label.toLowerCase());
    toAdd.push({
      id: `cc-${curRows.length + toAdd.length + 1}`,
      item: label,
      result: '',
      status: 'none',
    });
  });

  if (!toAdd.length) {
    showToast(isEn ? 'All standard cold check rows already exist' : 'Đã có đủ 6 hạng mục mẫu đo nguội', 'info');
    return;
  }

  const rollback = _cloneRepairBackup(c);
  const nextRows = [...curRows, ...toAdd].map((r, i) => _preserveColdRowForPayload(r, i));
  const firstNewIdx = curRows.length;

  c.cold_check_json = nextRows;
  c.cold_check_raw = _serializeColdCheckRowsJS(nextRows);
  const coldHost = document.querySelector('#repair-detail .rep-cold-host');
  if (coldHost) coldHost.innerHTML = renderRepairColdCheckBlockHtml(c, true);
  if (pane) pane.scrollTop = savedScroll;

  await startColdCheckCellEdit(caseId, firstNewIdx, 'result');
  patchRepairCaseInline(caseId, { cold_check_json: nextRows }, 'cold', { rollback });
}

async function cycleColdCheckStatusInline(caseId, rowIdx, event) {
  if (event) event.stopPropagation();
  const curEd = state.repairInlineEdit;
  if (curEd) {
    const keepSameRow = curEd.caseId === caseId && curEd.target === 'cold-cell' && curEd.rowIdx === rowIdx;
    await commitActiveRepairInlineEdit({ keepBlankDraftRow: keepSameRow });
  }
  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;

  const displayRows = _getDisplayColdRowsForCase(c);
  const target = displayRows[rowIdx];
  if (!target) return;

  const curMeta = _coldCheckStatusMeta(target.status);
  const nextStatus = curMeta.next;

  if (target._isDraft && !String(target.item || '').trim() && !String(target.result || '').trim()) {
    const dList = state.repairDraftColdRows[caseId] || [];
    const d = dList.find((x) => x.id === target.id);
    if (d) d.status = nextStatus;
    const coldHost = document.querySelector('#repair-detail .rep-cold-host');
    if (coldHost) coldHost.innerHTML = renderRepairColdCheckBlockHtml(c, true);
    if (pane) pane.scrollTop = savedScroll;
    return;
  }

  const rollback = _cloneRepairBackup(c);
  const nextRows = displayRows
    .map((r, i) => ({
      ...r,
      status: i === rowIdx ? nextStatus : (r.status || 'none'),
    }))
    .filter((r) => String(r.item || '').trim() || String(r.result || '').trim() || (Array.isArray(r.caps) && r.caps.length > 0))
    .map((r, i) => _preserveColdRowForPayload(r, i));

  if (state.repairDraftColdRows && state.repairDraftColdRows[caseId]) {
    delete state.repairDraftColdRows[caseId];
  }
  c.cold_check_json = nextRows;
  c.cold_check_raw = _serializeColdCheckRowsJS(nextRows);

  const coldHost = document.querySelector('#repair-detail .rep-cold-host');
  if (coldHost) coldHost.innerHTML = renderRepairColdCheckBlockHtml(c, true);
  if (pane) pane.scrollTop = savedScroll;

  await patchRepairCaseInline(caseId, { cold_check_json: nextRows }, 'cold', { rollback });
}

async function deleteColdCheckRowInline(caseId, rowIdx, event) {
  if (event) event.stopPropagation();
  const curEd = state.repairInlineEdit;
  if (curEd && curEd.caseId === caseId && curEd.target === 'cold-cell' && curEd.rowIdx === rowIdx) {
    curEd.cancelling = true;
    state.repairInlineEdit = null;
  } else if (curEd) {
    await commitActiveRepairInlineEdit();
  }

  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;
  const isEn = _repairIsEnLang();

  const displayRows = _getDisplayColdRowsForCase(c);
  const target = displayRows[rowIdx];
  if (!target) return;

  if (target._isDraft) {
    const dList = state.repairDraftColdRows[caseId] || [];
    const dIdx = dList.findIndex((x) => x.id === target.id);
    if (dIdx >= 0) dList.splice(dIdx, 1);
    if (!dList.length) delete state.repairDraftColdRows[caseId];
    const coldHost = document.querySelector('#repair-detail .rep-cold-host');
    if (coldHost) coldHost.innerHTML = renderRepairColdCheckBlockHtml(c, true);
    if (pane) pane.scrollTop = savedScroll;
    if (isEn && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
    return;
  }

  const rollback = _cloneRepairBackup(c);
  const nextRows = displayRows
    .filter((_, i) => i !== rowIdx)
    .filter((r) => !r._isDraft && (String(r.item || '').trim() || String(r.result || '').trim() || (Array.isArray(r.caps) && r.caps.length > 0)))
    .map((r, i) => _preserveColdRowForPayload(r, i));

  if (state.repairDraftColdRows && state.repairDraftColdRows[caseId]) {
    delete state.repairDraftColdRows[caseId];
  }
  c.cold_check_json = nextRows;
  c.cold_check_raw = _serializeColdCheckRowsJS(nextRows);

  const coldHost = document.querySelector('#repair-detail .rep-cold-host');
  if (coldHost) coldHost.innerHTML = renderRepairColdCheckBlockHtml(c, true);
  if (pane) pane.scrollTop = savedScroll;

  await patchRepairCaseInline(caseId, { cold_check_json: nextRows }, 'cold', { rollback });
  showToast(isEn ? 'Removed cold check row' : 'Đã xóa dòng đo nguội', 'success');
}

function _readCapGridFromDom(rowIdx) {
  const grid = document.querySelector(`#repair-detail .cc-cap-grid[data-cc-idx="${rowIdx}"]`);
  if (!grid) return null;
  const rows = [];
  grid.querySelectorAll('.cc-cap-row').forEach((el, idx) => {
    const spec = String(el.querySelector('.cc-cap-spec')?.value || '').trim();
    const capVal = String(el.querySelector('.cc-cap-val')?.value || '').trim();
    const unitBtn = el.querySelector('.cc-cap-unit-btn');
    const capUnit = String(unitBtn?.dataset?.capUnit || unitBtn?.textContent || 'µF').trim() || 'µF';
    const esrVal = String(el.querySelector('.cc-cap-esr')?.value || '').trim();
    const note = String(el.querySelector('.cc-cap-note')?.value || '').trim();
    const rawId = String(el.dataset.capId || '').trim();
    if (!spec && !capVal && !esrVal && !note) return;
    rows.push({
      id: rawId || `cap-${rows.length + 1}`,
      spec,
      cap_val: capVal,
      cap_unit: window.MRLCoreStore?.normalizeCapUnit ? window.MRLCoreStore.normalizeCapUnit(capUnit) : capUnit,
      esr_val: esrVal,
      note,
    });
  });
  return rows.map((r, i) => ({ ...r, id: `cap-${i + 1}` }));
}

function _capArraysEqual(a, b) {
  const na = (a || []).map((x) => ({
    spec: String(x.spec || '').trim(),
    cap_val: String(x.cap_val || '').trim(),
    cap_unit: String(x.cap_unit || 'µF').trim() || 'µF',
    esr_val: String(x.esr_val || '').trim(),
    note: String(x.note || '').trim(),
  }));
  const nb = (b || []).map((x) => ({
    spec: String(x.spec || '').trim(),
    cap_val: String(x.cap_val || '').trim(),
    cap_unit: String(x.cap_unit || 'µF').trim() || 'µF',
    esr_val: String(x.esr_val || '').trim(),
    note: String(x.note || '').trim(),
  }));
  return JSON.stringify(na) === JSON.stringify(nb);
}

async function _commitCapGridForRow(caseId, rowIdx, opts = {}) {
  const c = _getRepairCaseById(caseId);
  if (!c) return false;
  const domCaps = _readCapGridFromDom(rowIdx);
  if (domCaps === null) return false;

  const displayRows = _getDisplayColdRowsForCase(c);
  const targetRow = displayRows[rowIdx];
  if (!targetRow) return false;
  const prevCaps = _getCapsForRow(targetRow);
  if (!opts.force && _capArraysEqual(domCaps, prevCaps)) {
    return false;
  }

  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;
  const rollback = _cloneRepairBackup(c);

  const syncedResult = _serializeCapsJS(domCaps);
  const nextRows = displayRows
    .map((r, i) => {
      if (i !== rowIdx) return _preserveColdRowForPayload(r, i);
      return {
        ..._preserveColdRowForPayload(r, i),
        caps: domCaps,
        result: syncedResult,
      };
    })
    .filter((r) => String(r.item || '').trim() || String(r.result || '').trim() || (Array.isArray(r.caps) && r.caps.length > 0))
    .map((r, i) => _preserveColdRowForPayload(r, i));

  if (state.repairDraftColdRows && state.repairDraftColdRows[caseId]) {
    delete state.repairDraftColdRows[caseId];
  }
  c.cold_check_json = nextRows;
  c.cold_check_raw = _serializeColdCheckRowsJS(nextRows);

  if (opts.reRenderGrid) {
    const cellHost = document.querySelector(`#repair-detail .cc-cell-caps[data-cc-idx="${rowIdx}"] .cc-cap-grid`);
    if (cellHost) {
      const cid = escapeHtml(caseId);
      const isEn = _repairIsEnLang();
      cellHost.innerHTML = domCaps.map((cap, ci) => _renderCapGridRowHtml(cid, rowIdx, cap, ci, true, isEn)).join('');
    }
  }
  if (pane) pane.scrollTop = savedScroll;

  await patchRepairCaseInline(
    caseId,
    { cold_check_json: nextRows },
    'cold',
    { rollback, skipColdCapRerender: true }
  );
  return true;
}

function addCapRowInline(caseId, rowIdx, insertAfterIdx = null, autoFocus = true) {
  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;
  const grid = document.querySelector(`#repair-detail .cc-cap-grid[data-cc-idx="${rowIdx}"]`);
  if (!grid) return;

  const cid = escapeHtml(caseId);
  const isEn = _repairIsEnLang();
  const existingRows = Array.from(grid.querySelectorAll('.cc-cap-row'));
  const nextCapIdx = typeof insertAfterIdx === 'number'
    ? Math.max(0, Math.min(insertAfterIdx + 1, existingRows.length))
    : existingRows.length;

  const blankCap = { id: `cap-${existingRows.length + 1}`, spec: '', cap_val: '', cap_unit: 'µF', esr_val: '', note: '' };
  const tmp = document.createElement('div');
  tmp.innerHTML = _renderCapGridRowHtml(cid, rowIdx, blankCap, nextCapIdx, true, isEn).trim();
  const newEl = tmp.firstElementChild;
  if (!newEl) return;

  if (nextCapIdx < existingRows.length) {
    grid.insertBefore(newEl, existingRows[nextCapIdx]);
  } else {
    grid.appendChild(newEl);
  }
  _reindexCapDomRows(grid, caseId, rowIdx);

  if (pane) pane.scrollTop = savedScroll;
  if (autoFocus) {
    const specInp = newEl.querySelector('.cc-cap-spec');
    if (specInp) {
      specInp.focus({ preventScroll: true });
      if (pane) pane.scrollTop = savedScroll;
    }
  }
}

function _reindexCapDomRows(grid, caseId, ccIdx) {
  if (!grid) return;
  const cid = escapeHtml(caseId);
  grid.querySelectorAll('.cc-cap-row').forEach((rowEl, ci) => {
    rowEl.dataset.capIdx = String(ci);
    rowEl.querySelector('.cc-cap-spec')?.setAttribute('onkeydown', `onCapInputKeydown(event, '${cid}', ${ccIdx}, ${ci}, 'spec')`);
    rowEl.querySelector('.cc-cap-val')?.setAttribute('onkeydown', `onCapInputKeydown(event, '${cid}', ${ccIdx}, ${ci}, 'cap_val')`);
    rowEl.querySelector('.cc-cap-esr')?.setAttribute('onkeydown', `onCapInputKeydown(event, '${cid}', ${ccIdx}, ${ci}, 'esr_val')`);
    rowEl.querySelector('.cc-cap-note')?.setAttribute('onkeydown', `onCapInputKeydown(event, '${cid}', ${ccIdx}, ${ci}, 'note')`);
    rowEl.querySelector('.cc-cap-unit-btn')?.setAttribute('onclick', `cycleCapRowUnitInline('${cid}', ${ccIdx}, ${ci}, this, event)`);
    rowEl.querySelector('.cc-cap-del-btn')?.setAttribute('onclick', `deleteCapRowInline('${cid}', ${ccIdx}, ${ci}, event)`);
  });
}

async function cycleCapRowUnitInline(caseId, rowIdx, capIdx, btnEl, event) {
  if (event) event.stopPropagation();
  const units = ['µF', 'mF', 'nF'];
  const cur = String(btnEl?.dataset?.capUnit || btnEl?.textContent || 'µF').trim();
  const curPos = Math.max(0, units.indexOf(cur));
  const next = units[(curPos + 1) % units.length];
  if (btnEl) {
    btnEl.dataset.capUnit = next;
    btnEl.textContent = next;
  }
  await _commitCapGridForRow(caseId, rowIdx, { force: true });
}

async function deleteCapRowInline(caseId, rowIdx, capIdx, event) {
  if (event) event.stopPropagation();
  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;
  const grid = document.querySelector(`#repair-detail .cc-cap-grid[data-cc-idx="${rowIdx}"]`);
  if (!grid) return;
  const rows = Array.from(grid.querySelectorAll('.cc-cap-row'));
  const targetEl = rows[capIdx];
  if (targetEl) targetEl.remove();
  _reindexCapDomRows(grid, caseId, rowIdx);
  if (pane) pane.scrollTop = savedScroll;
  await _commitCapGridForRow(caseId, rowIdx, { force: true, reRenderGrid: true });
}

async function onCapInputKeydown(event, caseId, rowIdx, capIdx, field) {
  if (!event) return;
  if (event.key === 'Escape') {
    event.stopPropagation();
    event.target?.blur();
    return;
  }
  if (event.key === 'Enter' && (field === 'esr_val' || field === 'note')) {
    event.preventDefault();
    event.stopPropagation();
    const curRowEl = event.target?.closest('.cc-cap-row');
    const grid = curRowEl?.closest('.cc-cap-grid');
    const actualCapIdx = grid ? Array.from(grid.querySelectorAll('.cc-cap-row')).indexOf(curRowEl) : capIdx;
    const commitPromise = _commitCapGridForRow(caseId, rowIdx);
    addCapRowInline(caseId, rowIdx, actualCapIdx, true);
    await commitPromise;
  }
}

function onCapInputBlur(event, caseId, rowIdx) {
  setTimeout(() => {
    const active = document.activeElement;
    const curGrid = document.querySelector(`#repair-detail .cc-cap-grid[data-cc-idx="${rowIdx}"]`);
    if (!curGrid) return;
    // Always auto-save changes smoothly without losing focus/scroll
    _commitCapGridForRow(caseId, rowIdx);
  }, 15);
}

function _focusCapGridFirstInput(caseId, rowIdx) {
  const grid = document.querySelector(`#repair-detail .cc-cap-grid[data-cc-idx="${rowIdx}"]`);
  if (!grid) return false;
  const firstSpec = grid.querySelector('.cc-cap-row .cc-cap-spec');
  if (firstSpec) {
    firstSpec.focus({ preventScroll: true });
    return true;
  }
  addCapRowInline(caseId, rowIdx, null, true);
  return true;
}

async function startRepairTitleEdit(caseId) {
  const cur = state.repairInlineEdit;
  if (cur && cur.caseId === caseId && cur.target === 'title') return;
  if (cur) await commitActiveRepairInlineEdit();
  const c = _getRepairCaseById(caseId);
  const hostEl = document.querySelector(`#repair-detail [data-rep-title-wrap="${CSS.escape(caseId)}"]`);
  if (!c || !hostEl) return;
  const orig = c.brand_model || '';
  state.repairInlineEdit = { caseId, target: 'title', stepIdx: -1, field: 'brand_model', origValue: orig, hostEl, saving: false, cancelling: false };
  _mountRepairInlineEditor(hostEl, {
    target: 'title',
    singleLine: true,
    rows: 1,
    initialValue: orig,
    placeholder: _repairIsEnLang() ? 'Brand & Model...' : 'Hãng & Mã thiết bị...',
  });
}

async function startRepairNoteEdit(caseId) {
  const cur = state.repairInlineEdit;
  if (cur && cur.caseId === caseId && cur.target === 'note') return;
  if (cur) await commitActiveRepairInlineEdit();
  const c = _getRepairCaseById(caseId);
  const noteHost = document.querySelector('#repair-detail .rep-note-host');
  if (!c || !noteHost) return;
  const orig = c.note || '';
  if (!orig.trim()) {
    noteHost.innerHTML = `
      <div class="warn">
        <div class="warn-title">
          <span>${_repairIsEnLang() ? 'BENCH POWER-UP &amp; OPERATING NOTES' : 'LƯU Ý CẤP NGUỒN TEST &amp; CẤU HÌNH VẬN HÀNH'}</span>
          <span class="rep-head-acts"><span class="rep-save-st" data-save-st="note"></span></span>
        </div>
        <div class="warn-body" data-rep-note-body="${escapeHtml(c.id)}"></div>
      </div>`;
  }
  const bodyEl = noteHost.querySelector(`[data-rep-note-body="${CSS.escape(caseId)}"]`);
  if (!bodyEl) return;
  state.repairInlineEdit = { caseId, target: 'note', stepIdx: -1, field: 'note', origValue: orig, hostEl: bodyEl, saving: false, cancelling: false };
  _mountRepairInlineEditor(bodyEl, {
    target: 'note',
    rows: 3,
    initialValue: orig,
    placeholder: _repairIsEnLang()
      ? 'Bench power-up notes (24VDC / DC bus, jumper pins, boot current, key parameters...)'
      : 'Lưu ý cấp nguồn test (24VDC / DC bus, chân jump kích chạy, dòng boot, thông số...)',
  });
}

function onRepairBlockElementMouseDown(caseId, blkIdx) {
  const ed = state.repairInlineEdit;
  if (ed && ed.caseId === caseId && (ed.target === 'rb-title' || ed.target === 'rb-cell') && ed.blkIdx === blkIdx) {
    ed._movingWithinBlock = true;
  }
}

function onRepairBlockRowMouseDown(caseId, blkIdx, rowIdx) {
  const ed = state.repairInlineEdit;
  if (ed && ed.caseId === caseId && (ed.target === 'rb-title' || ed.target === 'rb-cell') && ed.blkIdx === blkIdx) {
    ed._movingWithinBlock = true;
    if (ed.target === 'rb-cell' && ed.rowIdx === rowIdx) {
      ed._movingWithinRow = true;
    }
  }
}

function _removeDraftRepairBlock(caseId, blkId) {
  const caseDraft = state.repairDraftBlocks?.[caseId];
  if (!caseDraft || !Array.isArray(caseDraft.blocks)) return false;
  const idx = caseDraft.blocks.findIndex((b) => b.id === blkId);
  if (idx < 0) return false;
  caseDraft.blocks.splice(idx, 1);
  if (!caseDraft.blocks.length && (!caseDraft.rows || !Object.keys(caseDraft.rows).length)) {
    delete state.repairDraftBlocks[caseId];
  }
  return true;
}

function _removeDraftRepairRow(caseId, blkId, blkIsDraft, rowId) {
  const caseDraft = state.repairDraftBlocks?.[caseId];
  if (!caseDraft) return false;
  if (blkIsDraft && Array.isArray(caseDraft.blocks)) {
    const blk = caseDraft.blocks.find((b) => b.id === blkId);
    if (!blk) return false;
    const rIdx = (blk.rows || []).findIndex((r) => r.id === rowId);
    if (rIdx >= 0) blk.rows.splice(rIdx, 1);
    const hasTitle = Boolean(String(blk.title || '').trim());
    const hasRows = (blk.rows || []).some((r) => String(r.label || '').trim() || String(r.content || '').trim());
    if (!hasTitle && !hasRows && (!blk.rows || !blk.rows.length)) {
      _removeDraftRepairBlock(caseId, blkId);
    }
    return true;
  }
  if (caseDraft.rows && Array.isArray(caseDraft.rows[blkId])) {
    const arr = caseDraft.rows[blkId];
    const rIdx = arr.findIndex((r) => r.id === rowId);
    if (rIdx >= 0) {
      arr.splice(rIdx, 1);
      if (!arr.length) delete caseDraft.rows[blkId];
      if (!caseDraft.blocks?.length && !Object.keys(caseDraft.rows).length) {
        delete state.repairDraftBlocks[caseId];
      }
      return true;
    }
  }
  return false;
}

function _normalizeBlocksForSaveWithTracking(displayBlocks, trackBlkIdx = -1, trackRowIdx = -1, patcher = null) {
  const normalized = [];
  let savedBlkIdx = -1;
  let savedRowIdx = -1;
  displayBlocks.forEach((b, bi) => {
    const srcBlk = patcher ? patcher(b, bi) : b;
    const title = String(srcBlk.title || '').trim();
    const rawRows = Array.isArray(srcBlk.rows) ? srcBlk.rows : [];
    const normRows = [];
    let trackedRowHere = -1;
    rawRows.forEach((r, ri) => {
      const label = String(r.label || '').trim();
      const content = String(r.content || '').trim();
      if (!label && !content) return;
      let rid = String(r.id || '').trim();
      if (!rid || rid.startsWith('row-draft-')) {
        rid = `row-${normRows.length + 1}`;
      }
      if (bi === trackBlkIdx && ri === trackRowIdx) {
        trackedRowHere = normRows.length;
      }
      normRows.push({ id: rid, label, content });
    });
    if (!title && !normRows.length) return;
    let bid = String(srcBlk.id || '').trim();
    if (!bid || bid.startsWith('blk-draft-')) {
      bid = `blk-${normalized.length + 1}`;
    }
    if (bi === trackBlkIdx) {
      savedBlkIdx = normalized.length;
      savedRowIdx = trackedRowHere;
    }
    normalized.push({ id: bid, title, rows: normRows });
  });
  return { blocks: normalized, savedBlkIdx, savedRowIdx };
}

async function startRepairBlockTitleEdit(caseId, blkIdx) {
  const cur = state.repairInlineEdit;
  if (cur && cur.caseId === caseId && cur.target === 'rb-title' && cur.blkIdx === blkIdx) return;
  if (cur) {
    const keepSameBlock = Boolean(cur.caseId === caseId && (cur.target === 'rb-title' || cur.target === 'rb-cell') && cur.blkIdx === blkIdx);
    await commitActiveRepairInlineEdit({ keepBlankDraft: keepSameBlock, keepBlankDraftRow: keepSameBlock });
  }

  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const blocks = _getDisplayRepairBlocksForCase(c);
  const blk = blocks[blkIdx];
  const hostEl = document.querySelector(`#repair-detail .rb-block[data-rb-idx="${blkIdx}"] .rb-title-host`);
  if (!blk || !hostEl) return;

  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;
  const orig = String(blk.title || '');
  const isEn = _repairIsEnLang();
  const ph = isEn
    ? 'Section title (e.g. SMPS & DC BUS TEST)...'
    : 'Tên mục lớn (VD: TEST NGUỒN XUNG & CẤP DC BUS)...';

  delete hostEl.dataset.viHtmlOrig;
  delete hostEl.dataset.viTextOrig;
  hostEl.classList.add('rep-inline-editing');

  state.repairInlineEdit = {
    caseId,
    target: 'rb-title',
    stepIdx: -1,
    blkIdx,
    blkId: blk.id || '',
    isDraftBlock: Boolean(blk._isDraft),
    field: 'title',
    origValue: orig,
    hostEl,
    saving: false,
    cancelling: false,
    _movingWithinBlock: false,
    _movingWithinRow: false,
    _handledKeyAction: false,
  };

  hostEl.innerHTML = `<input type="text" class="inp rb-title-inp" spellcheck="false" placeholder="${escapeHtml(ph)}" />`;
  const inp = hostEl.querySelector('.rb-title-inp');
  inp.value = orig;
  inp.focus({ preventScroll: true });
  try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (_) {}

  inp.addEventListener('keydown', async (e) => {
    const ed = state.repairInlineEdit;
    if (!ed || ed.hostEl !== hostEl) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      ed._handledKeyAction = true;
      cancelActiveRepairInlineEdit();
      return;
    }
    if ((e.key === 'Tab' && !e.shiftKey) || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      e.stopPropagation();
      ed._handledKeyAction = true;
      await commitActiveRepairInlineEdit({
        keepBlankDraft: true,
        jumpToFirstRow: { caseId, blkIdx },
      });
    }
  });
  inp.addEventListener('blur', () => {
    const ed = state.repairInlineEdit;
    if (!ed || ed.hostEl !== hostEl || ed.cancelling || ed.saving || ed._handledKeyAction) return;
    commitActiveRepairInlineEdit({ keepBlankDraft: Boolean(ed._movingWithinBlock) });
  });

  if (pane) pane.scrollTop = savedScroll;
}

async function startRepairBlockCellEdit(caseId, blkIdx, rowIdx, field) {
  const cur = state.repairInlineEdit;
  if (cur && cur.caseId === caseId && cur.target === 'rb-cell' && cur.blkIdx === blkIdx && cur.rowIdx === rowIdx && cur.field === field) {
    return;
  }
  if (cur) {
    const sameRow = Boolean(cur.caseId === caseId && cur.target === 'rb-cell' && cur.blkIdx === blkIdx && cur.rowIdx === rowIdx && cur.field !== field);
    const sameBlock = Boolean(cur.caseId === caseId && (cur.target === 'rb-title' || cur.target === 'rb-cell') && cur.blkIdx === blkIdx);
    await commitActiveRepairInlineEdit({ keepBlankDraftRow: sameRow || sameBlock, keepBlankDraft: sameBlock });
  }

  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const blocks = _getDisplayRepairBlocksForCase(c);
  const blk = blocks[blkIdx];
  const row = blk?.rows?.[rowIdx];
  const hostEl = document.querySelector(`#repair-detail .rb-cell[data-rb-idx="${blkIdx}"][data-rb-row="${rowIdx}"][data-rb-field="${field}"]`);
  if (!blk || !row || !hostEl) return;

  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;
  const orig = String(row[field] || '');
  const isEn = _repairIsEnLang();

  delete hostEl.dataset.viHtmlOrig;
  delete hostEl.dataset.viTextOrig;
  hostEl.classList.remove('rb-editable');
  hostEl.classList.add('rep-inline-editing');

  state.repairInlineEdit = {
    caseId,
    target: 'rb-cell',
    stepIdx: -1,
    blkIdx,
    blkId: blk.id || '',
    isDraftBlock: Boolean(blk._isDraft),
    rowIdx,
    rowId: row.id || '',
    isDraft: Boolean(row._isDraft),
    field,
    origValue: orig,
    hostEl,
    saving: false,
    cancelling: false,
    _movingWithinBlock: false,
    _movingWithinRow: false,
    _handledKeyAction: false,
  };

  if (field === 'label') {
    const ph = isEn ? 'Item / Test point...' : 'Hạng mục / Điểm đo...';
    hostEl.innerHTML = `<input type="text" class="inp rb-inline-inp" spellcheck="false" placeholder="${escapeHtml(ph)}" />`;
    const inp = hostEl.querySelector('.rb-inline-inp');
    inp.value = orig;
    inp.focus({ preventScroll: true });
    try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (_) {}

    inp.addEventListener('keydown', async (e) => {
      const ed = state.repairInlineEdit;
      if (!ed || ed.hostEl !== hostEl) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        ed._handledKeyAction = true;
        cancelActiveRepairInlineEdit();
        return;
      }
      if ((e.key === 'Tab' && !e.shiftKey) || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        ed._handledKeyAction = true;
        await commitActiveRepairInlineEdit({
          keepBlankDraftRow: true,
          keepBlankDraft: true,
          nextCell: { caseId, blkIdx, rowIdx, field: 'content' },
        });
      }
    });
    inp.addEventListener('blur', () => {
      const ed = state.repairInlineEdit;
      if (!ed || ed.hostEl !== hostEl || ed.cancelling || ed.saving || ed._handledKeyAction) return;
      commitActiveRepairInlineEdit({
        keepBlankDraftRow: Boolean(ed._movingWithinRow || ed._movingWithinBlock),
        keepBlankDraft: Boolean(ed._movingWithinBlock),
      });
    });
  } else {
    const ph = isEn
      ? 'Content / Measurements (Enter newline, Ctrl+Enter add row)...'
      : 'Nội dung / Kết quả (Enter xuống dòng, Ctrl+Enter thêm dòng)...';
    hostEl.innerHTML = `<textarea class="inp rb-inline-ta" rows="2" spellcheck="false" placeholder="${escapeHtml(ph)}"></textarea>`;
    const ta = hostEl.querySelector('.rb-inline-ta');
    ta.value = orig;
    _autoResizeRepairTextarea(ta, 42);
    ta.focus({ preventScroll: true });
    try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (_) {}

    ta.addEventListener('input', () => _autoResizeRepairTextarea(ta, 42));
    ta.addEventListener('keydown', async (e) => {
      const ed = state.repairInlineEdit;
      if (!ed || ed.hostEl !== hostEl) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        ed._handledKeyAction = true;
        cancelActiveRepairInlineEdit();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        ed._handledKeyAction = true;
        await commitActiveRepairInlineEdit({
          addRowAfter: { caseId, blkIdx, afterIdx: rowIdx },
        });
      }
    });
    ta.addEventListener('blur', () => {
      const ed = state.repairInlineEdit;
      if (!ed || ed.hostEl !== hostEl || ed.cancelling || ed.saving || ed._handledKeyAction) return;
      commitActiveRepairInlineEdit({
        keepBlankDraftRow: Boolean(ed._movingWithinRow || ed._movingWithinBlock),
        keepBlankDraft: Boolean(ed._movingWithinBlock),
      });
    });
  }

  if (pane) pane.scrollTop = savedScroll;
}

async function addRepairBlockInline(caseId) {
  if (state.repairInlineEdit) {
    await commitActiveRepairInlineEdit();
  }
  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;

  state.repairDraftBlocks[caseId] = state.repairDraftBlocks[caseId] || { blocks: [], rows: {} };
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const draftBlkId = `blk-draft-${stamp}`;
  const draftRowId = `row-draft-${stamp}`;
  state.repairDraftBlocks[caseId].blocks.push({
    id: draftBlkId,
    title: '',
    rows: [{ id: draftRowId, label: '', content: '', _isDraft: true }],
    _isDraft: true,
  });

  const blocksHost = document.querySelector('#repair-detail .rep-blocks-host');
  if (blocksHost) blocksHost.innerHTML = renderRepairBlocksSectionHtml(c, true);
  if (pane) pane.scrollTop = savedScroll;

  const displayBlocks = _getDisplayRepairBlocksForCase(c);
  const targetIdx = Math.max(0, displayBlocks.findIndex((b) => b.id === draftBlkId));
  await startRepairBlockTitleEdit(caseId, targetIdx);
  const blkEl = document.querySelector(`#repair-detail .rb-block[data-rb-idx="${targetIdx}"]`);
  if (blkEl && typeof blkEl.scrollIntoView === 'function') {
    blkEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

async function addRepairBlockRowInline(caseId, blkIdx, autoFocus = true, insertAt = null) {
  if (state.repairInlineEdit) {
    const ed = state.repairInlineEdit;
    const sameBlock = Boolean(ed.caseId === caseId && (ed.target === 'rb-title' || ed.target === 'rb-cell') && ed.blkIdx === blkIdx);
    await commitActiveRepairInlineEdit({ keepBlankDraft: sameBlock });
  }
  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;

  const displayBlocks = _getDisplayRepairBlocksForCase(c);
  const blk = displayBlocks[blkIdx];
  if (!blk) return;

  const draftRowId = `row-draft-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  let targetRowIdx = 0;

  state.repairDraftBlocks[caseId] = state.repairDraftBlocks[caseId] || { blocks: [], rows: {} };
  if (blk._isDraft) {
    const dBlk = (state.repairDraftBlocks[caseId].blocks || []).find((b) => b.id === blk.id);
    if (dBlk) {
      dBlk.rows = dBlk.rows || [];
      const pos = typeof insertAt === 'number' ? Math.max(0, Math.min(insertAt, dBlk.rows.length)) : dBlk.rows.length;
      dBlk.rows.splice(pos, 0, { id: draftRowId, label: '', content: '', _isDraft: true });
      targetRowIdx = pos;
    }
  } else {
    state.repairDraftBlocks[caseId].rows = state.repairDraftBlocks[caseId].rows || {};
    state.repairDraftBlocks[caseId].rows[blk.id] = state.repairDraftBlocks[caseId].rows[blk.id] || [];
    const savedRowsLen = (_resolveRepairBlocksForCase(c).find((x) => x.id === blk.id)?.rows || []).length;
    const safeInsert = typeof insertAt === 'number' ? Math.max(0, Math.min(insertAt, savedRowsLen)) : null;
    state.repairDraftBlocks[caseId].rows[blk.id].push({
      id: draftRowId,
      label: '',
      content: '',
      _isDraft: true,
      _insertAt: safeInsert,
    });
  }

  const blocksHost = document.querySelector('#repair-detail .rep-blocks-host');
  if (blocksHost) blocksHost.innerHTML = renderRepairBlocksSectionHtml(c, true);
  if (pane) pane.scrollTop = savedScroll;

  if (!blk._isDraft) {
    const nextDisplay = _getDisplayRepairBlocksForCase(c);
    const nBlk = nextDisplay[blkIdx];
    targetRowIdx = Math.max(0, (nBlk?.rows || []).findIndex((r) => r.id === draftRowId));
  }
  if (autoFocus) {
    await startRepairBlockCellEdit(caseId, blkIdx, targetRowIdx, 'label');
  }
  if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

async function deleteRepairBlockRowInline(caseId, blkIdx, rowIdx, event) {
  if (event) event.stopPropagation();
  const curEd = state.repairInlineEdit;
  if (curEd && curEd.caseId === caseId && curEd.target === 'rb-cell' && curEd.blkIdx === blkIdx && curEd.rowIdx === rowIdx) {
    curEd.cancelling = true;
    state.repairInlineEdit = null;
  } else if (curEd) {
    await commitActiveRepairInlineEdit();
  }

  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;

  const displayBlocks = _getDisplayRepairBlocksForCase(c);
  const blk = displayBlocks[blkIdx];
  const targetRow = blk?.rows?.[rowIdx];
  if (!blk || !targetRow) return;

  if (targetRow._isDraft) {
    _removeDraftRepairRow(caseId, blk.id, Boolean(blk._isDraft), targetRow.id);
    const blocksHost = document.querySelector('#repair-detail .rep-blocks-host');
    if (blocksHost) blocksHost.innerHTML = renderRepairBlocksSectionHtml(c, true);
    if (pane) pane.scrollTop = savedScroll;
    if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
    return;
  }

  const rollback = _cloneRepairBackup(c);
  const { blocks: nextSaved } = _normalizeBlocksForSaveWithTracking(displayBlocks, blkIdx, -1, (b, bi) => {
    if (bi !== blkIdx) return b;
    return { ...b, rows: (b.rows || []).filter((_, ri) => ri !== rowIdx) };
  });

  if (state.repairDraftBlocks && state.repairDraftBlocks[caseId]) {
    delete state.repairDraftBlocks[caseId];
  }
  c.repair_blocks_json = nextSaved;
  c.fault_symptom_raw = _serializeRepairBlocksJS(nextSaved);
  c.root_cause_raw = '';
  c.solution_raw = '';
  c.steps = [];

  const blocksHost = document.querySelector('#repair-detail .rep-blocks-host');
  if (blocksHost) blocksHost.innerHTML = renderRepairBlocksSectionHtml(c, true);
  if (pane) pane.scrollTop = savedScroll;

  await patchRepairCaseInline(caseId, { repair_blocks_json: nextSaved }, `rb-${blkIdx}`, { reRenderBlocks: true, rollback });
}

async function deleteRepairBlockInline(caseId, blkIdx) {
  const curEd = state.repairInlineEdit;
  if (curEd && curEd.caseId === caseId && (curEd.target === 'rb-title' || curEd.target === 'rb-cell') && curEd.blkIdx === blkIdx) {
    curEd.cancelling = true;
    state.repairInlineEdit = null;
  } else if (curEd) {
    await commitActiveRepairInlineEdit();
  }

  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const displayBlocks = _getDisplayRepairBlocksForCase(c);
  const targetBlk = displayBlocks[blkIdx];
  if (!targetBlk) return;

  const isEn = _repairIsEnLang();
  const hasContent = Boolean(String(targetBlk.title || '').trim())
    || (targetBlk.rows || []).some((r) => String(r.label || '').trim() || String(r.content || '').trim());
  const lbl = String(targetBlk.title || '').trim() || (isEn ? `Section ${blkIdx + 1}` : `Mục ${blkIdx + 1}`);
  if (hasContent && !await uiConfirm(isEn ? `Delete section "${lbl}"?` : `Xóa mục "${lbl}" và toàn bộ dòng bên trong?`)) {
    return;
  }

  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;

  if (targetBlk._isDraft) {
    _removeDraftRepairBlock(caseId, targetBlk.id);
    const blocksHost = document.querySelector('#repair-detail .rep-blocks-host');
    if (blocksHost) blocksHost.innerHTML = renderRepairBlocksSectionHtml(c, true);
    if (pane) pane.scrollTop = savedScroll;
    if (isEn && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
    return;
  }

  const rollback = _cloneRepairBackup(c);
  const remaining = displayBlocks.filter((_, bi) => bi !== blkIdx);
  const { blocks: nextSaved } = _normalizeBlocksForSaveWithTracking(remaining);

  if (state.repairDraftBlocks && state.repairDraftBlocks[caseId]) {
    delete state.repairDraftBlocks[caseId];
  }
  c.repair_blocks_json = nextSaved;
  c.fault_symptom_raw = _serializeRepairBlocksJS(nextSaved);
  c.root_cause_raw = '';
  c.solution_raw = '';
  c.steps = [];

  const blocksHost = document.querySelector('#repair-detail .rep-blocks-host');
  if (blocksHost) blocksHost.innerHTML = renderRepairBlocksSectionHtml(c, true);
  if (pane) pane.scrollTop = savedScroll;

  await patchRepairCaseInline(caseId, { repair_blocks_json: nextSaved }, 'rb-0', { reRenderBlocks: true, rollback });
  showToast(isEn ? `Deleted section "${lbl}"` : `Đã xóa mục "${lbl}"`, 'success');
}

async function toggleRepairBlockBilingual(caseId, blkIdx) {
  if (state.repairInlineEdit) {
    await commitActiveRepairInlineEdit();
  }
  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const blocks = _getDisplayRepairBlocksForCase(c);
  const blk = blocks[blkIdx];
  if (!blk) return;

  const lines = [];
  if (String(blk.title || '').trim()) lines.push(String(blk.title).trim());
  (blk.rows || []).forEach((r) => {
    const lbl = String(r.label || '').trim();
    const cnt = String(r.content || '').trim();
    if (lbl && cnt) lines.push(`${lbl}: ${cnt}`);
    else if (lbl || cnt) lines.push(lbl || cnt);
  });

  const hostId = `rb-bilingual-${caseId}-${blkIdx}`;
  const btn = document.querySelector(`#repair-detail [data-rb-bi-btn="${CSS.escape(hostId)}"]`);
  if (typeof _toggleCustomHostBilingual === 'function') {
    await _toggleCustomHostBilingual(hostId, `${c.id} · ${blk.title || `Mục ${blkIdx + 1}`}`, lines, c.id);
    const hostEl = document.getElementById(hostId);
    if (btn && hostEl) btn.classList.toggle('split-on', !hostEl.classList.contains('hidden'));
  }
}

async function startRepairStepFieldEdit(caseId, stepIdx, field) {
  return;
}

function cancelActiveRepairInlineEdit() {
  let closedSomething = false;
  if (state.repairTagAdd) {
    closeRepairTagInput();
    closedSomething = true;
  }
  const ed = state.repairInlineEdit;
  if (!ed) return closedSomething;
  ed.cancelling = true;
  state.repairInlineEdit = null;
  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;
  const c = _getRepairCaseById(ed.caseId);
  if (c) {
    if (ed.target === 'cold-cell' && ed.isDraft) {
      const displayRows = _getDisplayColdRowsForCase(c);
      const targetRow = displayRows[ed.rowIdx];
      if (targetRow && !String(targetRow.item || '').trim() && !String(targetRow.result || '').trim()) {
        const dList = state.repairDraftColdRows[ed.caseId] || [];
        const dIdx = dList.findIndex((x) => x.id === targetRow.id);
        if (dIdx >= 0) dList.splice(dIdx, 1);
        if (!dList.length) delete state.repairDraftColdRows[ed.caseId];
        const coldHost = document.querySelector('#repair-detail .rep-cold-host');
        if (coldHost) coldHost.innerHTML = renderRepairColdCheckBlockHtml(c, true);
      } else {
        _restoreFieldHost(ed, c, ed.origValue);
      }
    } else if (ed.target === 'rb-title' && ed.isDraftBlock) {
      const blocks = _getDisplayRepairBlocksForCase(c);
      const blk = blocks[ed.blkIdx];
      const hasRows = (blk?.rows || []).some((r) => String(r.label || '').trim() || String(r.content || '').trim());
      if (blk && !String(blk.title || '').trim() && !hasRows) {
        _removeDraftRepairBlock(ed.caseId, blk.id);
        const blocksHost = document.querySelector('#repair-detail .rep-blocks-host');
        if (blocksHost) blocksHost.innerHTML = renderRepairBlocksSectionHtml(c, true);
      } else {
        _restoreFieldHost(ed, c, ed.origValue);
      }
    } else if (ed.target === 'rb-cell' && ed.isDraft) {
      const blocks = _getDisplayRepairBlocksForCase(c);
      const blk = blocks[ed.blkIdx];
      const row = blk?.rows?.[ed.rowIdx];
      if (blk && row && !String(row.label || '').trim() && !String(row.content || '').trim()) {
        _removeDraftRepairRow(ed.caseId, blk.id, Boolean(blk._isDraft), row.id);
        const blocksHost = document.querySelector('#repair-detail .rep-blocks-host');
        if (blocksHost) blocksHost.innerHTML = renderRepairBlocksSectionHtml(c, true);
      } else {
        _restoreFieldHost(ed, c, ed.origValue);
      }
    } else {
      _restoreFieldHost(ed, c, ed.origValue);
    }
  }
  if (pane) pane.scrollTop = savedScroll;
  if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
  return true;
}

async function flushActiveRepairInlineEdit() {
  if (state.repairTagAdd) closeRepairTagInput();
  const activeCap = document.activeElement?.closest?.('#repair-detail .cc-cap-grid');
  if (activeCap) {
    const ccIdx = Number(activeCap.dataset.ccIdx);
    const rootId = activeCap.closest('[data-repair-detail-id]')?.dataset?.repairDetailId || state.selectedRepairId;
    if (rootId && Number.isFinite(ccIdx)) {
      await _commitCapGridForRow(rootId, ccIdx);
    }
  }
  if (state.repairInlineEdit) return commitActiveRepairInlineEdit();
  return Promise.resolve();
}

function _cloneRepairBackup(c) {
  if (!c) return null;
  return {
    brand_model: c.brand_model || '',
    cold_check_raw: c.cold_check_raw || '',
    cold_check_json: _resolveColdCheckRowsForCase(c).map((r) => ({
      ...r,
      ...(Array.isArray(r.caps) ? { caps: _cloneCapItemsJS(r.caps) } : {}),
    })),
    repair_blocks_json: _resolveRepairBlocksForCase(c).map((b) => ({
      ...b,
      rows: (b.rows || []).map((r) => ({ ...r })),
    })),
    note: c.note || '',
    fault_symptom_raw: c.fault_symptom_raw || '',
    root_cause_raw: c.root_cause_raw || '',
    solution_raw: c.solution_raw || '',
    steps: (c.steps || []).map((s) => ({ ...s })),
    component_tags: [...(c.component_tags || [])],
    fault_codes: [...(c.fault_codes || [])],
  };
}

function _applyRepairBackup(c, backup) {
  if (!c || !backup) return;
  Object.assign(c, {
    brand_model: backup.brand_model,
    cold_check_raw: backup.cold_check_raw,
    cold_check_json: (backup.cold_check_json || []).map((r) => ({
      ...r,
      ...(Array.isArray(r.caps) ? { caps: _cloneCapItemsJS(r.caps) } : {}),
    })),
    repair_blocks_json: (backup.repair_blocks_json || []).map((b) => ({
      ...b,
      rows: (b.rows || []).map((r) => ({ ...r })),
    })),
    note: backup.note,
    fault_symptom_raw: backup.fault_symptom_raw,
    root_cause_raw: backup.root_cause_raw,
    solution_raw: backup.solution_raw,
    steps: (backup.steps || []).map((s) => ({ ...s })),
    component_tags: [...(backup.component_tags || [])],
    fault_codes: [...(backup.fault_codes || [])],
  });
}

async function commitActiveRepairInlineEdit(options = {}) {
  const ed = state.repairInlineEdit;
  if (!ed || ed.saving || ed.cancelling) return;
  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;

  if (ed.target === 'cold-cell') {
    const inp = ed.hostEl?.querySelector('.cc-inline-inp, .cc-inline-ta');
    const nextVal = String(inp ? inp.value : '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const origVal = String(ed.origValue || '').trim();
    state.repairInlineEdit = null;
    const c = _getRepairCaseById(ed.caseId);
    if (!c) return;

    const displayRows = _getDisplayColdRowsForCase(c);
    const targetRow = displayRows[ed.rowIdx];
    if (!targetRow) return;

    const nextItem = ed.field === 'item' ? nextVal : String(targetRow.item || '').trim();
    const nextRes = ed.field === 'result' ? nextVal : String(targetRow.result || '').trim();
    const bothEmpty = !nextItem && !nextRes;

    if (bothEmpty && targetRow._isDraft) {
      if (options.keepBlankDraftRow) {
        _restoreFieldHost(ed, c, nextVal);
        if (options.nextCell) {
          await startColdCheckCellEdit(options.nextCell.caseId, options.nextCell.rowIdx, options.nextCell.field);
        }
        if (pane) pane.scrollTop = savedScroll;
        return;
      }
      const dList = state.repairDraftColdRows[ed.caseId] || [];
      const dIdx = dList.findIndex((x) => x.id === targetRow.id);
      if (dIdx >= 0) dList.splice(dIdx, 1);
      if (!dList.length) delete state.repairDraftColdRows[ed.caseId];
      const coldHost = document.querySelector('#repair-detail .rep-cold-host');
      if (coldHost) coldHost.innerHTML = renderRepairColdCheckBlockHtml(c, true);
      if (options.addRowAfter) {
        await addColdCheckRowInline(options.addRowAfter.caseId, true, options.addRowAfter.afterIdx);
      }
      if (pane) pane.scrollTop = savedScroll;
      if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
      return;
    }

    if (nextVal === origVal && !targetRow._isDraft) {
      _restoreFieldHost(ed, c, origVal);
      if (options.nextCell) {
        await startColdCheckCellEdit(options.nextCell.caseId, options.nextCell.rowIdx, options.nextCell.field);
      } else if (options.addRowAfter) {
        await addColdCheckRowInline(options.addRowAfter.caseId, true, options.addRowAfter.afterIdx + 1);
      }
      if (pane) pane.scrollTop = savedScroll;
      if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
      return;
    }

    const rollback = _cloneRepairBackup(c);
    const updatedRows = displayRows
      .map((r, i) => {
        if (i !== ed.rowIdx) return r;
        const patched = { ...r, [ed.field]: nextVal };
        if (ed.field === 'item' && _isCapRowJS(patched) && !Array.isArray(patched.caps)) {
          patched.caps = patched.result ? _getCapsForRow(patched) : [];
        }
        return patched;
      })
      .filter((r) => String(r.item || '').trim() || String(r.result || '').trim() || (Array.isArray(r.caps) && r.caps.length > 0))
      .map((r, i) => _preserveColdRowForPayload(r, i));

    if (state.repairDraftColdRows && state.repairDraftColdRows[ed.caseId]) {
      delete state.repairDraftColdRows[ed.caseId];
    }
    const becomesCapRow = ed.field === 'item' && Boolean(updatedRows[ed.rowIdx] && _isCapRowJS(updatedRows[ed.rowIdx]));
    c.cold_check_json = updatedRows;
    c.cold_check_raw = _serializeColdCheckRowsJS(updatedRows);

    if (targetRow._isDraft || bothEmpty || becomesCapRow) {
      const coldHost = document.querySelector('#repair-detail .rep-cold-host');
      if (coldHost) coldHost.innerHTML = renderRepairColdCheckBlockHtml(c, true);
    } else {
      _restoreFieldHost(ed, c, nextVal);
    }
    if (pane) pane.scrollTop = savedScroll;

    const patchPromise = patchRepairCaseInline(ed.caseId, { cold_check_json: updatedRows }, 'cold', { rollback });
    if (options.nextCell) {
      const targetIdx = Math.min(options.nextCell.rowIdx, Math.max(0, updatedRows.length - 1));
      if (options.nextCell.field === 'result' && updatedRows[targetIdx] && _isCapRowJS(updatedRows[targetIdx])) {
        _focusCapGridFirstInput(options.nextCell.caseId, targetIdx);
      } else {
        await startColdCheckCellEdit(options.nextCell.caseId, targetIdx, options.nextCell.field);
      }
    } else if (options.addRowAfter) {
      const insIdx = bothEmpty
        ? Math.min(options.addRowAfter.afterIdx, updatedRows.length)
        : Math.min(options.addRowAfter.afterIdx + 1, updatedRows.length);
      await addColdCheckRowInline(options.addRowAfter.caseId, true, insIdx);
    }
    await patchPromise;
    return;
  }

  if (ed.target === 'rb-title') {
    const inp = ed.hostEl?.querySelector('.rb-title-inp');
    const nextVal = String(inp ? inp.value : '').trim();
    const origVal = String(ed.origValue || '').trim();
    state.repairInlineEdit = null;
    const c = _getRepairCaseById(ed.caseId);
    if (!c) return;

    const displayBlocks = _getDisplayRepairBlocksForCase(c);
    const targetBlk = displayBlocks[ed.blkIdx];
    if (!targetBlk) return;

    const hasContentRows = (targetBlk.rows || []).some((r) => String(r.label || '').trim() || String(r.content || '').trim());
    if (!nextVal && targetBlk._isDraft && !hasContentRows) {
      if (options.keepBlankDraft || options.jumpToFirstRow) {
        _restoreFieldHost(ed, c, nextVal);
        if (options.jumpToFirstRow) {
          await startRepairBlockCellEdit(ed.caseId, ed.blkIdx, 0, 'label');
        }
        if (pane) pane.scrollTop = savedScroll;
        return;
      }
      _removeDraftRepairBlock(ed.caseId, targetBlk.id);
      const blocksHost = document.querySelector('#repair-detail .rep-blocks-host');
      if (blocksHost) blocksHost.innerHTML = renderRepairBlocksSectionHtml(c, true);
      if (pane) pane.scrollTop = savedScroll;
      if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
      return;
    }

    if (nextVal === origVal && !targetBlk._isDraft) {
      _restoreFieldHost(ed, c, origVal);
      if (options.jumpToFirstRow) {
        if ((targetBlk.rows || []).length > 0) {
          await startRepairBlockCellEdit(ed.caseId, ed.blkIdx, 0, 'label');
        } else {
          await addRepairBlockRowInline(ed.caseId, ed.blkIdx, true);
        }
      }
      if (pane) pane.scrollTop = savedScroll;
      if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
      return;
    }

    const rollback = _cloneRepairBackup(c);
    const { blocks: updatedBlocks, savedBlkIdx } = _normalizeBlocksForSaveWithTracking(
      displayBlocks,
      ed.blkIdx,
      -1,
      (b, bi) => (bi === ed.blkIdx ? { ...b, title: nextVal } : b)
    );
    const actualBlkIdx = savedBlkIdx >= 0 ? savedBlkIdx : Math.max(0, Math.min(ed.blkIdx, updatedBlocks.length - 1));
    const savedBlk = updatedBlocks[actualBlkIdx];

    if ((options.keepBlankDraft || options.jumpToFirstRow) && savedBlk && !savedBlk.rows.length) {
      state.repairDraftBlocks[ed.caseId] = {
        blocks: [],
        rows: {
          [savedBlk.id]: [{
            id: `row-draft-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            label: '',
            content: '',
            _isDraft: true,
            _insertAt: 0,
          }],
        },
      };
    } else if (state.repairDraftBlocks && state.repairDraftBlocks[ed.caseId]) {
      delete state.repairDraftBlocks[ed.caseId];
    }

    c.repair_blocks_json = updatedBlocks;
    c.fault_symptom_raw = _serializeRepairBlocksJS(updatedBlocks);
    c.root_cause_raw = '';
    c.solution_raw = '';
    c.steps = [];

    if (targetBlk._isDraft || !savedBlk || (options.jumpToFirstRow && savedBlk && !savedBlk.rows.length)) {
      const blocksHost = document.querySelector('#repair-detail .rep-blocks-host');
      if (blocksHost) blocksHost.innerHTML = renderRepairBlocksSectionHtml(c, true);
    } else {
      _restoreFieldHost(ed, c, nextVal);
    }
    if (pane) pane.scrollTop = savedScroll;

    const patchPromise = patchRepairCaseInline(ed.caseId, { repair_blocks_json: updatedBlocks }, `rb-${Math.max(0, actualBlkIdx)}`, { rollback });
    if (options.jumpToFirstRow && savedBlk) {
      const curDisplay = _getDisplayRepairBlocksForCase(c);
      if ((curDisplay[actualBlkIdx]?.rows || []).length > 0) {
        await startRepairBlockCellEdit(ed.caseId, actualBlkIdx, 0, 'label');
      } else {
        await addRepairBlockRowInline(ed.caseId, actualBlkIdx, true);
      }
    }
    await patchPromise;
    return;
  }

  if (ed.target === 'rb-cell') {
    const inp = ed.hostEl?.querySelector('.rb-inline-inp, .rb-inline-ta');
    const nextVal = String(inp ? inp.value : '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const origVal = String(ed.origValue || '').trim();
    state.repairInlineEdit = null;
    const c = _getRepairCaseById(ed.caseId);
    if (!c) return;

    const displayBlocks = _getDisplayRepairBlocksForCase(c);
    const targetBlk = displayBlocks[ed.blkIdx];
    const targetRow = targetBlk?.rows?.[ed.rowIdx];
    if (!targetBlk || !targetRow) return;

    const nextLabel = ed.field === 'label' ? nextVal : String(targetRow.label || '').trim();
    const nextContent = ed.field === 'content' ? nextVal : String(targetRow.content || '').trim();
    const bothEmpty = !nextLabel && !nextContent;

    if (bothEmpty && targetRow._isDraft) {
      if (options.keepBlankDraftRow) {
        _restoreFieldHost(ed, c, nextVal);
        if (options.nextCell) {
          await startRepairBlockCellEdit(options.nextCell.caseId, options.nextCell.blkIdx, options.nextCell.rowIdx, options.nextCell.field);
        }
        if (pane) pane.scrollTop = savedScroll;
        return;
      }
      _removeDraftRepairRow(ed.caseId, targetBlk.id, Boolean(targetBlk._isDraft), targetRow.id);
      const stillHasBlk = _getDisplayRepairBlocksForCase(c)[ed.blkIdx];
      const blocksHost = document.querySelector('#repair-detail .rep-blocks-host');
      if (blocksHost) blocksHost.innerHTML = renderRepairBlocksSectionHtml(c, true);
      if (options.addRowAfter && stillHasBlk) {
        await addRepairBlockRowInline(options.addRowAfter.caseId, ed.blkIdx, true, options.addRowAfter.afterIdx);
      }
      if (pane) pane.scrollTop = savedScroll;
      if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
      return;
    }

    if (nextVal === origVal && !targetRow._isDraft) {
      _restoreFieldHost(ed, c, origVal);
      if (options.nextCell) {
        await startRepairBlockCellEdit(options.nextCell.caseId, options.nextCell.blkIdx, options.nextCell.rowIdx, options.nextCell.field);
      } else if (options.addRowAfter) {
        await addRepairBlockRowInline(options.addRowAfter.caseId, options.addRowAfter.blkIdx, true, options.addRowAfter.afterIdx + 1);
      }
      if (pane) pane.scrollTop = savedScroll;
      if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
      return;
    }

    const rollback = _cloneRepairBackup(c);
    const { blocks: updatedBlocks, savedBlkIdx, savedRowIdx } = _normalizeBlocksForSaveWithTracking(
      displayBlocks,
      ed.blkIdx,
      ed.rowIdx,
      (b, bi) => {
        if (bi !== ed.blkIdx) return b;
        return {
          ...b,
          rows: (b.rows || []).map((r, ri) => (ri === ed.rowIdx ? { ...r, [ed.field]: nextVal } : r)),
        };
      }
    );

    if (state.repairDraftBlocks && state.repairDraftBlocks[ed.caseId]) {
      delete state.repairDraftBlocks[ed.caseId];
    }
    c.repair_blocks_json = updatedBlocks;
    c.fault_symptom_raw = _serializeRepairBlocksJS(updatedBlocks);
    c.root_cause_raw = '';
    c.solution_raw = '';
    c.steps = [];

    if (targetRow._isDraft || targetBlk._isDraft || bothEmpty) {
      const blocksHost = document.querySelector('#repair-detail .rep-blocks-host');
      if (blocksHost) blocksHost.innerHTML = renderRepairBlocksSectionHtml(c, true);
    } else {
      _restoreFieldHost(ed, c, nextVal);
    }
    if (pane) pane.scrollTop = savedScroll;

    const patchPromise = patchRepairCaseInline(ed.caseId, { repair_blocks_json: updatedBlocks }, `rb-${Math.max(0, savedBlkIdx)}`, { rollback });
    if (options.nextCell && savedBlkIdx >= 0 && savedRowIdx >= 0) {
      await startRepairBlockCellEdit(options.nextCell.caseId, savedBlkIdx, savedRowIdx, options.nextCell.field);
    } else if (options.addRowAfter && savedBlkIdx >= 0 && updatedBlocks[savedBlkIdx]) {
      const insIdx = bothEmpty
        ? Math.min(options.addRowAfter.afterIdx, updatedBlocks[savedBlkIdx].rows.length)
        : Math.min((savedRowIdx >= 0 ? savedRowIdx : options.addRowAfter.afterIdx) + 1, updatedBlocks[savedBlkIdx].rows.length);
      await addRepairBlockRowInline(options.addRowAfter.caseId, savedBlkIdx, true, insIdx);
    }
    await patchPromise;
    return;
  }

  const ta = ed.hostEl?.querySelector('.rep-inline-ta');
  const nextVal = String(ta ? ta.value : '').trim();
  const origVal = String(ed.origValue || '').trim();

  if (ed.target === 'title' && !nextVal) {
    showToast(_repairIsEnLang() ? 'Brand & Model cannot be empty' : 'Tên hãng & mã thiết bị không được để trống', 'error');
    state.repairInlineEdit = null;
    const c = _getRepairCaseById(ed.caseId);
    if (c) _restoreTitleHost(ed.hostEl, c);
    if (pane) pane.scrollTop = savedScroll;
    return;
  }

  state.repairInlineEdit = null;
  const c = _getRepairCaseById(ed.caseId);
  if (!c) return;

  if (nextVal === origVal) {
    _restoreFieldHost(ed, c, origVal);
    if (pane) pane.scrollTop = savedScroll;
    if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
    return;
  }

  const rollback = _cloneRepairBackup(c);
  let patchPayload = {};
  let statusKey = 'cold';
  if (ed.target === 'title') {
    c.brand_model = nextVal;
    patchPayload = { brand_model: nextVal };
    statusKey = 'title';
    _restoreTitleHost(ed.hostEl, c);
  } else if (ed.target === 'note') {
    c.note = nextVal;
    patchPayload = { note: nextVal };
    statusKey = 'note';
    _restoreFieldHost(ed, c, nextVal);
  } else if (ed.target === 'step') {
    const displaySteps = _getDisplayStepsForCase(c).map((s, idx) => ({
      step_order: s.step_order || idx + 1,
      symptom: s.symptom || '',
      root_cause: s.root_cause || '',
      solution: s.solution || '',
    }));
    if (displaySteps[ed.stepIdx]) displaySteps[ed.stepIdx][ed.field] = nextVal;
    c.steps = displaySteps;
    _restoreFieldHost(ed, c, nextVal);
    patchPayload = { steps: displaySteps };
    statusKey = `step-${ed.stepIdx}`;
    if (state.repairDraftSteps && state.repairDraftSteps[ed.caseId]) {
      delete state.repairDraftSteps[ed.caseId];
    }
  }
  if (pane) pane.scrollTop = savedScroll;

  await patchRepairCaseInline(ed.caseId, patchPayload, statusKey, { rollback });
}

function _syncRepairListRowDom(saved) {
  const row = document.querySelector(`#repair-list .row[data-ctx-record-id="${CSS.escape(saved.id)}"]`);
  if (!row) return;
  const tEl = row.querySelector('.row-title');
  if (tEl) {
    delete tEl.dataset.viHtmlOrig;
    delete tEl.dataset.viTextOrig;
    tEl.textContent = String(saved.brand_model || '').replace(/\s*\n+\s*/g, ' — ');
    tEl.title = saved.brand_model || '';
  }
  const cEl = row.querySelector('.row-step-count');
  if (cEl) {
    delete cEl.dataset.viHtmlOrig;
    delete cEl.dataset.viTextOrig;
    const cnt = _resolveRepairBlocksForCase(saved).length;
    cEl.textContent = `${cnt} mục`;
  }
}

function _syncRepairDetailBlocksAfterPatch(saved, opts = {}) {
  const pane = document.getElementById('repair-detail');
  const root = pane?.querySelector(`[data-repair-detail-id="${CSS.escape(saved.id)}"]`);
  if (!root) return;
  const savedScroll = pane ? pane.scrollTop : 0;
  const ed = state.repairInlineEdit;

  if (!(ed && ed.caseId === saved.id && ed.target === 'title')) {
    const tWrap = root.querySelector(`[data-rep-title-wrap="${CSS.escape(saved.id)}"]`);
    if (tWrap) _restoreTitleHost(tWrap, saved);
  }

  const tagsBar = root.querySelector(`[data-rep-tags-bar="${CSS.escape(saved.id)}"]`);
  if (tagsBar && !state.repairTagAdd) {
    tagsBar.innerHTML = renderRepairInteractiveTagsHtml(saved, true);
  }

  const coldHost = root.querySelector('.rep-cold-host');
  if (coldHost) {
    const activeCapEditing = Boolean(opts.skipColdCapRerender || document.activeElement?.closest('#repair-detail .cc-cap-grid'));
    if ((ed && ed.caseId === saved.id && ed.target === 'cold-cell') || activeCapEditing) {
      const displayRows = _getDisplayColdRowsForCase(saved);
      const isEn = _repairIsEnLang();
      const countMetaEl = coldHost.querySelector('.cc-count-meta');
      if (countMetaEl) countMetaEl.innerHTML = _coldCheckCountMetaHtml(displayRows, isEn);
      displayRows.forEach((r, idx) => {
        ['item', 'result'].forEach((fld) => {
          if (ed && ed.rowIdx === idx && ed.field === fld) return;
          const cell = coldHost.querySelector(`.cc-cell[data-cc-idx="${idx}"][data-cc-field="${fld}"]`);
          if (cell) {
            const ph = fld === 'item'
              ? (isEn ? 'Component...' : 'Thành phần...')
              : (isEn ? 'Measurement / Result...' : 'Kết quả / Thông số đo...');
            delete cell.dataset.viHtmlOrig;
            delete cell.dataset.viTextOrig;
            cell.innerHTML = _coldCheckCellHtml(r[fld], saved, ph);
          }
        });
      });
    } else {
      coldHost.innerHTML = renderRepairColdCheckBlockHtml(saved, true);
    }
  }

  if (!(ed && ed.caseId === saved.id && ed.target === 'note')) {
    const noteHost = root.querySelector('.rep-note-host');
    if (noteHost) noteHost.innerHTML = renderRepairNoteBlockHtml(saved, true);
  }

  const blocksHost = root.querySelector('.rep-blocks-host');
  if (blocksHost) {
    if (ed && ed.caseId === saved.id && (ed.target === 'rb-title' || ed.target === 'rb-cell')) {
      const displayBlocks = _getDisplayRepairBlocksForCase(saved);
      const isEn = _repairIsEnLang();
      const untitledPh = isEn ? 'Untitled section (click to edit)' : 'Chưa đặt tên mục (chạm để sửa)';
      const labelPh = isEn ? 'Item / Test point...' : 'Hạng mục / Điểm đo...';
      const contentPh = isEn ? 'Details / Result...' : 'Nội dung / Kết quả đo...';
      displayBlocks.forEach((blk, bi) => {
        if (!(ed.target === 'rb-title' && ed.blkIdx === bi)) {
          const tEl = blocksHost.querySelector(`.rb-title[data-rb-title="${bi}"]`);
          if (tEl) {
            delete tEl.dataset.viHtmlOrig;
            delete tEl.dataset.viTextOrig;
            const ct = String(blk.title || '').trim();
            tEl.innerHTML = ct ? escapeHtml(ct) : `<span class="rb-title-empty">${escapeHtml(untitledPh)}</span>`;
          }
        }
        (blk.rows || []).forEach((r, ri) => {
          ['label', 'content'].forEach((fld) => {
            if (ed.target === 'rb-cell' && ed.blkIdx === bi && ed.rowIdx === ri && ed.field === fld) return;
            const cell = blocksHost.querySelector(`.rb-cell[data-rb-idx="${bi}"][data-rb-row="${ri}"][data-rb-field="${fld}"]`);
            if (cell) {
              delete cell.dataset.viHtmlOrig;
              delete cell.dataset.viTextOrig;
              cell.innerHTML = _repairBlockCellHtml(r[fld], saved, fld === 'label' ? labelPh : contentPh);
            }
          });
        });
      });
    } else if (opts.reRenderBlocks !== false) {
      blocksHost.innerHTML = renderRepairBlocksSectionHtml(saved, true);
    }
  }

  if (typeof invalidateBilingualHostCache === 'function') {
    invalidateBilingualHostCache(`rb-bilingual-${saved.id}-`);
    invalidateBilingualHostCache(`repair-bilingual-host-${saved.id}`);
  }

  const mobIdEl = document.getElementById('mob-detail-id');
  if (mobIdEl && document.body.classList.contains('mobile-detail-open')) {
    const hint = String(saved.brand_model || '').replace(/\s*\n+\s*/g, ' — ').trim();
    mobIdEl.textContent = hint ? `${saved.id} · ${hint}` : saved.id;
  }

  if (pane) pane.scrollTop = savedScroll;
}

let _repairPatchQueue = Promise.resolve();
const _repairCasePatchSeq = {};

async function patchRepairCaseInline(caseId, patchPayload, statusKey = 'cold', opts = {}) {
  const isEn = _repairIsEnLang();
  const mySeq = (_repairCasePatchSeq[caseId] = (_repairCasePatchSeq[caseId] || 0) + 1);
  _setRepairSaveStatus(statusKey, 'saving', isEn ? '⏳ Saving...' : '⏳ Đang lưu...');

  const run = async () => {
    try {
      const res = await fetch(`/api/repair-cases/${encodeURIComponent(caseId)}/inline`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || (isEn ? 'Failed to save changes' : 'Lưu thay đổi thất bại'));
      }
      const saved = await res.json();
      if (mySeq === _repairCasePatchSeq[caseId]) {
        const idx = (state.repairCases || []).findIndex((x) => x.id === saved.id);
        if (idx >= 0) state.repairCases[idx] = saved;

        _recomputeRepairTagsDictionary();
        _syncRepairListRowDom(saved);
        _syncRepairDetailBlocksAfterPatch(saved, opts);
        renderHeaderStats();
        syncPrimaryEditorTab();
        if (state.splitMode && state.pane2?.group === 'repair' && state.pane2?.id === saved.id) {
          renderPane2();
        }
        _setRepairSaveStatus(statusKey, 'saved', isEn ? '✓ Saved' : '✓ Đã lưu');
        if (isEn && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
      }
      return saved;
    } catch (err) {
      if (mySeq === _repairCasePatchSeq[caseId] && opts.rollback) {
        const cur = _getRepairCaseById(caseId);
        if (cur) {
          _applyRepairBackup(cur, opts.rollback);
          _recomputeRepairTagsDictionary();
          _syncRepairListRowDom(cur);
          _syncRepairDetailBlocksAfterPatch(cur, { reRenderBlocks: true });
          if (isEn && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
        }
      }
      _setRepairSaveStatus(statusKey, 'error', isEn ? 'Save error' : 'Lỗi lưu');
      showToast(err.message, 'error');
      return null;
    }
  };

  const queued = _repairPatchQueue.then(run, run);
  _repairPatchQueue = queued.catch(() => null);
  return queued;
}

async function addRepairStepInline(caseId) {
  return addRepairBlockInline(caseId);
}

async function deleteRepairStepInline(caseId, stepIdx) {
  return deleteRepairBlockInline(caseId, stepIdx);
}

function openRepairTagInput(caseId, kind) {
  const c = _getRepairCaseById(caseId);
  if (!c) return;
  state.repairTagAdd = { caseId, kind };
  const bar = document.querySelector(`#repair-detail [data-rep-tags-bar="${CSS.escape(caseId)}"]`);
  if (bar) bar.innerHTML = renderRepairInteractiveTagsHtml(c, true);
  const inp = document.getElementById(`rep-tag-inp-${caseId}-${kind}`);
  if (inp) {
    inp.focus();
  }
  if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

function closeRepairTagInput() {
  const prev = state.repairTagAdd;
  if (!prev) return;
  state.repairTagAdd = null;
  const c = _getRepairCaseById(prev.caseId);
  const bar = document.querySelector(`#repair-detail [data-rep-tags-bar="${CSS.escape(prev.caseId)}"]`);
  if (c && bar) bar.innerHTML = renderRepairInteractiveTagsHtml(c, true);
  if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

function onRepairTagInputKeydown(event, caseId, kind) {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    commitRepairTagInput(caseId, kind);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeRepairTagInput();
  }
}

function onRepairTagInputBlur(event, caseId, kind) {
  const active = state.repairTagAdd;
  if (!active || active.caseId !== caseId || active.kind !== kind) return;
  const raw = (event?.target?.value || '').trim();
  if (raw) commitRepairTagInput(caseId, kind);
  else closeRepairTagInput();
}

async function commitRepairTagInput(caseId, kind) {
  const inp = document.getElementById(`rep-tag-inp-${caseId}-${kind}`);
  const raw = (inp?.value || '').trim();
  const c = _getRepairCaseById(caseId);
  state.repairTagAdd = null;
  if (!c || !raw) {
    const bar = document.querySelector(`#repair-detail [data-rep-tags-bar="${CSS.escape(caseId)}"]`);
    if (c && bar) bar.innerHTML = renderRepairInteractiveTagsHtml(c, true);
    if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
    return;
  }
  const tokens = raw.split(',').map((s) => s.trim().replace(/^#+/, '')).filter(Boolean);
  if (!tokens.length) return;

  const rollback = _cloneRepairBackup(c);
  let patchPayload;
  if (kind === 'fault') {
    const merged = Array.from(new Set([...(c.fault_codes || []), ...tokens]));
    c.fault_codes = merged;
    patchPayload = { fault_codes: merged, skip_auto_extract: true };
  } else {
    const merged = Array.from(new Set([...(c.component_tags || []), ...tokens.map((t) => t.toUpperCase())]));
    c.component_tags = merged;
    patchPayload = { component_tags: merged, skip_auto_extract: true };
  }
  const bar = document.querySelector(`#repair-detail [data-rep-tags-bar="${CSS.escape(caseId)}"]`);
  if (bar) bar.innerHTML = renderRepairInteractiveTagsHtml(c, true);
  if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
  await patchRepairCaseInline(caseId, patchPayload, 'title', { rollback });
}

async function removeRepairTagInline(caseId, kind, tagVal, event) {
  if (event) event.stopPropagation();
  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const rollback = _cloneRepairBackup(c);
  let patchPayload;
  if (kind === 'fault') {
    const next = (c.fault_codes || []).filter((f) => f !== tagVal);
    c.fault_codes = next;
    patchPayload = { fault_codes: next, skip_auto_extract: true };
  } else {
    const next = (c.component_tags || []).filter((t) => t !== tagVal);
    c.component_tags = next;
    patchPayload = { component_tags: next, skip_auto_extract: true };
  }
  if (!state.repairTagAdd) {
    const bar = document.querySelector(`#repair-detail [data-rep-tags-bar="${CSS.escape(caseId)}"]`);
    if (bar) bar.innerHTML = renderRepairInteractiveTagsHtml(c, true);
    if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
  }
  await patchRepairCaseInline(caseId, patchPayload, 'title', { rollback });
}

function renderRepairDetail(c, currentIdx = 0, total = 1) {
  state.repairInlineEdit = null;
  document.getElementById('repair-detail').innerHTML = buildRepairDetailHtml(c, { showNav: true, currentIdx, total, showDropzone: true, pane: 'primary', inline: true });
  syncPrimaryEditorTab();
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

// ---------------------------------------------------------------------------
// 02 Kiến thức & SOP
// ---------------------------------------------------------------------------
function populateKnowledgeCategorySelect() {
  const select = document.getElementById('knowledge-category-filter');
  const current = state.knowledgeFilters.category;
  const cats = Array.from(new Set(state.knowledgeItems.map((k) => k.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'));
  select.innerHTML = `<option value="ALL">PHÂN LOẠI: TẤT CẢ</option>` + cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(stripEmoji(c))}</option>`).join('');
  if (cats.includes(current)) select.value = current;
}
function getFilteredKnowledgeItems() {
  const { group, mode, category, status, q } = state.knowledgeFilters;
  const needle = (q || '').trim().toLowerCase();
  return state.knowledgeItems.filter((k) => {
    if (group !== 'ALL' && k.source_group !== group) return false;
    if (mode === 'SOP' && !isSopCategory(k.category)) return false;
    if (mode === 'CONCEPT_WHY' && isSopCategory(k.category)) return false;
    if (category !== 'ALL' && k.category !== category) return false;
    if (status !== 'ALL' && k.status_code !== status) return false;
    if (needle) {
      const customStr = (k.custom_sections_json || []).map((s) => `${s.title} ${s.content}`).join(' ');
      const hay = `${k.id} ${k.source_group} ${groupLabel(k.source_group)} ${k.topic_model} ${k.category} ${k.key_takeaway} ${k.core_concept_workflow} ${k.why_question} ${k.actionable_application} ${k.note} ${customStr} ${(k.component_tags || []).join(' ')}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}
function setKnowledgeGroup(g) {
  state.knowledgeFilters.group = g;
  state.knowledgeListCollapsed = false;
  renderKnowledgeView();
}
function setKnowledgeMode(m) {
  state.knowledgeFilters.mode = m;
  state.knowledgeListCollapsed = false;
  renderKnowledgeView();
}
function onKnowledgeFilterChange() {
  state.knowledgeFilters.category = document.getElementById('knowledge-category-filter').value;
  state.knowledgeFilters.status = document.getElementById('knowledge-status-filter').value;
  const qi = document.getElementById('knowledge-search-input');
  state.knowledgeFilters.q = qi.value;
  document.getElementById('knowledge-search-clear').classList.toggle('hidden', !qi.value);
  state.knowledgeListCollapsed = false;
  renderKnowledgeView();
}
function clearKnowledgeSearch() { document.getElementById('knowledge-search-input').value = ''; onKnowledgeFilterChange(); }
function selectKnowledgeItem(id) {
  if (typeof flushUniFieldEdit === 'function') flushUniFieldEdit();
  _flushInlineSectionOnLeave(false);
  state.selectedKnowledgeId = id;
  if (!state.knowledgeListPinned) state.knowledgeListCollapsed = true;
  renderKnowledgeView();
  const pane = document.getElementById('knowledge-detail');
  if (pane) pane.scrollTop = 0;
  if (typeof pushNavHistory === 'function') pushNavHistory();
}
function toggleSopStep(itemId, idx) {
  const pane = document.getElementById('knowledge-detail');
  const savedScroll = pane ? pane.scrollTop : 0;
  const key = `${itemId}:${idx}`;
  state.sopChecked[key] = !state.sopChecked[key];
  const filtered = getFilteredKnowledgeItems();
  const curIdx = Math.max(0, filtered.findIndex((k) => k.id === state.selectedKnowledgeId));
  const sel = filtered[curIdx];
  if (sel) renderKnowledgeDetail(sel, curIdx, filtered.length);
  if (pane) pane.scrollTop = savedScroll;
  if (state.splitMode && state.pane2.group === 'knowledge' && state.pane2.id === itemId) renderPane2();
}

function renderKnowledgeView() {
  const splitEl = document.querySelector('#view-knowledge .split');
  if (splitEl) splitEl.classList.toggle('list-collapsed', state.knowledgeListCollapsed);

  const gc = { ALL: state.knowledgeItems.length };
  state.knowledgeItems.forEach((k) => { gc[k.source_group] = (gc[k.source_group] || 0) + 1; });
  document.getElementById('knowledge-group-pills').innerHTML = chipsHtml(KNOWLEDGE_GROUPS, state.knowledgeFilters.group, gc, 'setKnowledgeGroup', 'knowledge');
  document.getElementById('knowledge-mode-pills').innerHTML = chipsHtml(KNOWLEDGE_MODES, state.knowledgeFilters.mode, null, 'setKnowledgeMode');

  const filtered = getFilteredKnowledgeItems();
  document.getElementById('knowledge-list-count').textContent = filtered.length;
  if (filtered.length > 0 && !filtered.some((k) => k.id === state.selectedKnowledgeId)) state.selectedKnowledgeId = filtered[0].id;

  const listEl = document.getElementById('knowledge-list');
  if (filtered.length === 0) {
    listEl.classList.remove('has-selection');
    listEl.innerHTML = `<div class="empty">KHÔNG CÓ TÀI LIỆU PHÙ HỢP</div>`;
    document.getElementById('knowledge-detail').innerHTML = `<div class="empty">CHƯA CHỌN TÀI LIỆU</div>`;
    return;
  }
  listEl.classList.add('has-selection');
  listEl.innerHTML = filtered.map((k) => {
    const sel = k.id === state.selectedKnowledgeId;
    const titleLine = String(k.topic_model || '').replace(/\s*\n+\s*/g, ' — ');
    const stLabel = (STATUS_META[k.status_code] || STATUS_META.unclassified).label;
    const shortCat = stripEmoji(k.category) || '';
    return `
      <div class="row ${sel ? 'selected' : ''}" data-ctx-record-kind="knowledge" data-ctx-record-id="${escapeHtml(k.id)}" onclick="selectKnowledgeItem('${escapeHtml(k.id)}')">
        <div class="row-top">
          <span class="row-id">${escapeHtml(k.id)}</span>
          <span>·</span>
          <span class="row-cat">${escapeHtml(groupLabel(k.source_group))}</span>
          <span class="led led-${k.status_code}" title="${escapeHtml(stLabel)}"></span>
        </div>
        <div class="row-main">
          <div class="row-title" title="${escapeHtml(k.topic_model)}">${escapeHtml(titleLine)}</div>
          ${shortCat ? `<span class="row-step-count">${escapeHtml(shortCat)}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  const curIdx = Math.max(0, filtered.findIndex((k) => k.id === state.selectedKnowledgeId));
  renderKnowledgeDetail(filtered[curIdx], curIdx, filtered.length);
}

function renderKnowledgeSopListInnerHtml(k, inline = true) {
  const steps = parseSopSteps(k.core_concept_workflow);
  const hl = (t) => highlightTagsHtml(String(t || '').trim(), k.component_tags);
  const kid = escapeHtml(k.id);
  if (!steps.length) {
    return inline
      ? `<div class="empty">— Chưa có các bước chi tiết (chạm để nhập 1. 2. 3...) —</div>`
      : '<div class="empty">CHƯA CÓ CÁC BƯỚC CHI TIẾT</div>';
  }
  return steps.map((s, i) => {
    const ck = Boolean(state.sopChecked[`${k.id}:${i}`]);
    return `<div class="sop-row ${ck ? 'done' : ''}">
      <input type="checkbox" ${ck ? 'checked' : ''} onclick="event.stopPropagation(); toggleSopStep('${kid}', ${i})" />
      <span class="sop-num" onclick="event.stopPropagation(); toggleSopStep('${kid}', ${i})">BƯỚC ${escapeHtml(s.num)}</span>
      <div class="sop-txt">${hl(s.text)}</div></div>`;
  }).join('');
}

function _knwBlockEditBtnHtml(kid, field, isEn) {
  return `<button type="button" class="btn btn-sm sec-inline-edit-btn" data-no-i18n="1" onclick="event.stopPropagation(); startUniFieldEdit('knowledge', '${kid}', '${field}', null, { skipGuard: true })" title="${isEn ? 'Edit this block' : 'Chỉnh sửa khối nội dung này'}">${isEn ? '✎ Edit' : '✎ Sửa'}</button>`;
}

function buildKnowledgeDetailHtml(k, opts = {}) {
  const { showNav = true, currentIdx = 0, total = 1, showDropzone = true, codePrefix = '', pane = 'primary', inline = true } = opts;
  const sopMode = isSopCategory(k.category);
  const kid = escapeHtml(k.id);
  const isEn = typeof state !== 'undefined' && state.appLang === 'en';
  const enOv = (isEn && k.en_overrides_json && typeof k.en_overrides_json === 'object') ? k.en_overrides_json : {};
  const fieldVal = (fld) => {
    const ov = String(enOv[fld] || '').trim();
    return ov ? { val: ov, customEn: true } : { val: String(k[fld] || ''), customEn: false };
  };
  const customAttr = (isCustomEn) => (isCustomEn ? 'data-has-custom-en="1" data-no-i18n="1"' : '');
  const hl = (t) => highlightTagsHtml(String(t || '').trim(), k.component_tags);
  const uniAttrs = (field, singleLine = false, isCustomEn = false) => inline
    ? `data-uni-edit="1" data-uni-kind="knowledge" data-uni-id="${kid}" data-uni-field="${field}" ${customAttr(isCustomEn)} onclick="startUniFieldEdit('knowledge', '${kid}', '${field}', event, { singleLine: ${singleLine} })"`
    : customAttr(isCustomEn);
  const uniCls = inline ? 'uni-editable' : '';
  const editBtnFor = (field) => (inline ? _knwBlockEditBtnHtml(kid, field, isEn) : '');
  let body = '';

  const coreF = fieldVal('core_concept_workflow');
  const appF = fieldVal('actionable_application');
  const whyF = fieldVal('why_question');
  const keyF = fieldVal('key_takeaway');
  const noteF = fieldVal('note');
  const topicF = fieldVal('topic_model');

  if (sopMode) {
    const steps = parseSopSteps(coreF.val || k.core_concept_workflow);
    const done = steps.filter((_, i) => state.sopChecked[`${k.id}:${i}`]).length;
    body = `
      <div class="sec">
        <div class="sec-head sec-title-row">
          <span class="sec-title">QUY TRÌNH ĐO &amp; SỬA (SOP)</span>
          <div class="sec-head-ops" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span class="sop-count">${done} / ${steps.length} HOÀN THÀNH</span>
            ${editBtnFor('core_concept_workflow')}
          </div>
        </div>
        <div class="${uniCls}" ${uniAttrs('core_concept_workflow', false, coreF.customEn)}>${renderKnowledgeSopListInnerHtml({ ...k, core_concept_workflow: coreF.val }, inline)}</div>
      </div>
      ${(appF.val || inline) ? `<div class="sec"><div class="note-block accent"><div class="nb-title sec-title-row"><span>ỨNG DỤNG THỰC CHIẾN</span><div class="sec-head-ops">${editBtnFor('actionable_application')}</div></div><div class="nb-body ${uniCls}" ${uniAttrs('actionable_application', false, appF.customEn)}>${appF.val ? hl(appF.val) : `<span class="none">${isEn ? '— Empty (click to add) —' : '— Chưa có (chạm để nhập) —'}</span>`}</div></div></div>` : ''}`;
  } else {
    body = `
      ${(coreF.val || inline) ? `<div class="sec"><div class="sec-head sec-title-row"><span class="sec-title">BẢN CHẤT NGUYÊN LÝ</span><div class="sec-head-ops">${editBtnFor('core_concept_workflow')}</div></div><div class="nb-body ${uniCls}" ${uniAttrs('core_concept_workflow', false, coreF.customEn)}>${coreF.val ? hl(coreF.val) : `<span class="none">${isEn ? '— Empty (click to add) —' : '— Chưa có (chạm để nhập) —'}</span>`}</div></div>` : ''}
      ${(whyF.val || k.source_group === 'Automation') ? `
        <div class="sec"><div class="grid2">
          <div class="note-block why"><div class="nb-title sec-title-row"><span>CÂU HỎI PHẢN BIỆN (TẠI SAO?)</span><div class="sec-head-ops">${editBtnFor('why_question')}</div></div><div class="nb-body ${uniCls}" ${uniAttrs('why_question', false, whyF.customEn)}>${whyF.val ? hl(whyF.val) : `<span class="none">${isEn ? '— Empty (click to add) —' : '— Chưa có (chạm để nhập) —'}</span>`}</div></div>
          <div class="note-block ans"><div class="nb-title sec-title-row"><span>TRẢ LỜI THỰC CHIẾN &amp; GIẢI PHÁP</span><div class="sec-head-ops">${editBtnFor('actionable_application')}</div></div><div class="nb-body ${uniCls}" ${uniAttrs('actionable_application', false, appF.customEn)}>${appF.val ? hl(appF.val) : `<span class="none">${isEn ? '— Empty (click to add) —' : '— Chưa có (chạm để nhập) —'}</span>`}</div></div>
        </div></div>`
        : `<div class="sec"><div class="note-block accent"><div class="nb-title sec-title-row"><span>ỨNG DỤNG THỰC CHIẾN</span><div class="sec-head-ops">${editBtnFor('actionable_application')}</div></div><div class="nb-body ${uniCls}" ${uniAttrs('actionable_application', false, appF.customEn)}>${appF.val ? hl(appF.val) : `<span class="none">${isEn ? '— Empty (click to add) —' : '— Chưa có (chạm để nhập) —'}</span>`}</div></div></div>`}`;
  }

  return `
    <div class="detail-inner">
      ${showNav ? renderFocusNavBar('knowledge', currentIdx, total) : ''}
      <div class="d-head" data-ctx-record-kind="knowledge" data-ctx-record-id="${kid}">
        <div style="min-width:0;">
          <div class="d-meta">
            <span class="d-id">${kid}</span>
            <span>${escapeHtml(groupLabel(k.source_group))}</span>
            ${k.category ? `<span>${escapeHtml(stripEmoji(k.category).toUpperCase())}</span>` : ''}
            <span>${escapeHtml(k.record_date || '----------')}</span>
            ${ledHtml(k.status_code)}
          </div>
          <div class="d-title ${inline ? 'uni-editable uni-editable-title' : ''}" ${uniAttrs('topic_model', true, topicF.customEn)}>${escapeHtml(topicF.val)}</div>
          <div class="tags">${renderTagPills(k.component_tags, []) || '<span class="mono" style="font-size:12px;color:var(--text-3);">CHƯA GẮN MÃ</span>'}</div>
        </div>
        <div class="d-controls">
          ${renderStatusSwitcher('knowledge', k.id, k.status_code)}
          <div class="d-btns">
            <button class="btn btn-sm" onclick="startDrillForItem('knowledge', '${kid}')" title="Ôn tập sâu mọi ý &amp; câu hỏi của bài này">🎯 Ôn bài này</button>
            <button class="btn btn-sm" onclick="openKnowledgeModal('${kid}')">Sửa</button>
            <button class="btn btn-sm btn-danger" onclick="deleteRecord('knowledge', '${kid}')">Xóa</button>
          </div>
        </div>
      </div>

      ${keyF.val ? `<div class="sec"><div class="note-block accent"><div class="nb-title sec-title-row"><span>TỪ KHÓA LÕI</span><div class="sec-head-ops">${editBtnFor('key_takeaway')}</div></div><div class="nb-body ${uniCls}" style="font-weight:500;" ${uniAttrs('key_takeaway', false, keyF.customEn)}>${hl(keyF.val)}</div></div></div>` : ''}
      <div id="knowledge-bilingual-host-${kid}" class="bilingual-sec-wrap hidden"></div>
      ${body}
      ${noteF.val ? `<div class="sec"><div class="warn safety"><div class="warn-title sec-title-row"><span>LƯU Ý AN TOÀN &amp; THỰC HÀNH</span><div class="sec-head-ops">${editBtnFor('note')}</div></div><div class="warn-body ${uniCls}" ${uniAttrs('note', false, noteF.customEn)}>${hl(noteF.val)}</div></div></div>` : ''}
      ${renderCustomSectionsHtml(k.custom_sections_json || [], `${codePrefix}knw:${k.id}`, k.component_tags || [], inline ? { kind: 'knowledge', id: k.id, pane } : null)}
      ${renderAttachmentSection('knowledge', k.id, k.attachments || [], showDropzone)}
    </div>`;
}

function renderKnowledgeDetail(k, currentIdx = 0, total = 1) {
  const detailEl = document.getElementById('knowledge-detail');
  detailEl.innerHTML = buildKnowledgeDetailHtml(k, { showNav: true, currentIdx, total, showDropzone: true, pane: 'primary' });
  _hydrateInlineSectionEditor(detailEl);
  syncPrimaryEditorTab();
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

