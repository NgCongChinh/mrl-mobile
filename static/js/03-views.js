// ---------------------------------------------------------------------------
// 01 Nhật ký ca sửa chữa (Inline Editing + Auto-Save + Bench Workflow)
// ---------------------------------------------------------------------------
const COLD_CHECK_TEMPLATE = [
  '- Ngoại quan (cháy nổ / phồng tụ): ',
  '- Cầu chì / Nguồn vào: ',
  '- Cầu chỉnh lưu / DC Bus: ',
  '- IGBT / MOSFET công suất: ',
  '- Tụ lọc nguồn / Tụ bootstrap: ',
  '- Điện trở kích Gate / Opto: ',
].join('\n');

function appendColdCheckTemplateToTextarea(ta) {
  if (!ta) return;
  const cur = String(ta.value || '');
  let cursorPos = 0;
  if (!cur.trim()) {
    ta.value = COLD_CHECK_TEMPLATE;
    const nl = COLD_CHECK_TEMPLATE.indexOf('\n');
    cursorPos = nl >= 0 ? nl : COLD_CHECK_TEMPLATE.length;
  } else {
    const prefix = cur.endsWith('\n') ? '' : '\n';
    const offset = cur.length + prefix.length;
    ta.value = cur + prefix + COLD_CHECK_TEMPLATE;
    const nl = COLD_CHECK_TEMPLATE.indexOf('\n');
    cursorPos = offset + (nl >= 0 ? nl : COLD_CHECK_TEMPLATE.length);
  }
  if (ta.classList.contains('rep-inline-ta') || ta.id === 'rep-form-cold') {
    _autoResizeRepairTextarea(ta, ta.id === 'rep-form-cold' ? 110 : 88);
  }
  ta.focus({ preventScroll: true });
  try { ta.setSelectionRange(cursorPos, cursorPos); } catch (_) {}
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

function _getDisplayStepsForCase(c) {
  if (!c) return [{ step_order: 1, symptom: '', root_cause: '', solution: '', _placeholder: true }];
  let saved = [];
  if (Array.isArray(c.steps) && c.steps.length) {
    saved = c.steps.map((s, idx) => ({
      step_order: s.step_order || idx + 1,
      symptom: s.symptom || '',
      root_cause: s.root_cause || '',
      solution: s.solution || '',
    }));
  } else if (c.fault_symptom_raw || c.root_cause_raw || c.solution_raw) {
    saved = [{
      step_order: 1,
      symptom: c.fault_symptom_raw || '',
      root_cause: c.root_cause_raw || '',
      solution: c.solution_raw || '',
    }];
  }
  const drafts = (state.repairDraftSteps && Array.isArray(state.repairDraftSteps[c.id]))
    ? state.repairDraftSteps[c.id].map((d) => ({ ...d, _isDraft: true }))
    : [];
  const combined = [...saved, ...drafts];
  if (!combined.length) {
    return [{ step_order: 1, symptom: '', root_cause: '', solution: '', _placeholder: true }];
  }
  return combined.map((s, i) => ({ ...s, step_order: i + 1 }));
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
      const stepsStr = (c.steps || []).map((s) => `${s.symptom} ${s.root_cause} ${s.solution}`).join(' ');
      const hay = `${c.id} ${c.device_category} ${categoryLabel(c.device_category)} ${c.brand_model} ${c.cold_check_raw || ''} ${c.fault_symptom_raw} ${c.root_cause_raw} ${c.solution_raw} ${c.note} ${(c.component_tags || []).join(' ')} ${(c.fault_codes || []).join(' ')} ${stepsStr}`.toLowerCase();
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
    const steps = (c.steps || []).length || 1;
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
          <span class="row-step-count">${steps} bước</span>
        </div>
      </div>`;
  }).join('');

  const curIdx = Math.max(0, filtered.findIndex((c) => c.id === state.selectedRepairId));
  renderRepairDetail(filtered[curIdx], curIdx, filtered.length);
}

function _repairCellBodyHtml(value, c) {
  const cleanVal = String(value || '').trim();
  return cleanVal
    ? highlightTagsHtml(cleanVal, c.component_tags, c.fault_codes)
    : '<span class="none">— Chưa ghi nhận —</span>';
}

function specRow(cls, field, key, value, c, stepIdx, inline = true) {
  const cid = escapeHtml(c.id);
  const body = _repairCellBodyHtml(value, c);
  const attrs = inline
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

function renderRepairColdCheckBlockHtml(c, inline = true) {
  const cleanCold = String(c.cold_check_raw || '').trim();
  const cid = escapeHtml(c.id);
  if (!cleanCold) {
    if (!inline) return '';
    return `
      <div class="rep-collapsed-bar rep-cold-bar">
        <button type="button" class="rep-collapsed-trigger" onclick="startRepairColdCheckEdit('${cid}', false)">+ Thêm ngoại quan &amp; đo nguội (Cold Check)</button>
        <button type="button" class="btn btn-sm rep-tpl-btn" onclick="startRepairColdCheckEdit('${cid}', true)">⚡ Chèn mẫu đo nguội</button>
      </div>`;
  }
  return `
    <div class="cold-check-card">
      <div class="cold-check-head">
        <span>TIẾP NHẬN &amp; ĐO NGUỘI (COLD CHECK)</span>
        <span class="rep-head-acts">
          <span class="rep-save-st" data-save-st="cold"></span>
          ${inline ? `<button type="button" class="rep-mini-edit-btn" onclick="startRepairColdCheckEdit('${cid}', false)">✎ Sửa</button>` : ''}
        </span>
      </div>
      <div class="cold-check-body ${inline ? 'rep-editable' : ''}" data-rep-cold-body="${cid}" ${inline ? `onclick="onRepairEditableClick(event, function(){ startRepairColdCheckEdit('${cid}', false); })"` : ''}>${highlightTagsHtml(cleanCold, c.component_tags, c.fault_codes)}</div>
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
          ${inline ? `<button type="button" class="rep-mini-edit-btn" onclick="startRepairNoteEdit('${cid}')">✎ Sửa</button>` : ''}
        </span>
      </div>
      <div class="warn-body ${inline ? 'rep-editable' : ''}" data-rep-note-body="${cid}" ${inline ? `onclick="onRepairEditableClick(event, function(){ startRepairNoteEdit('${cid}'); })"` : ''}>${highlightTagsHtml(cleanNote, c.component_tags, c.fault_codes)}</div>
    </div>`;
}

function renderRepairStepsSectionInnerHtml(c, inline = true) {
  const steps = _getDisplayStepsForCase(c);
  const cid = escapeHtml(c.id);
  const traceHtml = steps.map((st, i) => `
    <div class="step" data-step-idx="${i}">
      <div class="step-head">
        <span>BƯỚC ${pad2(st.step_order || i + 1)}</span>
        <span class="step-head-acts">
          <span class="rep-save-st" data-save-st="step-${i}"></span>
          ${inline ? `<button type="button" class="step-del-btn" onclick="deleteRepairStepInline('${cid}', ${i})" title="Xóa bước này">✕ Xóa bước</button>` : ''}
        </span>
      </div>
      <div class="spec">
        ${specRow('sym', 'symptom', 'Hiện tượng / Điểm đo', st.symptom, c, i, inline)}
        ${specRow('cause', 'root_cause', 'Nguyên nhân gốc rễ', st.root_cause, c, i, inline)}
        ${specRow('sol', 'solution', 'Cách xử lý & Linh kiện', st.solution, c, i, inline)}
      </div>
    </div>`).join('');

  return `
    <div class="sec-head">
      <span class="sec-title">QUY TRÌNH BẮT BỆNH &amp; XỬ LÝ (${pad2(steps.length)} BƯỚC)</span>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <button type="button" class="btn btn-sm" onclick="toggleCurrentRecordBilingual('repair', '${cid}')" title="Đối chiếu Song ngữ Việt ⇄ Anh ca sửa này">🇬🇧 Song ngữ</button>
        ${inline ? `<button type="button" class="btn btn-sm btn-primary" onclick="addRepairStepInline('${cid}')">+ Thêm bước kiểm tra</button>` : ''}
      </div>
    </div>
    <div class="trace">${traceHtml}</div>`;
}

function buildRepairDetailHtml(c, opts = {}) {
  const { showNav = true, currentIdx = 0, total = 1, showDropzone = true, pane = 'primary' } = opts;
  const inline = opts.inline !== undefined ? opts.inline : (pane !== 'secondary');
  const cid = escapeHtml(c.id);
  const coldHtml = renderRepairColdCheckBlockHtml(c, inline);
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
            <div class="d-title ${inline ? 'rep-editable-title' : ''}" ${inline ? `ondblclick="startRepairTitleEdit('${cid}')" title="Nhấp đúp để sửa tên thiết bị"` : ''}>${escapeHtml(c.brand_model)}</div>
            ${inline ? `<button type="button" class="rep-title-edit-btn" onclick="startRepairTitleEdit('${cid}')" title="Sửa nhanh tên thiết bị" aria-label="Sửa tên thiết bị">✎</button>` : ''}
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

      <div class="sec rep-steps-sec" data-rep-block="steps">
        ${renderRepairStepsSectionInnerHtml(c, inline)}
      </div>

      ${noteHtml ? `<div class="sec rep-note-host" data-rep-block="note">${noteHtml}</div>` : ''}

      ${renderAttachmentSection('repair', c.id, c.attachments || [], showDropzone)}
    </div>`;
}

// ---------------------------------------------------------------------------
// Repair Case Inline Editing + Auto-Save Engine
// ---------------------------------------------------------------------------
function onRepairEditableClick(event, callback) {
  if (!event || !callback) return;
  if (event.target.closest('button, a, input, textarea, select, .itag, .rep-inline-editor')) return;
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
    <div class="d-title rep-editable-title" ondblclick="startRepairTitleEdit('${cid}')" title="Nhấp đúp để sửa tên thiết bị">${escapeHtml(c.brand_model)}</div>
    <button type="button" class="rep-title-edit-btn" onclick="startRepairTitleEdit('${cid}')" title="Sửa nhanh tên thiết bị" aria-label="Sửa tên thiết bị">✎</button>
    <span class="rep-save-st" data-save-st="title"></span>`;
}

function _restoreFieldHost(ed, c, overrideVal = null) {
  if (!ed || !c) return;
  const val = overrideVal !== null ? overrideVal : ed.origValue;
  if (ed.target === 'title') {
    _restoreTitleHost(ed.hostEl, { ...c, brand_model: val });
    return;
  }
  if (ed.target === 'cold') {
    const coldHost = document.querySelector('#repair-detail .rep-cold-host');
    if (coldHost) coldHost.innerHTML = renderRepairColdCheckBlockHtml({ ...c, cold_check_raw: val }, true);
    return;
  }
  if (ed.target === 'note') {
    const noteHost = document.querySelector('#repair-detail .rep-note-host');
    if (noteHost) noteHost.innerHTML = renderRepairNoteBlockHtml({ ...c, note: val }, true);
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

  const isEn = _repairIsEnLang();
  const extraColdBtn = config.target === 'cold'
    ? `<button type="button" class="btn btn-sm rep-tpl-btn" onmousedown="event.preventDefault()" onclick="insertColdCheckTemplateToInline()">⚡ ${isEn ? 'Insert Cold Check Template' : 'Chèn mẫu đo nguội'}</button>`
    : '';

  const saveLbl = isEn ? '✓ Save' : '✓ Lưu';
  const cancelLbl = isEn ? 'Cancel (Esc)' : 'Hủy (Esc)';
  const hintLbl = config.target === 'title'
    ? (isEn ? 'Enter save · Esc cancel' : 'Enter lưu · Esc hủy')
    : (isEn ? 'Ctrl+Enter save · Esc cancel' : 'Ctrl+Enter lưu · Esc hủy');

  hostEl.innerHTML = `
    <div class="rep-inline-editor">
      <textarea class="inp ${config.singleLine ? 'mono rep-inline-title-ta' : ''} rep-inline-ta" rows="${config.rows || 3}" spellcheck="false" placeholder="${escapeHtml(config.placeholder || '')}"></textarea>
      <div class="rep-inline-bar">
        ${extraColdBtn}
        <span class="rep-inline-hint">${hintLbl}</span>
        <span class="rep-save-st" data-save-st="inline-active"></span>
        <div class="rep-inline-btns">
          <button type="button" class="btn btn-sm" onmousedown="event.preventDefault()" onclick="cancelActiveRepairInlineEdit()">${cancelLbl}</button>
          <button type="button" class="btn btn-sm btn-primary" onmousedown="event.preventDefault()" onclick="commitActiveRepairInlineEdit()">${saveLbl}</button>
        </div>
      </div>
    </div>`;

  const ta = hostEl.querySelector('.rep-inline-ta');
  ta.value = config.initialValue || '';
  if (config.useTemplate) {
    appendColdCheckTemplateToTextarea(ta);
  } else {
    _autoResizeRepairTextarea(ta, config.singleLine ? 38 : 72);
    ta.focus({ preventScroll: true });
    try {
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    } catch (_) {}
  }

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

function insertColdCheckTemplateToInline() {
  const ed = state.repairInlineEdit;
  if (!ed || ed.target !== 'cold' || !ed.hostEl) return;
  const ta = ed.hostEl.querySelector('.rep-inline-ta');
  appendColdCheckTemplateToTextarea(ta);
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

async function startRepairColdCheckEdit(caseId, useTemplate = false) {
  const cur = state.repairInlineEdit;
  if (cur && cur.caseId === caseId && cur.target === 'cold') {
    if (useTemplate) insertColdCheckTemplateToInline();
    return;
  }
  if (cur) await commitActiveRepairInlineEdit();
  const c = _getRepairCaseById(caseId);
  const coldHost = document.querySelector('#repair-detail .rep-cold-host');
  if (!c || !coldHost) return;
  const orig = c.cold_check_raw || '';
  if (!orig.trim()) {
    coldHost.innerHTML = `
      <div class="cold-check-card">
        <div class="cold-check-head">
          <span>${_repairIsEnLang() ? 'INTAKE &amp; COLD CHECK' : 'TIẾP NHẬN &amp; ĐO NGUỘI (COLD CHECK)'}</span>
          <span class="rep-head-acts"><span class="rep-save-st" data-save-st="cold"></span></span>
        </div>
        <div class="cold-check-body" data-rep-cold-body="${escapeHtml(c.id)}"></div>
      </div>`;
  }
  const bodyEl = coldHost.querySelector(`[data-rep-cold-body="${CSS.escape(caseId)}"]`);
  if (!bodyEl) return;
  state.repairInlineEdit = { caseId, target: 'cold', stepIdx: -1, field: 'cold_check_raw', origValue: orig, hostEl: bodyEl, saving: false, cancelling: false };
  _mountRepairInlineEditor(bodyEl, {
    target: 'cold',
    rows: 5,
    initialValue: orig,
    useTemplate,
    placeholder: _repairIsEnLang()
      ? 'Visual inspection (burn/bulged caps), fuse, rectifier bridge, DC bus, IGBT/MOSFET...'
      : 'Ghi nhận ngoại quan (cháy nổ/phồng tụ), cầu chì, cầu chỉnh lưu, DC Bus, IGBT/MOSFET...',
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

async function startRepairStepFieldEdit(caseId, stepIdx, field) {
  const cur = state.repairInlineEdit;
  if (cur && cur.caseId === caseId && cur.target === 'step' && cur.stepIdx === stepIdx && cur.field === field) return;
  if (cur) await commitActiveRepairInlineEdit();
  const c = _getRepairCaseById(caseId);
  const hostEl = document.querySelector(`#repair-detail .spec-v[data-step-idx="${stepIdx}"][data-step-field="${field}"]`);
  if (!c || !hostEl) return;
  const steps = _getDisplayStepsForCase(c);
  const st = steps[stepIdx];
  if (!st) return;
  const orig = st[field] || '';
  const phMap = _repairIsEnLang()
    ? { symptom: 'Symptom / Test point...', root_cause: 'Root cause...', solution: 'Solution & Components...' }
    : { symptom: 'Hiện tượng / Điểm đo...', root_cause: 'Nguyên nhân gốc rễ...', solution: 'Cách xử lý & Linh kiện...' };
  state.repairInlineEdit = { caseId, target: 'step', stepIdx, field, origValue: orig, hostEl, saving: false, cancelling: false };
  _mountRepairInlineEditor(hostEl, {
    target: 'step',
    rows: 3,
    initialValue: orig,
    placeholder: phMap[field] || '',
  });
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
  if (c) _restoreFieldHost(ed, c, ed.origValue);
  if (pane) pane.scrollTop = savedScroll;
  if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
  return true;
}

function flushActiveRepairInlineEdit() {
  if (state.repairTagAdd) closeRepairTagInput();
  if (state.repairInlineEdit) return commitActiveRepairInlineEdit();
  return Promise.resolve();
}

function _cloneRepairBackup(c) {
  if (!c) return null;
  return {
    brand_model: c.brand_model || '',
    cold_check_raw: c.cold_check_raw || '',
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
    note: backup.note,
    fault_symptom_raw: backup.fault_symptom_raw,
    root_cause_raw: backup.root_cause_raw,
    solution_raw: backup.solution_raw,
    steps: (backup.steps || []).map((s) => ({ ...s })),
    component_tags: [...(backup.component_tags || [])],
    fault_codes: [...(backup.fault_codes || [])],
  });
}

async function commitActiveRepairInlineEdit() {
  const ed = state.repairInlineEdit;
  if (!ed || ed.saving || ed.cancelling) return;
  const ta = ed.hostEl?.querySelector('.rep-inline-ta');
  const nextVal = String(ta ? ta.value : '').trim();
  const origVal = String(ed.origValue || '').trim();
  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;

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
  } else if (ed.target === 'cold') {
    c.cold_check_raw = nextVal;
    patchPayload = { cold_check_raw: nextVal };
    statusKey = 'cold';
    _restoreFieldHost(ed, c, nextVal);
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
    cEl.textContent = `${(saved.steps || []).length || 1} bước`;
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

  if (!(ed && ed.caseId === saved.id && ed.target === 'cold')) {
    const coldHost = root.querySelector('.rep-cold-host');
    if (coldHost) coldHost.innerHTML = renderRepairColdCheckBlockHtml(saved, true);
  }

  if (!(ed && ed.caseId === saved.id && ed.target === 'note')) {
    const noteHost = root.querySelector('.rep-note-host');
    if (noteHost) noteHost.innerHTML = renderRepairNoteBlockHtml(saved, true);
  }

  const stepsSec = root.querySelector('.rep-steps-sec');
  if (stepsSec) {
    if (ed && ed.caseId === saved.id && ed.target === 'step') {
      // Update only non-edited cells & header count so the active textarea never loses focus
      const displaySteps = _getDisplayStepsForCase(saved);
      const secTitle = stepsSec.querySelector('.sec-head .sec-title');
      if (secTitle) {
        delete secTitle.dataset.viHtmlOrig;
        delete secTitle.dataset.viTextOrig;
        secTitle.textContent = `QUY TRÌNH BẮT BỆNH & XỬ LÝ (${pad2(displaySteps.length)} BƯỚC)`;
      }
      displaySteps.forEach((st, idx) => {
        ['symptom', 'root_cause', 'solution'].forEach((fld) => {
          if (ed.stepIdx === idx && ed.field === fld) return;
          const cell = stepsSec.querySelector(`.spec-v[data-step-idx="${idx}"][data-step-field="${fld}"]`);
          if (cell) {
            delete cell.dataset.viHtmlOrig;
            delete cell.dataset.viTextOrig;
            cell.innerHTML = _repairCellBodyHtml(st[fld], saved);
          }
        });
      });
    } else if (opts.reRenderSteps !== false) {
      stepsSec.innerHTML = renderRepairStepsSectionInnerHtml(saved, true);
    }
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
          _syncRepairDetailBlocksAfterPatch(cur, { reRenderSteps: true });
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
  if (state.repairInlineEdit) await commitActiveRepairInlineEdit();
  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;

  const displaySteps = _getDisplayStepsForCase(c);
  const lastStep = displaySteps[displaySteps.length - 1];
  const lastEmpty = lastStep && !String(lastStep.symptom || '').trim() && !String(lastStep.root_cause || '').trim() && !String(lastStep.solution || '').trim();

  let targetIdx = displaySteps.length - 1;
  if (!lastEmpty) {
    state.repairDraftSteps[caseId] = state.repairDraftSteps[caseId] || [];
    state.repairDraftSteps[caseId].push({
      step_order: displaySteps.length + 1,
      symptom: '',
      root_cause: '',
      solution: '',
      _isDraft: true,
    });
    targetIdx = displaySteps.length;
    const stepsSec = document.querySelector('#repair-detail .rep-steps-sec');
    if (stepsSec) {
      stepsSec.innerHTML = renderRepairStepsSectionInnerHtml(c, true);
    }
  }
  if (pane) pane.scrollTop = savedScroll;
  await startRepairStepFieldEdit(caseId, targetIdx, 'symptom');
  const stepEl = document.querySelector(`#repair-detail .step[data-step-idx="${targetIdx}"]`);
  if (stepEl && typeof stepEl.scrollIntoView === 'function') {
    stepEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  if (_repairIsEnLang() && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

async function deleteRepairStepInline(caseId, stepIdx) {
  const cur = state.repairInlineEdit;
  if (cur && cur.caseId === caseId && cur.target === 'step' && cur.stepIdx === stepIdx) {
    cur.cancelling = true;
    state.repairInlineEdit = null;
  } else if (cur) {
    await commitActiveRepairInlineEdit();
  }
  const c = _getRepairCaseById(caseId);
  if (!c) return;
  const displaySteps = _getDisplayStepsForCase(c);
  const target = displaySteps[stepIdx];
  if (!target) return;

  const hasText = Boolean(String(target.symptom || '').trim() || String(target.root_cause || '').trim() || String(target.solution || '').trim());
  const isEn = _repairIsEnLang();
  if (hasText && !await uiConfirm(isEn ? `Delete STEP ${pad2(stepIdx + 1)}?` : `Xóa BƯỚC ${pad2(stepIdx + 1)} này?`)) {
    return;
  }

  const pane = document.getElementById('repair-detail');
  const savedScroll = pane ? pane.scrollTop : 0;

  if (target._placeholder) {
    showToast(isEn ? 'Step 01 is empty and ready to edit' : 'Bước 01 đang trống, chạm để nhập nội dung', 'info');
    return;
  }

  if (target._isDraft) {
    const savedCount = Math.max(0, displaySteps.length - (state.repairDraftSteps[caseId]?.length || 0));
    const draftIdx = stepIdx - savedCount;
    if (state.repairDraftSteps[caseId] && draftIdx >= 0) {
      state.repairDraftSteps[caseId].splice(draftIdx, 1);
    }
    const stepsSec = document.querySelector('#repair-detail .rep-steps-sec');
    if (stepsSec) stepsSec.innerHTML = renderRepairStepsSectionInnerHtml(c, true);
    if (pane) pane.scrollTop = savedScroll;
    if (isEn && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
    return;
  }

  const rollback = _cloneRepairBackup(c);
  const nextSaved = displaySteps
    .filter((_, i) => i !== stepIdx)
    .filter((s) => !s._isDraft && !s._placeholder)
    .map((s, i) => ({
      step_order: i + 1,
      symptom: s.symptom || '',
      root_cause: s.root_cause || '',
      solution: s.solution || '',
    }));

  c.steps = nextSaved;
  if (state.repairDraftSteps && state.repairDraftSteps[caseId]) {
    delete state.repairDraftSteps[caseId];
  }
  await patchRepairCaseInline(caseId, { steps: nextSaved }, 'step-0', { reRenderSteps: true, rollback });
  if (pane) pane.scrollTop = savedScroll;
  showToast(isEn ? `Deleted step ${pad2(stepIdx + 1)}` : `Đã xóa Bước ${pad2(stepIdx + 1)}`, 'success');
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
  _flushInlineSectionOnLeave(false);
  state.selectedKnowledgeId = id;
  if (!state.knowledgeListPinned) state.knowledgeListCollapsed = true;
  renderKnowledgeView();
  const pane = document.getElementById('knowledge-detail');
  if (pane) pane.scrollTop = 0;
}
function toggleSopStep(itemId, idx) {
  const key = `${itemId}:${idx}`;
  state.sopChecked[key] = !state.sopChecked[key];
  const filtered = getFilteredKnowledgeItems();
  const curIdx = Math.max(0, filtered.findIndex((k) => k.id === state.selectedKnowledgeId));
  const sel = filtered[curIdx];
  if (sel) renderKnowledgeDetail(sel, curIdx, filtered.length);
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

function buildKnowledgeDetailHtml(k, opts = {}) {
  const { showNav = true, currentIdx = 0, total = 1, showDropzone = true, codePrefix = '', pane = 'primary', inline = true } = opts;
  const sopMode = isSopCategory(k.category);
  const hl = (t) => highlightTagsHtml(String(t || '').trim(), k.component_tags);
  let body = '';

  if (sopMode) {
    const steps = parseSopSteps(k.core_concept_workflow);
    const done = steps.filter((_, i) => state.sopChecked[`${k.id}:${i}`]).length;
    body = `
      <div class="sec">
        <div class="sec-head">
          <span class="sec-title">QUY TRÌNH ĐO &amp; SỬA (SOP)</span>
          <span class="sop-count">${done} / ${steps.length} HOÀN THÀNH</span>
        </div>
        <div>${steps.length ? steps.map((s, i) => {
          const ck = Boolean(state.sopChecked[`${k.id}:${i}`]);
          return `<div class="sop-row ${ck ? 'done' : ''}" onclick="toggleSopStep('${escapeHtml(k.id)}', ${i})">
            <input type="checkbox" ${ck ? 'checked' : ''} />
            <span class="sop-num">BƯỚC ${escapeHtml(s.num)}</span>
            <div class="sop-txt">${hl(s.text)}</div></div>`;
        }).join('') : '<div class="empty">CHƯA CÓ CÁC BƯỚC CHI TIẾT</div>'}</div>
      </div>
      ${k.actionable_application ? `<div class="sec"><div class="note-block accent"><div class="nb-title">ỨNG DỤNG THỰC CHIẾN</div><div class="nb-body">${hl(k.actionable_application)}</div></div></div>` : ''}`;
  } else {
    body = `
      ${k.core_concept_workflow ? `<div class="sec"><div class="sec-head"><span class="sec-title">BẢN CHẤT NGUYÊN LÝ</span></div><div class="nb-body">${hl(k.core_concept_workflow)}</div></div>` : ''}
      ${k.why_question ? `
        <div class="sec"><div class="grid2">
          <div class="note-block why"><div class="nb-title">CÂU HỎI PHẢN BIỆN (TẠI SAO?)</div><div class="nb-body">${hl(k.why_question)}</div></div>
          <div class="note-block ans"><div class="nb-title">TRẢ LỜI THỰC CHIẾN &amp; GIẢI PHÁP</div><div class="nb-body">${k.actionable_application ? hl(k.actionable_application) : '<span style="color:var(--text-3);">— Chưa có —</span>'}</div></div>
        </div></div>`
        : (k.actionable_application ? `<div class="sec"><div class="note-block accent"><div class="nb-title">ỨNG DỤNG THỰC CHIẾN</div><div class="nb-body">${hl(k.actionable_application)}</div></div></div>` : '')}`;
  }

  return `
    <div class="detail-inner">
      ${showNav ? renderFocusNavBar('knowledge', currentIdx, total) : ''}
      <div class="d-head" data-ctx-record-kind="knowledge" data-ctx-record-id="${escapeHtml(k.id)}">
        <div style="min-width:0;">
          <div class="d-meta">
            <span class="d-id">${escapeHtml(k.id)}</span>
            <span>${escapeHtml(groupLabel(k.source_group))}</span>
            ${k.category ? `<span>${escapeHtml(stripEmoji(k.category).toUpperCase())}</span>` : ''}
            <span>${escapeHtml(k.record_date || '----------')}</span>
            ${ledHtml(k.status_code)}
          </div>
          <div class="d-title">${escapeHtml(k.topic_model)}</div>
          <div class="tags">${renderTagPills(k.component_tags, []) || '<span class="mono" style="font-size:12px;color:var(--text-3);">CHƯA GẮN MÃ</span>'}</div>
        </div>
        <div class="d-controls">
          ${renderStatusSwitcher('knowledge', k.id, k.status_code)}
          <div class="d-btns">
            <button class="btn btn-sm" onclick="startDrillForItem('knowledge', '${escapeHtml(k.id)}')" title="Ôn tập sâu mọi ý &amp; câu hỏi của bài này">🎯 Ôn bài này</button>
            <button class="btn btn-sm" onclick="openKnowledgeModal('${escapeHtml(k.id)}')">Sửa</button>
            <button class="btn btn-sm btn-danger" onclick="deleteRecord('knowledge', '${escapeHtml(k.id)}')">Xóa</button>
          </div>
        </div>
      </div>

      ${k.key_takeaway ? `<div class="note-block accent"><div class="nb-title">TỪ KHÓA LÕI</div><div class="nb-body" style="font-weight:500;">${hl(k.key_takeaway)}</div></div>` : ''}
      <div id="knowledge-bilingual-host-${escapeHtml(k.id)}" class="bilingual-sec-wrap hidden"></div>
      ${body}
      ${k.note ? `<div class="sec"><div class="warn safety"><div class="warn-title"><span>LƯU Ý AN TOÀN &amp; THỰC HÀNH</span></div><div class="warn-body">${hl(k.note)}</div></div></div>` : ''}
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

