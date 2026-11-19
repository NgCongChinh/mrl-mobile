// ---------------------------------------------------------------------------
// 01 Nhật ký ca sửa chữa
// ---------------------------------------------------------------------------
function getFilteredRepairCases() {
  const { category, status, q } = state.repairFilters;
  const needle = (q || '').trim().toLowerCase().replace(/^#/, '');
  return state.repairCases.filter((c) => {
    if (category !== 'ALL' && c.device_category !== category) return false;
    if (status !== 'ALL' && c.status_code !== status) return false;
    if (needle) {
      const stepsStr = (c.steps || []).map((s) => `${s.symptom} ${s.root_cause} ${s.solution}`).join(' ');
      const hay = `${c.id} ${c.device_category} ${categoryLabel(c.device_category)} ${c.brand_model} ${c.fault_symptom_raw} ${c.root_cause_raw} ${c.solution_raw} ${c.note} ${(c.component_tags || []).join(' ')} ${(c.fault_codes || []).join(' ')} ${stepsStr}`.toLowerCase();
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

function specRow(cls, key, value, c) {
  const body = value ? highlightTagsHtml(value, c.component_tags, c.fault_codes) : '<span class="none">— Chưa ghi nhận —</span>';
  return `<div class="spec-row ${cls}"><div class="spec-k">${key}</div><div class="spec-v">${body}</div></div>`;
}

function buildRepairDetailHtml(c, opts = {}) {
  const { showNav = true, currentIdx = 0, total = 1, showDropzone = true } = opts;
  const steps = c.steps && c.steps.length ? c.steps
    : [{ step_order: 1, symptom: c.fault_symptom_raw || '', root_cause: c.root_cause_raw || '', solution: c.solution_raw || '' }];

  const traceHtml = steps.map((st, i) => `
    <div class="step">
      <div class="step-head">BƯỚC ${pad2(st.step_order || i + 1)}</div>
      <div class="spec">
        ${specRow('sym', 'Hiện tượng / Điểm đo', st.symptom, c)}
        ${specRow('cause', 'Nguyên nhân gốc rễ', st.root_cause, c)}
        ${specRow('sol', 'Cách xử lý & Linh kiện', st.solution, c)}
      </div>
    </div>`).join('');

  return `
    <div class="detail-inner">
      ${showNav ? renderFocusNavBar('repairs', currentIdx, total) : ''}
      <div class="d-head" data-ctx-record-kind="repair" data-ctx-record-id="${escapeHtml(c.id)}">
        <div style="min-width:0;">
          <div class="d-meta">
            <span class="d-id">${escapeHtml(c.id)}</span>
            <span>${escapeHtml(categoryLabel(c.device_category))}</span>
            <span>${escapeHtml(c.record_date || '----------')}</span>
            ${ledHtml(c.status_code)}
          </div>
          <div class="d-title">${escapeHtml(c.brand_model)}</div>
          <div class="tags">${renderTagPills(c.component_tags, c.fault_codes) || '<span class="mono" style="font-size:12px;color:var(--text-3);">CHƯA GẮN MÃ</span>'}</div>
        </div>
        <div class="d-controls">
          ${renderStatusSwitcher('repair', c.id, c.status_code)}
          <div class="d-btns">
            <button class="btn btn-sm" onclick="startDrillForItem('repair', '${escapeHtml(c.id)}')" title="Ôn tập chuyên sâu các bước &amp; lưu ý của ca này">🎯 Ôn bài này</button>
            <button class="btn btn-sm" onclick="openRepairModal('${escapeHtml(c.id)}')">Sửa</button>
            <button class="btn btn-sm btn-danger" onclick="deleteRecord('repair', '${escapeHtml(c.id)}')">Xóa</button>
          </div>
        </div>
      </div>

      <div class="warn">
        <div class="warn-title"><span>LƯU Ý CẤP NGUỒN TEST &amp; CẤU HÌNH VẬN HÀNH</span><a onclick="openRepairModal('${escapeHtml(c.id)}')">Sửa ghi chú</a></div>
        <div class="warn-body">${c.note ? highlightTagsHtml(c.note, c.component_tags, c.fault_codes) : '<span style="color:var(--text-3);font-size:12px;">Chưa có lưu ý cấp nguồn test (24VDC / DC bus, chân jump kích chạy, dòng boot, thông số cài đặt).</span>'}</div>
      </div>

      <div id="repair-bilingual-host-${escapeHtml(c.id)}" class="bilingual-sec-wrap hidden"></div>

      <div class="sec">
        <div class="sec-head">
          <span class="sec-title">QUY TRÌNH BẮT BỆNH &amp; XỬ LÝ (${pad2(steps.length)} BƯỚC)</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <button type="button" class="btn btn-sm" onclick="toggleCurrentRecordBilingual('repair', '${escapeHtml(c.id)}')" title="Đối chiếu Song ngữ Việt ⇄ Anh ca sửa này">🇬🇧 Song ngữ</button>
            <button class="btn btn-sm" onclick="openRepairModal('${escapeHtml(c.id)}', true)">+ Thêm bước kiểm tra</button>
          </div>
        </div>
        <div class="trace">${traceHtml}</div>
      </div>

      ${renderAttachmentSection('repair', c.id, c.attachments || [], showDropzone)}
    </div>`;
}

function renderRepairDetail(c, currentIdx = 0, total = 1) {
  document.getElementById('repair-detail').innerHTML = buildRepairDetailHtml(c, { showNav: true, currentIdx, total, showDropzone: true });
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
  const hl = (t) => highlightTagsHtml(t, k.component_tags);
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

