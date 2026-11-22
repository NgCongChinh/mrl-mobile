// ---------------------------------------------------------------------------
// Thêm / Sửa / Xóa dữ liệu
// ---------------------------------------------------------------------------
async function quickUpdateStatus(parentType, id, statusCode) {
  const endpointMap = {
    repair: `/api/repair-cases/${encodeURIComponent(id)}/status`,
    knowledge: `/api/knowledge-items/${encodeURIComponent(id)}/status`,
    plc: `/api/plc-notes/${encodeURIComponent(id)}/status`,
    network: `/api/network-notes/${encodeURIComponent(id)}/status`,
  };
  const stateListMap = {
    repair: 'repairCases',
    knowledge: 'knowledgeItems',
    plc: 'plcNotes',
    network: 'networkNotes',
  };
  const url = endpointMap[parentType];
  if (typeof flushUniFieldEdit === 'function') await flushUniFieldEdit();
  if (state.inlineSectionEdit) await _flushInlineSectionOnLeave(false);
  if (parentType === 'repair' && typeof flushActiveRepairInlineEdit === 'function') await flushActiveRepairInlineEdit();
  try {
    const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status_code: statusCode }) });
    if (!res.ok) throw new Error('Cập nhật trạng thái thất bại');
    const u = await res.json();
    const listName = stateListMap[parentType];
    if (listName && Array.isArray(state[listName])) {
      const idx = state[listName].findIndex((x) => x.id === u.id);
      if (idx >= 0) state[listName][idx] = u;
    }
    showToast(`${id} → ${(STATUS_META[u.status_code] || STATUS_META.unclassified).label}`, 'success');
    renderHeaderStats();
    if (state.activeTab === 'repairs') renderRepairsView();
    else if (state.activeTab === 'knowledge') renderKnowledgeView();
    else if (state.activeTab === 'plc') renderPlcView();
    else if (state.activeTab === 'network') renderNetworkView();
    else if (state.activeTab === 'flashcards') buildFlashcardDeck(true);
    syncPrimaryEditorTab();
    if (state.splitMode) renderPane2();
  } catch (err) { showToast(err.message, 'error'); }
}
async function deleteRecord(parentType, id) {
  const labelMap = { repair: 'ca sửa chữa', knowledge: 'mục kiến thức', plc: 'bài PLC', network: 'cấu hình mạng' };
  if (!await uiConfirm(`Xóa ${labelMap[parentType] || 'bản ghi'} ${id}?`)) return;
  if (state.inlineSectionEdit && state.inlineSectionEdit.kind === parentType && state.inlineSectionEdit.id === id) {
    clearTimeout(_inlineSecSaveTimer);
    state.inlineSectionEdit = null;
  }
  if (state.uniInlineEdit && state.uniInlineEdit.kind === parentType && state.uniInlineEdit.id === id) {
    state.uniInlineEdit.cancelling = true;
    state.uniInlineEdit = null;
  }
  if (parentType === 'repair') {
    if (state.repairInlineEdit && state.repairInlineEdit.caseId === id) {
      state.repairInlineEdit.cancelling = true;
      state.repairInlineEdit = null;
    }
    if (state.repairTagAdd && state.repairTagAdd.caseId === id) state.repairTagAdd = null;
    if (state.repairDraftSteps) delete state.repairDraftSteps[id];
    if (state.repairDraftColdRows) delete state.repairDraftColdRows[id];
  }
  const endpointMap = {
    repair: `/api/repair-cases/${encodeURIComponent(id)}`,
    knowledge: `/api/knowledge-items/${encodeURIComponent(id)}`,
    plc: `/api/plc-notes/${encodeURIComponent(id)}`,
    network: `/api/network-notes/${encodeURIComponent(id)}`,
  };
  try {
    const res = await fetch(endpointMap[parentType], { method: 'DELETE' });
    if (!res.ok) throw new Error('Xóa thất bại');
    if (typeof removeDeletedFromTabsAndPane2 === 'function') removeDeletedFromTabsAndPane2(parentType, id);
    showToast(`Đã xóa ${id}`, 'success');
    await fetchBootstrap(false);
  } catch (err) { showToast(err.message, 'error'); }
}

function _modalColdStatusMeta(status) {
  const isEn = typeof state !== 'undefined' && state.appLang === 'en';
  if (typeof _coldCheckStatusMeta === 'function') {
    return _coldCheckStatusMeta(status, isEn);
  }
  const s = String(status || 'none').toLowerCase();
  if (s === 'ok') return { code: 'ok', label: '🟢 OK', next: 'suspect', cls: 'cc-st-badge-ok' };
  if (s === 'suspect') return { code: 'suspect', label: isEn ? '🟡 Suspect' : '🟡 Nghi ngờ', next: 'fault', cls: 'cc-st-badge-suspect' };
  if (s === 'fault') return { code: 'fault', label: isEn ? '🔴 Fault' : '🔴 Hỏng', next: 'none', cls: 'cc-st-badge-fault' };
  return { code: 'none', label: '—', next: 'ok', cls: 'cc-st-badge-none' };
}

function _modalRenderCapItemHtml(cap = {}, isEn = false) {
  const unit = window.MRLCoreStore?.normalizeCapUnit ? window.MRLCoreStore.normalizeCapUnit(cap.cap_unit || 'µF') : (cap.cap_unit || 'µF');
  return `
    <div class="rep-modal-cap-row" data-cap-id="${escapeHtml(cap.id || '')}">
      <input type="text" class="inp cc-cap-spec modal-cap-spec" spellcheck="false" placeholder="${isEn ? 'e.g. 470µF/50V' : 'VD: 470µF/50V'}" value="${escapeHtml(cap.spec || '')}" />
      <div class="cc-cap-meas-col">
        <div class="cc-cap-val-group">
          <input type="text" class="inp cc-cap-val modal-cap-val mono" spellcheck="false" placeholder="${isEn ? 'Meas' : 'Đo'}" value="${escapeHtml(cap.cap_val || '')}" />
          <button type="button" class="cc-cap-unit-btn modal-cap-unit" tabindex="-1" data-cap-unit="${escapeHtml(unit)}" data-no-i18n="1" onclick="cycleModalCapUnit(this)">${escapeHtml(unit)}</button>
        </div>
        <span class="cc-cap-sep">|</span>
        <div class="cc-cap-esr-group">
          <span class="cc-cap-esr-lbl">ESR</span>
          <input type="text" class="inp cc-cap-esr modal-cap-esr mono" spellcheck="false" placeholder="0.00" value="${escapeHtml(cap.esr_val || '')}" />
          <span class="cc-cap-ohm">Ω</span>
        </div>
        <input type="text" class="inp cc-cap-note modal-cap-note" spellcheck="false" placeholder="${isEn ? 'note...' : 'ghi chú...'}" value="${escapeHtml(cap.note || '')}" />
        <button type="button" class="cc-cap-del-btn" tabindex="-1" onclick="this.closest('.rep-modal-cap-row').remove()" title="${isEn ? 'Remove cap' : 'Xóa tụ'}">×</button>
      </div>
    </div>`;
}

function addModalCapSubRow(btn, focusSpec = true) {
  const wrap = btn?.closest('.rep-modal-cap-wrap')?.querySelector('.rep-modal-cap-list');
  if (!wrap) return;
  const isEn = typeof state !== 'undefined' && state.appLang === 'en';
  const tmp = document.createElement('div');
  tmp.innerHTML = _modalRenderCapItemHtml({ id: `cap-${wrap.children.length + 1}`, cap_unit: 'µF' }, isEn).trim();
  const el = tmp.firstElementChild;
  if (!el) return;
  wrap.appendChild(el);
  if (focusSpec) el.querySelector('.modal-cap-spec')?.focus();
}

function cycleModalCapUnit(btn) {
  const units = ['µF', 'mF', 'nF'];
  const cur = String(btn?.dataset?.capUnit || btn?.textContent || 'µF').trim();
  const next = units[(Math.max(0, units.indexOf(cur)) + 1) % units.length];
  if (btn) {
    btn.dataset.capUnit = next;
    btn.textContent = next;
  }
}

function _maybeUpgradeModalRowToCaps(rowEl) {
  if (!rowEl || rowEl.querySelector('.rep-modal-cap-wrap')) return;
  const itemVal = String(rowEl.querySelector('.rep-cc-item-inp')?.value || '').trim();
  const isCap = window.MRLCoreStore?.isCapacitorColdRow
    ? window.MRLCoreStore.isCapacitorColdRow(itemVal)
    : /tụ|capacitor|\bcap\b|\besr\b/i.test(itemVal);
  if (!isCap) return;
  const ta = rowEl.querySelector('.rep-cc-res-inp');
  const rawRes = ta ? ta.value : '';
  const caps = (rawRes && window.MRLCoreStore?.parseCapacitorLines)
    ? window.MRLCoreStore.parseCapacitorLines(rawRes)
    : [];
  const isEn = typeof state !== 'undefined' && state.appLang === 'en';
  const capWrap = document.createElement('div');
  capWrap.className = 'rep-modal-cap-wrap';
  capWrap.setAttribute('data-no-i18n', '1');
  capWrap.innerHTML = `
    <div class="rep-modal-cap-list">${(caps.length ? caps : [{ id: 'cap-1', cap_unit: 'µF' }]).map((c) => _modalRenderCapItemHtml(c, isEn)).join('')}</div>
    <button type="button" class="cc-cap-add-btn" onclick="addModalCapSubRow(this, true)">${isEn ? '+ Add cap' : '+ Thêm tụ'}</button>`;
  if (ta) ta.replaceWith(capWrap);
}

function addModalColdCheckRow(rowData = { id: '', item: '', result: '', status: 'none' }, focusField = null) {
  const container = document.getElementById('rep-form-cold-container');
  if (!container) return null;
  const isEn = typeof state !== 'undefined' && state.appLang === 'en';
  const st = ['none', 'ok', 'suspect', 'fault'].includes(String(rowData?.status || 'none'))
    ? String(rowData.status)
    : 'none';
  const meta = _modalColdStatusMeta(st);
  const isCap = window.MRLCoreStore?.isCapacitorColdRow
    ? window.MRLCoreStore.isCapacitorColdRow(rowData?.item, rowData?.caps)
    : ((Array.isArray(rowData?.caps) && rowData.caps.length > 0) || /tụ|capacitor|\bcap\b|\besr\b/i.test(String(rowData?.item || '')));

  let resHtml = `<textarea class="inp rep-cc-res-inp" rows="1" spellcheck="false" placeholder="${isEn ? 'Measurement / Result...' : 'Thông số đo / Kết quả...'}">${escapeHtml(rowData?.result || '')}</textarea>`;
  if (isCap) {
    const caps = Array.isArray(rowData?.caps)
      ? rowData.caps
      : ((rowData?.result && window.MRLCoreStore?.parseCapacitorLines) ? window.MRLCoreStore.parseCapacitorLines(rowData.result) : []);
    resHtml = `
      <div class="rep-modal-cap-wrap" data-no-i18n="1">
        <div class="rep-modal-cap-list">${caps.map((cap) => _modalRenderCapItemHtml(cap, isEn)).join('')}</div>
        <button type="button" class="cc-cap-add-btn" onclick="addModalCapSubRow(this, true)">${isEn ? '+ Add cap' : '+ Thêm tụ'}</button>
      </div>`;
  }

  const row = document.createElement('div');
  row.className = `rep-modal-cc-row cc-st-${st} ${isCap ? 'has-caps' : ''}`;
  row.dataset.ccId = rowData?.id || '';
  row.dataset.ccStatus = st;
  row.innerHTML = `
    <input type="text" class="inp rep-cc-item-inp" spellcheck="false" placeholder="${isEn ? 'Component (e.g. Cap, Opto)...' : 'Thành phần (VD: Tụ lọc, Opto)...'}" value="${escapeHtml(rowData?.item || '')}" />
    ${resHtml}
    <button type="button" class="cc-status-btn ${meta.cls}" data-no-i18n="1" onclick="cycleModalColdCheckStatus(this)" title="${isEn ? 'Click to cycle status' : 'Chạm để đổi trạng thái'}">${escapeHtml(meta.label)}</button>
    <button type="button" class="cc-del-btn modal-cc-del" onclick="this.closest('.rep-modal-cc-row').remove()" title="${isEn ? 'Delete row' : 'Xóa dòng'}" aria-label="${isEn ? 'Delete row' : 'Xóa dòng'}">×</button>`;
  container.appendChild(row);

  const itemInp = row.querySelector('.rep-cc-item-inp');
  if (itemInp) {
    itemInp.addEventListener('blur', () => _maybeUpgradeModalRowToCaps(row));
  }
  const ta = row.querySelector('.rep-cc-res-inp');
  if (ta && typeof _autoResizeRepairTextarea === 'function') {
    _autoResizeRepairTextarea(ta, 34);
    ta.addEventListener('input', () => _autoResizeRepairTextarea(ta, 34));
  }
  if (focusField === 'item') itemInp?.focus();
  else if (focusField === 'result') (ta || row.querySelector('.modal-cap-spec'))?.focus();
  return row;
}

function cycleModalColdCheckStatus(btn) {
  const row = btn?.closest('.rep-modal-cc-row');
  if (!row) return;
  const cur = row.dataset.ccStatus || 'none';
  const next = _modalColdStatusMeta(cur).next;
  const meta = _modalColdStatusMeta(next);
  row.dataset.ccStatus = meta.code;
  row.classList.remove('cc-st-none', 'cc-st-ok', 'cc-st-suspect', 'cc-st-fault');
  row.classList.add(`cc-st-${meta.code}`);
  btn.className = `cc-status-btn ${meta.cls}`;
  btn.textContent = meta.label;
}

function collectModalColdCheckRows() {
  const rows = [];
  document.querySelectorAll('#rep-form-cold-container .rep-modal-cc-row').forEach((row) => {
    const item = String(row.querySelector('.rep-cc-item-inp')?.value || '').trim();
    const status = row.dataset.ccStatus || 'none';
    const rawId = String(row.dataset.ccId || '').trim();
    const capWrap = row.querySelector('.rep-modal-cap-wrap');
    if (capWrap) {
      const caps = [];
      capWrap.querySelectorAll('.rep-modal-cap-row').forEach((cr) => {
        const spec = String(cr.querySelector('.modal-cap-spec')?.value || '').trim();
        const capVal = String(cr.querySelector('.modal-cap-val')?.value || '').trim();
        const capUnit = String(cr.querySelector('.modal-cap-unit')?.dataset?.capUnit || 'µF').trim() || 'µF';
        const esrVal = String(cr.querySelector('.modal-cap-esr')?.value || '').trim();
        const note = String(cr.querySelector('.modal-cap-note')?.value || '').trim();
        if (!spec && !capVal && !esrVal && !note) return;
        caps.push({ id: `cap-${caps.length + 1}`, spec, cap_val: capVal, cap_unit: capUnit, esr_val: esrVal, note });
      });
      const result = window.MRLCoreStore?.serializeCapsToResult ? window.MRLCoreStore.serializeCapsToResult(caps) : '';
      if (!item && !caps.length) return;
      rows.push({
        id: rawId || `cc-${rows.length + 1}`,
        item,
        result,
        caps,
        status: ['none', 'ok', 'suspect', 'fault'].includes(status) ? status : 'none',
      });
      return;
    }

    const result = String(row.querySelector('.rep-cc-res-inp')?.value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!item && !result) return;
    rows.push({
      id: rawId || `cc-${rows.length + 1}`,
      item,
      result,
      status: ['none', 'ok', 'suspect', 'fault'].includes(status) ? status : 'none',
    });
  });
  return rows;
}

function insertColdCheckTemplateToModal() {
  const isEn = typeof state !== 'undefined' && state.appLang === 'en';
  const existingKeys = new Set(
    Array.from(document.querySelectorAll('#rep-form-cold-container .rep-cc-item-inp'))
      .map((inp) => String(inp.value || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const templates = typeof COLD_CHECK_TEMPLATE_ROWS !== 'undefined'
    ? COLD_CHECK_TEMPLATE_ROWS
    : [
      { vi: 'Ngoại quan', en: 'Visual Inspection' },
      { vi: 'Cầu chì / Nguồn vào', en: 'Fuse / Input Power' },
      { vi: 'Cầu chỉnh lưu / DC Bus', en: 'Rectifier Bridge / DC Bus' },
      { vi: 'Tụ lọc / ESR', en: 'Filter Capacitors / ESR' },
      { vi: 'IGBT / MOSFET', en: 'IGBT / MOSFET' },
      { vi: 'Driver / Opto', en: 'Driver / Optocoupler' },
    ];
  let firstRow = null;
  let added = 0;
  templates.forEach((tpl) => {
    if (existingKeys.has(tpl.vi.toLowerCase()) || existingKeys.has(tpl.en.toLowerCase())) return;
    const label = isEn ? tpl.en : tpl.vi;
    existingKeys.add(label.toLowerCase());
    const row = addModalColdCheckRow({ id: '', item: label, result: '', status: 'none' });
    if (!firstRow) firstRow = row;
    added += 1;
  });
  if (!added) {
    showToast(isEn ? 'All standard cold check rows already exist' : 'Đã có đủ 6 hạng mục mẫu đo nguội', 'info');
    return;
  }
  firstRow?.querySelector('.rep-cc-res-inp')?.focus();
}

function openRepairModal(caseId = null, appendBlankStep = false) {
  if (typeof flushActiveRepairInlineEdit === 'function') flushActiveRepairInlineEdit();
  const modal = document.getElementById('repair-modal');
  const form = document.getElementById('repair-form');
  const title = document.getElementById('repair-modal-title').querySelector('span');
  const container = document.getElementById('rep-form-steps-container');
  const coldContainer = document.getElementById('rep-form-cold-container');
  const advDetails = document.getElementById('rep-form-advanced');
  const tagsWrap = document.getElementById('rep-form-tags-wrap');
  const coldLbl = document.getElementById('rep-form-cold-lbl');
  const submitBtn = document.getElementById('rep-form-submit-btn');
  container.innerHTML = '';
  if (coldContainer) coldContainer.innerHTML = '';
  if (caseId) {
    const c = state.repairCases.find((x) => x.id === caseId);
    if (!c) return;
    form?.classList.remove('mode-create');
    form?.classList.add('mode-edit');
    title.textContent = `CHỈNH SỬA CA SỬA CHỮA · ${c.id}`;
    document.getElementById('rep-form-id').value = c.id;
    document.getElementById('rep-form-category').value = c.device_category;
    document.getElementById('rep-form-model').value = c.brand_model || '';
    document.getElementById('rep-form-date').value = c.record_date || '';
    document.getElementById('rep-form-status').value = c.status_code || 'review';
    const coldRows = (window.MRLCoreStore && typeof window.MRLCoreStore.resolveColdCheckRows === 'function')
      ? window.MRLCoreStore.resolveColdCheckRows(c.cold_check_json, c.cold_check_raw)
      : (Array.isArray(c.cold_check_json) ? c.cold_check_json : []);
    coldRows.forEach((r) => addModalColdCheckRow(r));
    document.getElementById('rep-form-note').value = c.note || '';
    document.getElementById('rep-form-tags').value = (c.component_tags || []).join(', ');
    document.getElementById('rep-form-faults').value = (c.fault_codes || []).join(', ');
    if (advDetails) advDetails.open = true;
    tagsWrap?.classList.remove('hidden');
    if (coldLbl) coldLbl.textContent = 'Tiếp nhận & Đo nguội (Cold Check)';
    if (submitBtn) submitBtn.textContent = 'Lưu ca sửa chữa';
    const steps = c.steps && c.steps.length ? c.steps : [{ symptom: c.fault_symptom_raw, root_cause: c.root_cause_raw, solution: c.solution_raw }];
    steps.forEach((s) => addRepairStepRow(s));
    if (appendBlankStep) addRepairStepRow({ symptom: '', root_cause: '', solution: '' });
  } else {
    form?.classList.remove('mode-edit');
    form?.classList.add('mode-create');
    title.textContent = 'THÊM CA SỬA CHỮA MỚI';
    document.getElementById('rep-form-id').value = '';
    document.getElementById('rep-form-category').value = state.repairFilters.category !== 'ALL' ? state.repairFilters.category : 'VFD';
    document.getElementById('rep-form-model').value = '';
    document.getElementById('rep-form-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('rep-form-status').value = 'researching';
    document.getElementById('rep-form-note').value = '';
    document.getElementById('rep-form-tags').value = '';
    document.getElementById('rep-form-faults').value = '';
    if (advDetails) advDetails.open = false;
    tagsWrap?.classList.add('hidden');
    if (coldLbl) coldLbl.textContent = 'Tiếp nhận & Đo nguội ban đầu (tùy chọn)';
    if (submitBtn) submitBtn.textContent = 'Tạo ca & Bắt đầu đo';
    addRepairStepRow({ symptom: '', root_cause: '', solution: '' });
  }
  modal.classList.remove('hidden');
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
  if (!caseId) {
    setTimeout(() => document.getElementById('rep-form-model')?.focus(), 40);
  }
}
function closeRepairModal() { document.getElementById('repair-modal').classList.add('hidden'); }

function addRepairStepRow(step = { symptom: '', root_cause: '', solution: '' }) {
  const container = document.getElementById('rep-form-steps-container');
  const row = document.createElement('div');
  row.className = 'rep-step-row step-edit';
  row.innerHTML = `
    <div class="step-edit-head"><span class="step-badge">BƯỚC</span><button type="button" onclick="removeRepairStepRow(this)">Xóa</button></div>
    <div class="fgrid c3">
      <div><label class="lbl">Hiện tượng / Điểm đo</label><textarea rows="3" class="inp step-symptom">${escapeHtml(step.symptom || '')}</textarea></div>
      <div><label class="lbl">Nguyên nhân gốc rễ</label><textarea rows="3" class="inp step-cause">${escapeHtml(step.root_cause || '')}</textarea></div>
      <div><label class="lbl">Cách xử lý &amp; Linh kiện</label><textarea rows="3" class="inp step-solution">${escapeHtml(step.solution || '')}</textarea></div>
    </div>`;
  container.appendChild(row);
  renumberRepairStepRows();
}
function removeRepairStepRow(btn) {
  const container = document.getElementById('rep-form-steps-container');
  if (container.querySelectorAll('.rep-step-row').length <= 1) { showToast('Cần ít nhất 1 bước', 'error'); return; }
  btn.closest('.rep-step-row').remove();
  renumberRepairStepRows();
}
function renumberRepairStepRows() {
  document.querySelectorAll('#rep-form-steps-container .rep-step-row').forEach((r, i) => {
    r.querySelector('.step-badge').textContent = `BƯỚC ${pad2(i + 1)}`;
  });
}

async function submitRepairForm(event) {
  event.preventDefault();
  const id = document.getElementById('rep-form-id').value.trim();
  const steps = Array.from(document.querySelectorAll('#rep-form-steps-container .rep-step-row'))
    .map((r) => ({
      symptom: r.querySelector('.step-symptom').value.trim(),
      root_cause: r.querySelector('.step-cause').value.trim(),
      solution: r.querySelector('.step-solution').value.trim(),
    }))
    .filter((s) => s.symptom || s.root_cause || s.solution)
    .map((s, i) => ({ step_order: i + 1, ...s }));
  const csv = (v) => v.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
  const coldRows = collectModalColdCheckRows();
  const coldRaw = (window.MRLCoreStore && typeof window.MRLCoreStore.serializeColdCheckRowsToText === 'function')
    ? window.MRLCoreStore.serializeColdCheckRowsToText(coldRows)
    : '';
  const payload = {
    device_category: document.getElementById('rep-form-category').value,
    brand_model: document.getElementById('rep-form-model').value.trim(),
    record_date: document.getElementById('rep-form-date').value.trim() || null,
    status_code: document.getElementById('rep-form-status').value,
    cold_check_raw: coldRaw,
    cold_check_json: coldRows,
    note: document.getElementById('rep-form-note').value.trim(),
    component_tags: id ? csv(document.getElementById('rep-form-tags').value) : [],
    fault_codes: csv(document.getElementById('rep-form-faults').value),
    steps,
  };
  try {
    const res = await fetch(id ? `/api/repair-cases/${encodeURIComponent(id)}` : '/api/repair-cases', {
      method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Lưu ca sửa chữa thất bại'); }
    const saved = await res.json();
    closeRepairModal();
    if (state.repairDraftSteps) delete state.repairDraftSteps[saved.id];
    if (state.repairFilters.category !== 'ALL' && state.repairFilters.category !== saved.device_category) {
      state.repairFilters.category = 'ALL';
    }
    if (state.repairFilters.status !== 'ALL' && state.repairFilters.status !== saved.status_code) {
      state.repairFilters.status = 'ALL';
      const sf = document.getElementById('repair-status-filter');
      if (sf) sf.value = 'ALL';
    }
    if (state.repairFilters.q) {
      state.repairFilters.q = '';
      const qi = document.getElementById('repair-search-input');
      if (qi) qi.value = '';
      document.getElementById('repair-search-clear')?.classList.add('hidden');
    }
    state.selectedRepairId = saved.id;
    if (!id && !state.repairsListPinned) state.repairsListCollapsed = true;
    enterWorkspace('mrl', 'repairs');
    showToast(`Đã lưu ${saved.id}`, 'success');
    await fetchBootstrap(true);
    if (!id && typeof openMobileDetailOverlay === 'function') {
      openMobileDetailOverlay('repair', saved.id);
    }
  } catch (err) { showToast(err.message, 'error'); }
}

function addDrillQaRow(containerId, qa = { id: '', q: '', a: '', hint: '' }) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'drill-qa-row';
  row.dataset.qaId = qa.id || '';
  row.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:5px;">
      <textarea rows="2" class="inp drill-q-inp" spellcheck="false" placeholder="Câu hỏi xoáy (VD: OB30 khác OB1 thế nào và tại sao PID phải đặt trong OB30?)">${escapeHtml(qa.q || '')}</textarea>
      <input type="text" class="inp drill-hint-inp" spellcheck="false" placeholder="Gợi ý ngắn (tùy chọn)..." value="${escapeHtml(qa.hint || '')}" />
    </div>
    <textarea rows="3" class="inp drill-a-inp" spellcheck="false" placeholder="Đáp án cốt lõi cần tự nhớ lại...">${escapeHtml(qa.a || '')}</textarea>
    <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.drill-qa-row').remove()">Xóa</button>`;
  container.appendChild(row);
}

function collectDrillQa(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} .drill-qa-row`)).map((row, idx) => ({
    id: row.dataset.qaId || `q-${idx + 1}`,
    q: row.querySelector('.drill-q-inp').value.trim(),
    a: row.querySelector('.drill-a-inp').value.trimEnd(),
    hint: row.querySelector('.drill-hint-inp').value.trim(),
  })).filter((x) => x.q || x.a.trim());
}

function suggestModalDrillQa(kind) {
  const containerMap = {
    plc: 'plc-form-drill-container',
    network: 'net-form-drill-container',
    knowledge: 'knw-form-drill-container',
  };
  const containerId = containerMap[kind];
  if (!containerId) return;
  const existingQs = new Set(collectDrillQa(containerId).map((x) => x.q.toLowerCase()));
  let draftItem = {};
  if (kind === 'plc') {
    draftItem = {
      id: document.getElementById('plc-form-id')?.value.trim() || 'PLC-NEW',
      title: document.getElementById('plc-form-title')?.value.trim() || 'Bài PLC',
      pinout_json: Array.from(document.querySelectorAll('#plc-form-pinout-container .plc-pin-row')).map((r) => ({
        pin: r.querySelector('.pin-name').value.trim(),
        dir: r.querySelector('.pin-dir').value.trim(),
        dtype: r.querySelector('.pin-dtype').value.trim(),
        desc: r.querySelector('.pin-desc').value.trim(),
      })).filter((r) => r.pin || r.desc),
      custom_sections_json: collectCustomSections('plc-form-sections-container'),
      drill_qa_json: [],
    };
  } else if (kind === 'network') {
    draftItem = {
      id: document.getElementById('net-form-id')?.value.trim() || 'NET-NEW',
      protocol: document.getElementById('net-form-protocol')?.value || 'Network',
      target_device: document.getElementById('net-form-target')?.value.trim() || 'Thiết bị mạng',
      register_map_json: Array.from(document.querySelectorAll('#net-form-regmap-container .net-reg-row')).map((r) => ({
        name: r.querySelector('.reg-name').value.trim(),
        address_hex: r.querySelector('.reg-hex').value.trim(),
        address_dec: r.querySelector('.reg-dec').value.trim(),
        value_desc: r.querySelector('.reg-desc').value.trim(),
      })).filter((r) => r.name || r.address_hex || r.value_desc),
      custom_sections_json: collectCustomSections('net-form-sections-container'),
      drill_qa_json: [],
    };
  } else {
    draftItem = {
      id: document.getElementById('knw-form-id')?.value.trim() || 'KNW-NEW',
      topic_model: document.getElementById('knw-form-topic')?.value.trim() || 'Kiến thức',
      category: document.getElementById('knw-form-category')?.value.trim() || '',
      core_concept_workflow: document.getElementById('knw-form-concept')?.value.trim() || '',
      why_question: document.getElementById('knw-form-why')?.value.trim() || '',
      actionable_application: document.getElementById('knw-form-action')?.value.trim() || '',
      note: document.getElementById('knw-form-note')?.value.trim() || '',
      custom_sections_json: collectCustomSections('knw-form-sections-container'),
      drill_qa_json: [],
    };
  }
  const generated = _buildDeepCardsForItem(kind, draftItem);
  let added = 0;
  generated.forEach((c) => {
    const qText = (c.question || '').trim();
    const aText = (c.answerText || '').trim();
    if (!qText || !aText || existingQs.has(qText.toLowerCase())) return;
    existingQs.add(qText.toLowerCase());
    addDrillQaRow(containerId, { id: '', q: qText, a: aText, hint: c.hint || '' });
    added += 1;
  });
  showToast(added ? `Đã tách gợi ý ${added} câu hỏi từ nội dung bài` : 'Chưa có thêm nội dung mới để tách câu hỏi', added ? 'success' : 'info');
}

function openKnowledgeModal(itemId = null) {
  if (typeof flushUniFieldEdit === 'function') flushUniFieldEdit();
  if (state.inlineSectionEdit) _flushInlineSectionOnLeave(true);
  const modal = document.getElementById('knowledge-modal');
  const title = document.getElementById('knowledge-modal-title').querySelector('span');
  const secBox = document.getElementById('knw-form-sections-container');
  const drillBox = document.getElementById('knw-form-drill-container');
  if (secBox) secBox.innerHTML = '';
  if (drillBox) drillBox.innerHTML = '';
  const set = (id, v) => { document.getElementById(id).value = v; };
  let secs = [];
  let drills = [];
  if (itemId) {
    const k = state.knowledgeItems.find((x) => x.id === itemId);
    if (!k) return;
    title.textContent = `CHỈNH SỬA KIẾN THỨC · ${k.id}`;
    set('knw-form-id', k.id); set('knw-form-group', k.source_group || 'Knowledge'); set('knw-form-category', k.category || '');
    set('knw-form-date', k.record_date || ''); set('knw-form-status', k.status_code || 'review'); set('knw-form-topic', k.topic_model || '');
    set('knw-form-takeaway', k.key_takeaway || ''); set('knw-form-concept', k.core_concept_workflow || ''); set('knw-form-why', k.why_question || '');
    set('knw-form-action', k.actionable_application || ''); set('knw-form-note', k.note || ''); set('knw-form-tags', (k.component_tags || []).join(', '));
    secs = k.custom_sections_json || [];
    drills = k.drill_qa_json || [];
  } else {
    title.textContent = 'THÊM KIẾN THỨC / SOP MỚI';
    set('knw-form-id', ''); set('knw-form-group', state.knowledgeFilters.group !== 'ALL' ? state.knowledgeFilters.group : 'Knowledge');
    set('knw-form-category', ''); set('knw-form-date', new Date().toISOString().slice(0, 10)); set('knw-form-status', 'review');
    set('knw-form-topic', ''); set('knw-form-takeaway', ''); set('knw-form-concept', ''); set('knw-form-why', '');
    set('knw-form-action', ''); set('knw-form-note', ''); set('knw-form-tags', '');
  }
  modal.classList.remove('hidden');
  secs.forEach((s) => addKnowledgeSectionRow(s));
  drills.forEach((q) => addDrillQaRow('knw-form-drill-container', q));
}
function closeKnowledgeModal() { document.getElementById('knowledge-modal').classList.add('hidden'); }

async function submitKnowledgeForm(event) {
  event.preventDefault();
  const id = document.getElementById('knw-form-id').value.trim();
  const v = (x) => document.getElementById(x).value.trim();
  const payload = {
    source_group: document.getElementById('knw-form-group').value,
    category: v('knw-form-category'),
    record_date: v('knw-form-date') || null,
    status_code: document.getElementById('knw-form-status').value,
    topic_model: v('knw-form-topic'),
    key_takeaway: v('knw-form-takeaway'),
    core_concept_workflow: v('knw-form-concept'),
    why_question: v('knw-form-why'),
    actionable_application: v('knw-form-action'),
    note: v('knw-form-note'),
    component_tags: v('knw-form-tags').split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean),
    custom_sections_json: collectCustomSections('knw-form-sections-container'),
    drill_qa_json: collectDrillQa('knw-form-drill-container'),
  };
  try {
    const res = await fetch(id ? `/api/knowledge-items/${encodeURIComponent(id)}` : '/api/knowledge-items', {
      method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Lưu kiến thức thất bại'); }
    const saved = await res.json();
    closeKnowledgeModal();
    state.selectedKnowledgeId = saved.id;
    enterWorkspace('mrl', 'knowledge');
    showToast(`Đã lưu ${saved.id}`, 'success');
    await fetchBootstrap(true);
  } catch (err) { showToast(err.message, 'error'); }
}

// ---------------------------------------------------------------------------
// Modal PLC & Mạng Truyền thông (Mục nội dung tùy chỉnh + Ảnh kéo thả)
// ---------------------------------------------------------------------------
function addPlcPinRow(rowData = { pin: '', dir: 'IN', dtype: 'Bool', desc: '' }) {
  const container = document.getElementById('plc-form-pinout-container');
  const row = document.createElement('div');
  row.className = 'table-edit-row plc-pin-row';
  row.innerHTML = `
    <input type="text" class="inp mono pin-name" placeholder="VD: REQ" value="${escapeHtml(rowData.pin || '')}" />
    <input type="text" class="inp mono pin-dir" placeholder="IN/OUT" value="${escapeHtml(rowData.dir || '')}" />
    <input type="text" class="inp mono pin-dtype" placeholder="Bool/Real" value="${escapeHtml(rowData.dtype || '')}" />
    <input type="text" class="inp pin-desc" placeholder="Mô tả chức năng..." value="${escapeHtml(rowData.desc || '')}" />
    <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.plc-pin-row').remove()">Xóa</button>`;
  container.appendChild(row);
}

function openPlcModal(noteId = null) {
  if (typeof flushUniFieldEdit === 'function') flushUniFieldEdit();
  if (state.inlineSectionEdit) _flushInlineSectionOnLeave(true);
  const modal = document.getElementById('plc-modal');
  const title = document.getElementById('plc-modal-title').querySelector('span');
  const pinBox = document.getElementById('plc-form-pinout-container');
  const secBox = document.getElementById('plc-form-sections-container');
  const drillBox = document.getElementById('plc-form-drill-container');
  pinBox.innerHTML = '';
  secBox.innerHTML = '';
  if (drillBox) drillBox.innerHTML = '';
  const set = (id, v) => { document.getElementById(id).value = v; };
  let secsToLoad = [];
  let drills = [];
  if (noteId) {
    const p = state.plcNotes.find((x) => x.id === noteId);
    if (!p) return;
    title.textContent = `CHỈNH SỬA BÀI PLC · ${p.id}`;
    set('plc-form-id', p.id);
    set('plc-form-category', p.category || 'Khối hàm (FB/FC/OB)');
    set('plc-form-platform', p.plc_brand_platform || '');
    set('plc-form-date', p.record_date || '');
    set('plc-form-status', p.status_code || 'review');
    set('plc-form-title', p.title || '');
    set('plc-form-tags', (p.tags || []).join(', '));
    const pins = p.pinout_json || [];
    pins.forEach((r) => addPlcPinRow(r));
    drills = p.drill_qa_json || [];
    if (Array.isArray(p.custom_sections_json)) secsToLoad = p.custom_sections_json;
    else {
      if (p.core_summary) secsToLoad.push({ title: 'BẢN CHẤT & NGUYÊN LÝ HOẠT ĐỘNG', style: 'warn', content: p.core_summary, images: [] });
      if (p.code_snippet) secsToLoad.push({ title: 'CODE MẪU (SCL / LOGIC LAD)', style: 'code', content: p.code_snippet, images: [] });
      if (p.common_pitfalls) secsToLoad.push({ title: 'LỖI CẤU HÌNH HAY QUÊN / BẪY THƯỜNG GẶP', style: 'pitfall', content: p.common_pitfalls, images: [] });
      if (p.interview_qa) secsToLoad.push({ title: 'CÂU HỎI PHẢN BIỆN (WHY?) & TRẢ LỜI', style: 'qa', content: p.interview_qa, images: [] });
    }
  } else {
    title.textContent = 'THÊM BÀI LẬP TRÌNH PLC MỚI';
    set('plc-form-id', '');
    set('plc-form-category', state.plcFilters.category !== 'ALL' ? state.plcFilters.category : 'Khối hàm (FB/FC/OB)');
    set('plc-form-platform', 'Siemens TIA Portal (S7-1200/1500)');
    set('plc-form-date', new Date().toISOString().slice(0, 10));
    set('plc-form-status', 'review');
    set('plc-form-title', '');
    set('plc-form-tags', '');
    addPlcPinRow();
    secsToLoad = DEFAULT_PLC_SECTIONS_NEW;
  }
  modal.classList.remove('hidden');
  secsToLoad.forEach((s) => addPlcSectionRow(s));
  drills.forEach((q) => addDrillQaRow('plc-form-drill-container', q));
}
function closePlcModal() { document.getElementById('plc-modal').classList.add('hidden'); }

async function submitPlcForm(event) {
  event.preventDefault();
  const id = document.getElementById('plc-form-id').value.trim();
  const v = (x) => document.getElementById(x).value.trim();
  const pinout = Array.from(document.querySelectorAll('#plc-form-pinout-container .plc-pin-row')).map((r) => ({
    pin: r.querySelector('.pin-name').value.trim(),
    dir: r.querySelector('.pin-dir').value.trim(),
    dtype: r.querySelector('.pin-dtype').value.trim(),
    desc: r.querySelector('.pin-desc').value.trim(),
  })).filter((r) => r.pin || r.dir || r.dtype || r.desc);
  const customSections = collectCustomSections('plc-form-sections-container');

  const payload = {
    category: document.getElementById('plc-form-category').value,
    plc_brand_platform: v('plc-form-platform'),
    record_date: v('plc-form-date') || null,
    status_code: document.getElementById('plc-form-status').value,
    title: v('plc-form-title'),
    pinout_json: pinout,
    custom_sections_json: customSections,
    drill_qa_json: collectDrillQa('plc-form-drill-container'),
    tags: v('plc-form-tags').split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean),
  };
  try {
    const res = await fetch(id ? `/api/plc-notes/${encodeURIComponent(id)}` : '/api/plc-notes', {
      method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Lưu bài PLC thất bại'); }
    const saved = await res.json();
    closePlcModal();
    state.selectedPlcId = saved.id;
    enterWorkspace('plc', 'plc');
    showToast(`Đã lưu ${saved.id}`, 'success');
    await fetchBootstrap(true);
  } catch (err) { showToast(err.message, 'error'); }
}

function addNetRegRow(rowData = { name: '', address_hex: '', address_dec: '', value_desc: '' }) {
  const container = document.getElementById('net-form-regmap-container');
  const row = document.createElement('div');
  row.className = 'table-edit-row net-row net-reg-row';
  row.innerHTML = `
    <input type="text" class="inp reg-name" placeholder="Tên thanh ghi / lệnh" value="${escapeHtml(rowData.name || '')}" />
    <input type="text" class="inp mono reg-hex" placeholder="0x0001" value="${escapeHtml(rowData.address_hex || '')}" />
    <input type="text" class="inp mono reg-dec" placeholder="40002" value="${escapeHtml(rowData.address_dec || '')}" />
    <input type="text" class="inp reg-desc" placeholder="Giá trị & ý nghĩa..." value="${escapeHtml(rowData.value_desc || '')}" />
    <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.net-reg-row').remove()">Xóa</button>`;
  container.appendChild(row);
}

function openNetworkModal(noteId = null) {
  if (typeof flushUniFieldEdit === 'function') flushUniFieldEdit();
  if (state.inlineSectionEdit) _flushInlineSectionOnLeave(true);
  const modal = document.getElementById('network-modal');
  const title = document.getElementById('network-modal-title').querySelector('span');
  const regBox = document.getElementById('net-form-regmap-container');
  const secBox = document.getElementById('net-form-sections-container');
  const drillBox = document.getElementById('net-form-drill-container');
  regBox.innerHTML = '';
  secBox.innerHTML = '';
  if (drillBox) drillBox.innerHTML = '';
  const set = (id, v) => { document.getElementById(id).value = v; };
  let secsToLoad = [];
  let drills = [];
  if (noteId) {
    const n = state.networkNotes.find((x) => x.id === noteId);
    if (!n) return;
    title.textContent = `CHỈNH SỬA MẠNG · ${n.id}`;
    set('net-form-id', n.id);
    set('net-form-protocol', n.protocol || 'Modbus RTU/TCP');
    set('net-form-target', n.target_device || '');
    set('net-form-date', n.record_date || '');
    set('net-form-status', n.status_code || 'review');
    set('net-form-tags', (n.tags || []).join(', '));
    const regs = n.register_map_json || [];
    regs.forEach((r) => addNetRegRow(r));
    drills = n.drill_qa_json || [];
    if (Array.isArray(n.custom_sections_json)) secsToLoad = n.custom_sections_json;
    else {
      if (n.physical_wiring) secsToLoad.push({ title: 'SƠ ĐỒ ĐẤU NỐI VẬT LÝ · CHÂN CÁP · ĐIỆN TRỞ 120Ω', style: 'warn', content: n.physical_wiring, images: [] });
      if (n.comm_settings) secsToLoad.push({ title: 'THÔNG SỐ TRUYỀN THÔNG & PARAMETER THIẾT BỊ', style: 'info', content: n.comm_settings, images: [] });
      if (n.test_script_code) secsToLoad.push({ title: 'SCRIPT TEST NHANH (PYTHON / PLC CONFIG)', style: 'code', content: n.test_script_code, images: [] });
      if (n.troubleshooting_tips) secsToLoad.push({ title: 'KINH NGHIỆM BẮT LỖI MẤT KẾT NỐI · NHIỄU · TIMEOUT', style: 'pitfall', content: n.troubleshooting_tips, images: [] });
    }
  } else {
    title.textContent = 'THÊM CẤU HÌNH MẠNG MỚI';
    set('net-form-id', '');
    set('net-form-protocol', state.networkFilters.protocol !== 'ALL' ? state.networkFilters.protocol : 'Modbus RTU/TCP');
    set('net-form-target', '');
    set('net-form-date', new Date().toISOString().slice(0, 10));
    set('net-form-status', 'review');
    set('net-form-tags', '');
    addNetRegRow();
    secsToLoad = DEFAULT_NET_SECTIONS_NEW;
  }
  modal.classList.remove('hidden');
  secsToLoad.forEach((s) => addNetworkSectionRow(s));
  drills.forEach((q) => addDrillQaRow('net-form-drill-container', q));
}
function closeNetworkModal() { document.getElementById('network-modal').classList.add('hidden'); }

async function submitNetworkForm(event) {
  event.preventDefault();
  const id = document.getElementById('net-form-id').value.trim();
  const v = (x) => document.getElementById(x).value.trim();
  const regs = Array.from(document.querySelectorAll('#net-form-regmap-container .net-reg-row')).map((r) => ({
    name: r.querySelector('.reg-name').value.trim(),
    address_hex: r.querySelector('.reg-hex').value.trim(),
    address_dec: r.querySelector('.reg-dec').value.trim(),
    value_desc: r.querySelector('.reg-desc').value.trim(),
  })).filter((r) => r.name || r.address_hex || r.address_dec || r.value_desc);
  const customSections = collectCustomSections('net-form-sections-container');

  const payload = {
    protocol: document.getElementById('net-form-protocol').value,
    target_device: v('net-form-target'),
    record_date: v('net-form-date') || null,
    status_code: document.getElementById('net-form-status').value,
    register_map_json: regs,
    custom_sections_json: customSections,
    drill_qa_json: collectDrillQa('net-form-drill-container'),
    tags: v('net-form-tags').split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean),
  };
  try {
    const res = await fetch(id ? `/api/network-notes/${encodeURIComponent(id)}` : '/api/network-notes', {
      method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Lưu cấu hình mạng thất bại'); }
    const saved = await res.json();
    closeNetworkModal();
    state.selectedNetworkId = saved.id;
    enterWorkspace('network', 'network');
    showToast(`Đã lưu ${saved.id}`, 'success');
    await fetchBootstrap(true);
  } catch (err) { showToast(err.message, 'error'); }
}

// ---------------------------------------------------------------------------
// Đồng bộ Excel
// ---------------------------------------------------------------------------
function triggerExcelImport() { document.getElementById('excel-import-input')?.click(); }
function exportExcel() { showToast('Đang xuất dữ liệu SQLite → Excel...'); window.location.href = '/api/excel/export'; }

document.getElementById('excel-import-input').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!await uiConfirm(`Nhập file "${file.name}" sẽ ghi đè dữ liệu ca sửa chữa & kiến thức hiện tại (giữ nguyên ảnh đính kèm). Tiếp tục?`)) { event.target.value = ''; return; }
  const fd = new FormData();
  fd.append('file', file);
  try {
    showToast('Đang đồng bộ Excel → SQLite...');
    const res = await fetch('/api/excel/import', { method: 'POST', body: fd });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Nhập Excel thất bại'); }
    const r = await res.json();
    showToast(`Đã nhập ${r.repair_cases} ca sửa + ${r.knowledge_items} kiến thức`, 'success');
    await fetchBootstrap(false);
  } catch (err) { showToast(err.message, 'error'); }
  finally { event.target.value = ''; }
});

document.getElementById('crossref-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'crossref-overlay') closeCrossRefDrawer();
});

function _disableSpellcheckGlobally() {
  document.documentElement.spellcheck = false;
  if (document.body) {
    document.body.spellcheck = false;
    document.body.setAttribute('spellcheck', 'false');
  }
  document.querySelectorAll('textarea, input').forEach((el) => {
    el.spellcheck = false;
    el.setAttribute('spellcheck', 'false');
  });
}

document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
    el.spellcheck = false;
    el.setAttribute('spellcheck', 'false');
  }
});

window.addEventListener('DOMContentLoaded', async () => {
  document.title = 'NC38';
  _disableSpellcheckGlobally();
  _initSplitResizer();
  openPortalScreen();
  await fetchBootstrap(false);
  const qs = new URLSearchParams(location.search);
  const wsParam = qs.get('workspace');
  const t = qs.get('tab');

  if (!wsParam && !t) {
    openPortalScreen();
    return;
  }

  let targetWs = WORKSPACE_META[wsParam] ? wsParam : null;
  if (!targetWs && t) {
    if (t === 'plc') targetWs = 'plc';
    else if (t === 'network') targetWs = 'network';
    else if (['en-quiz', 'en-coach', 'en-reading', 'en-vocab-bank', 'en-ingest'].includes(t)) targetWs = 'english';
    else targetWs = 'mrl';
  }
  enterWorkspace(targetWs || 'mrl', t || null);
  const sbParam = qs.get('sidebar');
  if (sbParam === '0' || sbParam === 'collapsed') toggleLeftSidebar(true, true);
  else if (sbParam === '1' || sbParam === 'open') toggleLeftSidebar(false, true);
  else if (!state.sidebarUserToggled && window.innerWidth <= 960) toggleLeftSidebar(true, false);
  if (state.activeTab === 'flashcards') {
    const modeParam = qs.get('mode');
    if (modeParam && ['deep', 'quiz', 'summary', 'en_vocab', 'en_quiz'].includes(modeParam)) {
      state.flashcard.mode = modeParam;
      const modeSel = document.getElementById('fc-mode-filter');
      if (modeSel) modeSel.value = modeParam;
    }
    const fiParam = qs.get('focus_item');
    if (fiParam && fiParam.includes(':')) {
      const [fiKind, fiId] = fiParam.split(':');
      state.flashcard.focusItem = { kind: fiKind, id: fiId };
      const sf = document.getElementById('fc-status-filter');
      if (sf) sf.value = 'ALL';
    }
    buildFlashcardDeck();
    if (qs.get('flip') === '1') {
      state.flashcard.flipped = false;
      flipFlashcard();
    }
  }
  if (qs.get('focus') === '1') {
    const selId = qs.get('select');
    if (selId) {
      if (state.activeTab === 'repairs') state.selectedRepairId = selId;
      if (state.activeTab === 'knowledge') state.selectedKnowledgeId = selId;
      if (state.activeTab === 'plc') state.selectedPlcId = selId;
      if (state.activeTab === 'network') state.selectedNetworkId = selId;
    }
    if (state.activeTab === 'repairs' && state.selectedRepairId) selectRepairCase(state.selectedRepairId);
    if (state.activeTab === 'knowledge' && state.selectedKnowledgeId) selectKnowledgeItem(state.selectedKnowledgeId);
    if (state.activeTab === 'plc' && state.selectedPlcId) selectPlcNote(state.selectedPlcId);
    if (state.activeTab === 'network' && state.selectedNetworkId) selectNetworkNote(state.selectedNetworkId);
    const inIdx = qs.get('inline_idx');
    if (inIdx !== null && inIdx !== '') {
      const idxNum = parseInt(inIdx, 10);
      if (state.activeTab === 'plc' && state.selectedPlcId) openInlineSectionEditor('plc', state.selectedPlcId, idxNum, 'primary');
      else if (state.activeTab === 'network' && state.selectedNetworkId) openInlineSectionEditor('network', state.selectedNetworkId, idxNum, 'primary');
      else if (state.activeTab === 'knowledge' && state.selectedKnowledgeId) openInlineSectionEditor('knowledge', state.selectedKnowledgeId, idxNum, 'primary');
    }
  }
  const ratioParam = parseFloat(qs.get('ratio'));
  if (!Number.isNaN(ratioParam) && ratioParam >= 22 && ratioParam <= 78) {
    state.splitRatio = ratioParam;
  }
  const p2Param = qs.get('pane2');
  if (p2Param && p2Param.includes(':')) {
    const [p2g, p2id] = p2Param.split(':');
    state.pane2Initialized = true;
    state.pane2.group = p2g;
    if (p2g === 'scratchpad') {
      state.pane2.ws = WORKSPACE_META[p2id] ? p2id : 'plc';
      state.pane2.id = state.pane2.ws;
    } else {
      state.pane2.id = p2id;
      state.pane2.ws = p2g === 'plc' ? 'plc' : (p2g === 'network' ? 'network' : 'mrl');
    }
  }
  const splitParam = qs.get('split');
  if (splitParam === 'vertical' || splitParam === 'horizontal') {
    toggleSplitMode(splitParam);
  }
  const modalParam = qs.get('modal');
  if (modalParam === 'plc') openPlcModal(qs.get('id') || null);
  else if (modalParam === 'network') openNetworkModal(qs.get('id') || null);
  else if (modalParam === 'knowledge') openKnowledgeModal(qs.get('id') || null);
});
