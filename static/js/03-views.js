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

function _getDisplayColdRowsForCase(c) {
  if (!c) return [];
  const saved = _resolveColdCheckRowsForCase(c).map((r) => ({ ...r, _isDraft: false }));
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
    const resHtml = _coldCheckCellHtml(r.result, c, resPh);

    const itemAttrs = inline
      ? `class="cc-cell cc-cell-item cc-editable" data-cc-idx="${idx}" data-cc-field="item" onmousedown="onColdCheckCellMouseDown('${cid}', ${idx})" onclick="onRepairEditableClick(event, function(){ startColdCheckCellEdit('${cid}', ${idx}, 'item'); })"`
      : `class="cc-cell cc-cell-item"`;
    const resAttrs = inline
      ? `class="cc-cell cc-cell-result cc-editable" data-cc-idx="${idx}" data-cc-field="result" onmousedown="onColdCheckCellMouseDown('${cid}', ${idx})" onclick="onRepairEditableClick(event, function(){ startColdCheckCellEdit('${cid}', ${idx}, 'result'); })"`
      : `class="cc-cell cc-cell-result"`;

    const statusEl = inline
      ? `<button type="button" class="cc-status-btn ${meta.cls}" data-no-i18n="1" data-cc-status-idx="${idx}" onmousedown="event.preventDefault()" onclick="cycleColdCheckStatusInline('${cid}', ${idx}, event)" title="${isEn ? 'Click to cycle status (— / OK / Suspect / Fault)' : 'Chạm để đổi nhanh trạng thái (— / OK / Nghi ngờ / Hỏng)'}">${escapeHtml(meta.label)}</button>`
      : `<span class="cc-status-pill ${meta.cls}" data-no-i18n="1">${escapeHtml(meta.label)}</span>`;

    return `
      <tr class="cc-row cc-st-${st}" data-cc-idx="${idx}" data-cc-id="${escapeHtml(r.id || '')}">
        <td class="cc-td-item"><div ${itemAttrs}>${itemHtml}</div></td>
        <td class="cc-td-result"><div ${resAttrs}>${resHtml}</div></td>
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
  const nextRows = [...curRows, ...toAdd].map((r, i) => ({
    id: r.id || `cc-${i + 1}`,
    item: r.item || '',
    result: r.result || '',
    status: r.status || 'none',
  }));
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
      id: r.id || `cc-${i + 1}`,
      item: String(r.item || '').trim(),
      result: String(r.result || '').trim(),
      status: i === rowIdx ? nextStatus : (r.status || 'none'),
    }))
    .filter((r) => r.item || r.result)
    .map((r, i) => ({ ...r, id: r.id && !String(r.id).startsWith('cc-draft-') ? r.id : `cc-${i + 1}` }));

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
    .filter((r) => !r._isDraft && (String(r.item || '').trim() || String(r.result || '').trim()))
    .map((r, i) => ({
      id: r.id && !String(r.id).startsWith('cc-draft-') ? r.id : `cc-${i + 1}`,
      item: String(r.item || '').trim(),
      result: String(r.result || '').trim(),
      status: r.status || 'none',
    }));

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
    } else {
      _restoreFieldHost(ed, c, ed.origValue);
    }
  }
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
    cold_check_json: _resolveColdCheckRowsForCase(c).map((r) => ({ ...r })),
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
    cold_check_json: (backup.cold_check_json || []).map((r) => ({ ...r })),
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
        return { ...r, [ed.field]: nextVal };
      })
      .filter((r) => String(r.item || '').trim() || String(r.result || '').trim())
      .map((r, i) => ({
        id: r.id && !String(r.id).startsWith('cc-draft-') ? r.id : `cc-${i + 1}`,
        item: String(r.item || '').trim(),
        result: String(r.result || '').trim(),
        status: r.status || 'none',
      }));

    if (state.repairDraftColdRows && state.repairDraftColdRows[ed.caseId]) {
      delete state.repairDraftColdRows[ed.caseId];
    }
    c.cold_check_json = updatedRows;
    c.cold_check_raw = _serializeColdCheckRowsJS(updatedRows);

    if (targetRow._isDraft || bothEmpty) {
      const coldHost = document.querySelector('#repair-detail .rep-cold-host');
      if (coldHost) coldHost.innerHTML = renderRepairColdCheckBlockHtml(c, true);
    } else {
      _restoreFieldHost(ed, c, nextVal);
    }
    if (pane) pane.scrollTop = savedScroll;

    const patchPromise = patchRepairCaseInline(ed.caseId, { cold_check_json: updatedRows }, 'cold', { rollback });
    if (options.nextCell) {
      const targetIdx = Math.min(options.nextCell.rowIdx, Math.max(0, updatedRows.length - 1));
      await startColdCheckCellEdit(options.nextCell.caseId, targetIdx, options.nextCell.field);
    } else if (options.addRowAfter) {
      const insIdx = bothEmpty
        ? Math.min(options.addRowAfter.afterIdx, updatedRows.length)
        : Math.min(options.addRowAfter.afterIdx + 1, updatedRows.length);
      await addColdCheckRowInline(options.addRowAfter.caseId, true, insIdx);
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

  const coldHost = root.querySelector('.rep-cold-host');
  if (coldHost) {
    if (ed && ed.caseId === saved.id && ed.target === 'cold-cell') {
      const displayRows = _getDisplayColdRowsForCase(saved);
      const isEn = _repairIsEnLang();
      const countMetaEl = coldHost.querySelector('.cc-count-meta');
      if (countMetaEl) countMetaEl.innerHTML = _coldCheckCountMetaHtml(displayRows, isEn);
      displayRows.forEach((r, idx) => {
        ['item', 'result'].forEach((fld) => {
          if (ed.rowIdx === idx && ed.field === fld) return;
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
  if (typeof flushUniFieldEdit === 'function') flushUniFieldEdit();
  _flushInlineSectionOnLeave(false);
  state.selectedKnowledgeId = id;
  if (!state.knowledgeListPinned) state.knowledgeListCollapsed = true;
  renderKnowledgeView();
  const pane = document.getElementById('knowledge-detail');
  if (pane) pane.scrollTop = 0;
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

function buildKnowledgeDetailHtml(k, opts = {}) {
  const { showNav = true, currentIdx = 0, total = 1, showDropzone = true, codePrefix = '', pane = 'primary', inline = true } = opts;
  const sopMode = isSopCategory(k.category);
  const kid = escapeHtml(k.id);
  const hl = (t) => highlightTagsHtml(String(t || '').trim(), k.component_tags);
  const uniAttrs = (field, singleLine = false) => inline
    ? `data-uni-edit="1" data-uni-kind="knowledge" data-uni-id="${kid}" data-uni-field="${field}" onclick="startUniFieldEdit('knowledge', '${kid}', '${field}', event, { singleLine: ${singleLine} })"`
    : '';
  const uniCls = inline ? 'uni-editable' : '';
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
        <div class="${uniCls}" ${uniAttrs('core_concept_workflow', false)}>${renderKnowledgeSopListInnerHtml(k, inline)}</div>
      </div>
      ${(k.actionable_application || inline) ? `<div class="sec"><div class="note-block accent"><div class="nb-title">ỨNG DỤNG THỰC CHIẾN</div><div class="nb-body ${uniCls}" ${uniAttrs('actionable_application', false)}>${k.actionable_application ? hl(k.actionable_application) : '<span class="none">— Chưa có (chạm để nhập) —</span>'}</div></div></div>` : ''}`;
  } else {
    body = `
      ${(k.core_concept_workflow || inline) ? `<div class="sec"><div class="sec-head"><span class="sec-title">BẢN CHẤT NGUYÊN LÝ</span></div><div class="nb-body ${uniCls}" ${uniAttrs('core_concept_workflow', false)}>${k.core_concept_workflow ? hl(k.core_concept_workflow) : '<span class="none">— Chưa có (chạm để nhập) —</span>'}</div></div>` : ''}
      ${(k.why_question || k.source_group === 'Automation') ? `
        <div class="sec"><div class="grid2">
          <div class="note-block why"><div class="nb-title">CÂU HỎI PHẢN BIỆN (TẠI SAO?)</div><div class="nb-body ${uniCls}" ${uniAttrs('why_question', false)}>${k.why_question ? hl(k.why_question) : '<span class="none">— Chưa có (chạm để nhập) —</span>'}</div></div>
          <div class="note-block ans"><div class="nb-title">TRẢ LỜI THỰC CHIẾN &amp; GIẢI PHÁP</div><div class="nb-body ${uniCls}" ${uniAttrs('actionable_application', false)}>${k.actionable_application ? hl(k.actionable_application) : '<span class="none">— Chưa có (chạm để nhập) —</span>'}</div></div>
        </div></div>`
        : `<div class="sec"><div class="note-block accent"><div class="nb-title">ỨNG DỤNG THỰC CHIẾN</div><div class="nb-body ${uniCls}" ${uniAttrs('actionable_application', false)}>${k.actionable_application ? hl(k.actionable_application) : '<span class="none">— Chưa có (chạm để nhập) —</span>'}</div></div></div>`}`;
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
          <div class="d-title ${inline ? 'uni-editable uni-editable-title' : ''}" ${uniAttrs('topic_model', true)}>${escapeHtml(k.topic_model)}</div>
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

      ${k.key_takeaway ? `<div class="note-block accent"><div class="nb-title">TỪ KHÓA LÕI</div><div class="nb-body ${uniCls}" style="font-weight:500;" ${uniAttrs('key_takeaway', false)}>${hl(k.key_takeaway)}</div></div>` : ''}
      <div id="knowledge-bilingual-host-${kid}" class="bilingual-sec-wrap hidden"></div>
      ${body}
      ${k.note ? `<div class="sec"><div class="warn safety"><div class="warn-title"><span>LƯU Ý AN TOÀN &amp; THỰC HÀNH</span></div><div class="warn-body ${uniCls}" ${uniAttrs('note', false)}>${hl(k.note)}</div></div></div>` : ''}
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

