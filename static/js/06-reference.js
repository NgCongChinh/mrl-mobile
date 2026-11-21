// ---------------------------------------------------------------------------
// 03 Lập trình & Hệ thống PLC
// ---------------------------------------------------------------------------
function getFilteredPlcNotes() {
  const { category, status, q } = state.plcFilters;
  const needle = (q || '').trim().toLowerCase();
  return state.plcNotes.filter((p) => {
    if (category !== 'ALL' && p.category !== category) return false;
    if (status !== 'ALL' && p.status_code !== status) return false;
    if (needle) {
      const pinStr = (p.pinout_json || []).map((r) => `${r.pin} ${r.dtype} ${r.desc}`).join(' ');
      const secStr = (p.custom_sections_json || []).map((s) => `${s.title} ${s.content}`).join(' ');
      const hay = `${p.id} ${p.plc_brand_platform} ${p.category} ${p.title} ${p.core_summary} ${pinStr} ${p.code_snippet} ${p.common_pitfalls} ${p.interview_qa} ${secStr} ${(p.tags || []).join(' ')}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}
function setPlcCategory(cat) {
  state.plcFilters.category = cat;
  state.plcListCollapsed = false;
  if (state.activeWorkspace !== 'plc') enterWorkspace('plc', 'plc');
  else if (state.activeTab !== 'plc') switchTab('plc');
  else renderSidebarForWorkspace();
  renderPlcView();
}
function onPlcFilterChange() {
  state.plcFilters.status = document.getElementById('plc-status-filter').value;
  const qi = document.getElementById('plc-search-input');
  state.plcFilters.q = qi.value;
  document.getElementById('plc-search-clear').classList.toggle('hidden', !qi.value);
  state.plcListCollapsed = false;
  renderPlcView();
}
function clearPlcSearch() { document.getElementById('plc-search-input').value = ''; onPlcFilterChange(); }
function selectPlcNote(id) {
  if (typeof flushUniFieldEdit === 'function') flushUniFieldEdit();
  _flushInlineSectionOnLeave(false);
  state.selectedPlcId = id;
  if (!state.plcListPinned) state.plcListCollapsed = true;
  renderPlcView();
  const pane = document.getElementById('plc-detail');
  if (pane) pane.scrollTop = 0;
}

function renderPlcView() {
  const splitEl = document.querySelector('#view-plc .split');
  if (splitEl) splitEl.classList.toggle('list-collapsed', state.plcListCollapsed);

  const counts = { ALL: state.plcNotes.length };
  state.plcNotes.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
  document.getElementById('plc-category-pills').innerHTML = chipsHtml(PLC_CATEGORIES, state.plcFilters.category, counts, 'setPlcCategory', 'plc');

  const filtered = getFilteredPlcNotes();
  document.getElementById('plc-list-count').textContent = filtered.length;
  if (filtered.length > 0 && !filtered.some((p) => p.id === state.selectedPlcId)) state.selectedPlcId = filtered[0].id;

  const listEl = document.getElementById('plc-list');
  if (filtered.length === 0) {
    listEl.classList.remove('has-selection');
    listEl.innerHTML = `<div class="empty">KHÔNG CÓ BÀI PLC PHÙ HỢP</div>`;
    document.getElementById('plc-detail').innerHTML = `<div class="empty">CHƯA CHỌN BÀI LẬP TRÌNH PLC</div>`;
    return;
  }
  listEl.classList.add('has-selection');
  listEl.innerHTML = filtered.map((p) => {
    const sel = p.id === state.selectedPlcId;
    const stLabel = (STATUS_META[p.status_code] || STATUS_META.review).label;
    return `
      <div class="row ${sel ? 'selected' : ''}" data-ctx-record-kind="plc" data-ctx-record-id="${escapeHtml(p.id)}" onclick="selectPlcNote('${escapeHtml(p.id)}')">
        <div class="row-top">
          <span class="row-id">${escapeHtml(p.id)}</span>
          <span>·</span>
          <span class="row-cat">${escapeHtml(p.plc_brand_platform || 'PLC')}</span>
          <span class="led led-${p.status_code}" title="${escapeHtml(stLabel)}"></span>
        </div>
        <div class="row-main">
          <div class="row-title" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</div>
          <span class="row-step-count">${escapeHtml(categoryLabel(p.category || ''))}</span>
        </div>
      </div>`;
  }).join('');

  const curIdx = Math.max(0, filtered.findIndex((p) => p.id === state.selectedPlcId));
  renderPlcDetail(filtered[curIdx], curIdx, filtered.length);
}

function buildPlcDetailHtml(p, opts = {}) {
  const { showNav = true, currentIdx = 0, total = 1, showDropzone = true, codePrefix = '', pane = 'primary', inline = true } = opts;
  const pinRows = p.pinout_json || [];
  const pinTableHtml = pinRows.length
    ? `<div class="sec">
        <div class="sec-head">
          <span class="sec-title">THÔNG SỐ CHÂN KHỐI HÀM (PINOUT &amp; PARAMETERS)<span class="c">${pad2(pinRows.length)}</span></span>
        </div>
        <div class="tech-table-wrap"><table class="tech-table">
          <thead><tr><th>CHÂN / THAM SỐ</th><th>CHIỀU</th><th>KIỂU DỮ LIỆU</th><th>MÔ TẢ CHỨC NĂNG</th></tr></thead>
          <tbody>${pinRows.map((r) => `
            <tr>
              <td class="pin-cell">${escapeHtml(r.pin)}</td>
              <td><span class="dir-badge">${escapeHtml(r.dir || '—')}</span></td>
              <td class="dtype-cell">${escapeHtml(r.dtype || '—')}</td>
              <td>${escapeHtml(r.desc || '')}</td>
            </tr>`).join('')}</tbody></table></div>
      </div>`
    : '';

  const sections = p.custom_sections_json && p.custom_sections_json.length
    ? p.custom_sections_json
    : [
        ...(p.core_summary ? [{ title: 'BẢN CHẤT & NGUYÊN LÝ HOẠT ĐỘNG', style: 'warn', content: p.core_summary, images: [] }] : []),
        ...(p.code_snippet ? [{ title: 'CODE MẪU (SCL / LOGIC LAD)', style: 'code', content: p.code_snippet, images: [] }] : []),
        ...(p.common_pitfalls ? [{ title: 'LỖI CẤU HÌNH HAY QUÊN / BẪY THƯỜNG GẶP', style: 'pitfall', content: p.common_pitfalls, images: [] }] : []),
        ...(p.interview_qa ? [{ title: 'CÂU HỎI PHẢN BIỆN (WHY?) & TRẢ LỜI', style: 'qa', content: p.interview_qa, images: [] }] : []),
      ];

  return `
    <div class="detail-inner">
      ${showNav ? renderFocusNavBar('plc', currentIdx, total) : ''}
      <div class="d-head" data-ctx-record-kind="plc" data-ctx-record-id="${escapeHtml(p.id)}">
        <div style="min-width:0;">
          <div class="d-meta">
            <span class="d-id">${escapeHtml(p.id)}</span>
            <span>${escapeHtml(categoryLabel(p.category || ''))}</span>
            ${p.plc_brand_platform ? `<span>${escapeHtml(p.plc_brand_platform)}</span>` : ''}
            <span>${escapeHtml(p.record_date || '----------')}</span>
            ${ledHtml(p.status_code)}
          </div>
          <div class="d-title ${inline ? 'uni-editable uni-editable-title' : ''}" ${inline ? `data-uni-edit="1" data-uni-kind="plc" data-uni-id="${escapeHtml(p.id)}" data-uni-field="title" onclick="startUniFieldEdit('plc', '${escapeHtml(p.id)}', 'title', event, { singleLine: true })"` : ''}>${escapeHtml(p.title)}</div>
          <div class="tags">${renderTagChipsPlain(p.tags) || '<span class="mono" style="font-size:12px;color:var(--text-3);">CHƯA GẮN MÃ</span>'}</div>
        </div>
        <div class="d-controls">
          ${renderStatusSwitcher('plc', p.id, p.status_code)}
          <div class="d-btns">
            <button class="btn btn-sm" onclick="startDrillForItem('plc', '${escapeHtml(p.id)}')" title="Ôn tập sâu mọi nhóm, chân khối hàm &amp; câu hỏi của bài PLC này">🎯 Ôn bài này</button>
            <button class="btn btn-sm" onclick="openPlcModal('${escapeHtml(p.id)}')">Sửa</button>
            <button class="btn btn-sm btn-danger" onclick="deleteRecord('plc', '${escapeHtml(p.id)}')">Xóa</button>
          </div>
        </div>
      </div>

      ${renderCustomSectionsHtml(sections, `${codePrefix}plc:${p.id}`, p.tags || [], inline ? { kind: 'plc', id: p.id, pane } : null)}
      ${pinTableHtml}
      ${renderAttachmentSection('plc', p.id, p.attachments || [], showDropzone)}
    </div>`;
}

function renderPlcDetail(p, currentIdx = 0, total = 1) {
  const detailEl = document.getElementById('plc-detail');
  detailEl.innerHTML = buildPlcDetailHtml(p, { showNav: true, currentIdx, total, showDropzone: true, pane: 'primary' });
  _hydrateInlineSectionEditor(detailEl);
  syncPrimaryEditorTab();
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

// ---------------------------------------------------------------------------
// 04 Mạng Truyền thông công nghiệp
// ---------------------------------------------------------------------------
function getFilteredNetworkNotes() {
  const { protocol, status, q } = state.networkFilters;
  const needle = (q || '').trim().toLowerCase();
  return state.networkNotes.filter((n) => {
    if (protocol !== 'ALL' && n.protocol !== protocol) return false;
    if (status !== 'ALL' && n.status_code !== status) return false;
    if (needle) {
      const regStr = (n.register_map_json || []).map((r) => `${r.name} ${r.address_hex} ${r.address_dec} ${r.value_desc}`).join(' ');
      const secStr = (n.custom_sections_json || []).map((s) => `${s.title} ${s.content}`).join(' ');
      const hay = `${n.id} ${n.protocol} ${n.target_device} ${n.physical_wiring} ${n.comm_settings} ${regStr} ${n.test_script_code} ${n.troubleshooting_tips} ${secStr} ${(n.tags || []).join(' ')}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}
function setNetworkProtocol(proto) {
  state.networkFilters.protocol = proto;
  state.networkListCollapsed = false;
  if (state.activeWorkspace !== 'network') enterWorkspace('network', 'network');
  else if (state.activeTab !== 'network') switchTab('network');
  else renderSidebarForWorkspace();
  renderNetworkView();
}
function onNetworkFilterChange() {
  state.networkFilters.status = document.getElementById('network-status-filter').value;
  const qi = document.getElementById('network-search-input');
  state.networkFilters.q = qi.value;
  document.getElementById('network-search-clear').classList.toggle('hidden', !qi.value);
  state.networkListCollapsed = false;
  renderNetworkView();
}
function clearNetworkSearch() { document.getElementById('network-search-input').value = ''; onNetworkFilterChange(); }
function selectNetworkNote(id) {
  if (typeof flushUniFieldEdit === 'function') flushUniFieldEdit();
  _flushInlineSectionOnLeave(false);
  state.selectedNetworkId = id;
  if (!state.networkListPinned) state.networkListCollapsed = true;
  renderNetworkView();
  const pane = document.getElementById('network-detail');
  if (pane) pane.scrollTop = 0;
}

function renderNetworkView() {
  const splitEl = document.querySelector('#view-network .split');
  if (splitEl) splitEl.classList.toggle('list-collapsed', state.networkListCollapsed);

  const counts = { ALL: state.networkNotes.length };
  state.networkNotes.forEach((n) => { counts[n.protocol] = (counts[n.protocol] || 0) + 1; });
  document.getElementById('network-protocol-pills').innerHTML = chipsHtml(NETWORK_PROTOCOLS, state.networkFilters.protocol, counts, 'setNetworkProtocol', 'network');

  const filtered = getFilteredNetworkNotes();
  document.getElementById('network-list-count').textContent = filtered.length;
  if (filtered.length > 0 && !filtered.some((n) => n.id === state.selectedNetworkId)) state.selectedNetworkId = filtered[0].id;

  const listEl = document.getElementById('network-list');
  if (filtered.length === 0) {
    listEl.classList.remove('has-selection');
    listEl.innerHTML = `<div class="empty">KHÔNG CÓ CẤU HÌNH MẠNG PHÙ HỢP</div>`;
    document.getElementById('network-detail').innerHTML = `<div class="empty">CHƯA CHỌN CẤU HÌNH MẠNG</div>`;
    return;
  }
  listEl.classList.add('has-selection');
  listEl.innerHTML = filtered.map((n) => {
    const sel = n.id === state.selectedNetworkId;
    const stLabel = (STATUS_META[n.status_code] || STATUS_META.review).label;
    const regCnt = (n.register_map_json || []).length;
    return `
      <div class="row ${sel ? 'selected' : ''}" data-ctx-record-kind="network" data-ctx-record-id="${escapeHtml(n.id)}" onclick="selectNetworkNote('${escapeHtml(n.id)}')">
        <div class="row-top">
          <span class="row-id">${escapeHtml(n.id)}</span>
          <span>·</span>
          <span class="row-cat">${escapeHtml(n.protocol.toUpperCase())}</span>
          <span class="led led-${n.status_code}" title="${escapeHtml(stLabel)}"></span>
        </div>
        <div class="row-main">
          <div class="row-title" title="${escapeHtml(n.target_device)}">${escapeHtml(n.target_device)}</div>
          <span class="row-step-count">${regCnt} thanh ghi</span>
        </div>
      </div>`;
  }).join('');

  const curIdx = Math.max(0, filtered.findIndex((n) => n.id === state.selectedNetworkId));
  renderNetworkDetail(filtered[curIdx], curIdx, filtered.length);
}

function buildNetworkDetailHtml(n, opts = {}) {
  const { showNav = true, currentIdx = 0, total = 1, showDropzone = true, codePrefix = '', pane = 'primary', inline = true } = opts;
  const regs = n.register_map_json || [];
  const regTableHtml = regs.length
    ? `<div class="sec">
        <div class="sec-head">
          <span class="sec-title">BẢN ĐỒ THANH GHI &amp; KHUNG TRUYỀN (REGISTER MAP / TELEGRAM)<span class="c">${pad2(regs.length)}</span></span>
        </div>
        <div class="tech-table-wrap"><table class="tech-table">
          <thead><tr><th>TÊN THANH GHI / LỆNH</th><th>ĐỊA CHỈ HEX</th><th>ĐỊA CHỈ DEC</th><th>Ý NGHĨA &amp; GIÁ TRỊ</th></tr></thead>
          <tbody>${regs.map((r) => `
            <tr>
              <td class="pin-cell">${escapeHtml(r.name)}</td>
              <td class="hex-cell">${escapeHtml(r.address_hex || '—')}</td>
              <td class="dtype-cell">${escapeHtml(r.address_dec || '—')}</td>
              <td>${escapeHtml(r.value_desc || '')}</td>
            </tr>`).join('')}</tbody></table></div>
      </div>`
    : '';

  const sections = n.custom_sections_json && n.custom_sections_json.length
    ? n.custom_sections_json
    : [
        ...(n.physical_wiring ? [{ title: 'ĐẤU NỐI VẬT LÝ · CHÂN CÁP · ĐIỆN TRỞ 120Ω', style: 'warn', content: n.physical_wiring, images: [] }] : []),
        ...(n.comm_settings ? [{ title: 'THÔNG SỐ TRUYỀN THÔNG & PARAMETER BIẾN TẦN', style: 'info', content: n.comm_settings, images: [] }] : []),
        ...(n.test_script_code ? [{ title: 'SCRIPT TEST NHANH (PYTHON / PLC CONFIG)', style: 'code', content: n.test_script_code, images: [] }] : []),
        ...(n.troubleshooting_tips ? [{ title: 'KINH NGHIỆM BẮT LỖI TRUYỀN THÔNG (MẤT KẾT NỐI · NHIỄU · TIMEOUT)', style: 'pitfall', content: n.troubleshooting_tips, images: [] }] : []),
      ];

  return `
    <div class="detail-inner">
      ${showNav ? renderFocusNavBar('network', currentIdx, total) : ''}
      <div class="d-head" data-ctx-record-kind="network" data-ctx-record-id="${escapeHtml(n.id)}">
        <div style="min-width:0;">
          <div class="d-meta">
            <span class="d-id">${escapeHtml(n.id)}</span>
            <span>${escapeHtml(n.protocol.toUpperCase())}</span>
            <span>${escapeHtml(n.record_date || '----------')}</span>
            ${ledHtml(n.status_code)}
          </div>
          <div class="d-title ${inline ? 'uni-editable uni-editable-title' : ''}" ${inline ? `data-uni-edit="1" data-uni-kind="network" data-uni-id="${escapeHtml(n.id)}" data-uni-field="target_device" onclick="startUniFieldEdit('network', '${escapeHtml(n.id)}', 'target_device', event, { singleLine: true })"` : ''}>${escapeHtml(n.target_device)}</div>
          <div class="tags">${renderTagChipsPlain(n.tags) || '<span class="mono" style="font-size:12px;color:var(--text-3);">CHƯA GẮN MÃ</span>'}</div>
        </div>
        <div class="d-controls">
          ${renderStatusSwitcher('network', n.id, n.status_code)}
          <div class="d-btns">
            <button class="btn btn-sm" onclick="startDrillForItem('network', '${escapeHtml(n.id)}')" title="Ôn tập sâu sơ đồ, thanh ghi &amp; lỗi của bài Mạng này">🎯 Ôn bài này</button>
            <button class="btn btn-sm" onclick="openNetworkModal('${escapeHtml(n.id)}')">Sửa</button>
            <button class="btn btn-sm btn-danger" onclick="deleteRecord('network', '${escapeHtml(n.id)}')">Xóa</button>
          </div>
        </div>
      </div>

      ${renderCustomSectionsHtml(sections, `${codePrefix}net:${n.id}`, n.tags || [], inline ? { kind: 'network', id: n.id, pane } : null)}
      ${regTableHtml}
      ${renderAttachmentSection('network', n.id, n.attachments || [], showDropzone)}
    </div>`;
}

function renderNetworkDetail(n, currentIdx = 0, total = 1) {
  const detailEl = document.getElementById('network-detail');
  detailEl.innerHTML = buildNetworkDetailHtml(n, { showNav: true, currentIdx, total, showDropzone: true, pane: 'primary' });
  _hydrateInlineSectionEditor(detailEl);
  syncPrimaryEditorTab();
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

// ---------------------------------------------------------------------------
// 05 Từ điển linh kiện & mã lỗi + Drawer liên kết chéo
// ---------------------------------------------------------------------------
function dictRows(list, kind) {
  const isEn = state.appLang === 'en';
  if (!list.length) return `<div class="empty">${isEn ? 'NO RESULTS' : 'KHÔNG CÓ KẾT QUẢ'}</div>`;
  const repLbl = isEn ? 'Repairs' : 'Ca sửa';
  const knwLbl = isEn ? 'SOP' : 'Kiến thức';
  return list.map((it) => {
    const tag = String(it.tag || it.code || '').trim();
    const repCnt = Number(it.repair_count ?? it.count ?? 0);
    const knwCnt = Number(it.knowledge_count ?? 0);
    return `
    <button type="button" class="dict-row" onclick="openCrossRefDrawer('${escapeHtml(tag)}')">
      <span class="dict-name"><span class="tag tag-${kind}" style="pointer-events:none;">${escapeHtml(tag)}</span></span>
      <span class="dict-cnt">${repLbl} <b>${repCnt}</b></span>
      <span class="dict-cnt">${knwLbl} <b>${knwCnt}</b></span>
    </button>`;
  }).join('');
}
function renderDictionaryView() {
  const q = (document.getElementById('dict-search-input')?.value || '').trim().toLowerCase().replace(/^#/, '');
  const comps = (state.tagsDictionary.component_tags || []).filter((i) => !q || String(i.tag || i.code || '').toLowerCase().includes(q));
  const faults = (state.tagsDictionary.fault_codes || []).filter((i) => !q || String(i.tag || i.code || '').toLowerCase().includes(q));
  document.getElementById('dict-comp-count').textContent = comps.length;
  document.getElementById('dict-fault-count').textContent = faults.length;
  document.getElementById('dict-comp-grid').innerHTML = dictRows(comps, 'comp');
  document.getElementById('dict-fault-grid').innerHTML = dictRows(faults, 'fault');
}

async function openCrossRefDrawer(tag) {
  const clean = String(tag || '').replace(/^#/, '').trim();
  if (!clean) return;
  const overlay = document.getElementById('crossref-overlay');
  const bodyEl = document.getElementById('crossref-body');
  document.getElementById('crossref-title').textContent = clean;
  bodyEl.innerHTML = `<div class="empty">ĐANG TRA CỨU ${escapeHtml(clean)}...</div>`;
  overlay.classList.remove('hidden');
  try {
    const res = await fetch(`/api/cross-reference/${encodeURIComponent(clean)}`);
    if (!res.ok) throw new Error('Không thể tra cứu mã');
    const data = await res.json();
    const ws = state.activeWorkspace || 'mrl';
    const repairs = data.repair_cases || [];
    const knws = data.knowledge_items || [];
    const plcs = data.plc_notes || [];
    const nets = data.network_notes || [];

    if (ws === 'plc') {
      bodyEl.innerHTML = `
        <div class="xref" style="grid-template-columns:1fr;">
          <div class="xref-col" style="border-right:0;">
            <div class="col-head"><span>BÀI LẬP TRÌNH PLC LIÊN QUAN</span><span>${plcs.length}</span></div>
            ${plcs.length ? plcs.map((p) => `
              <div class="row" data-ctx-record-kind="plc" data-ctx-record-id="${escapeHtml(p.id)}" onclick="jumpToPlcNote('${escapeHtml(p.id)}')">
                <div class="row-top"><span class="row-id">${escapeHtml(p.id)}</span><span>·</span><span class="row-cat">${escapeHtml(p.category || 'PLC')}</span>
                  <span class="led-wrap lbl-${p.status_code}" style="margin-left:auto;"><span class="led led-${p.status_code}"></span>${(STATUS_META[p.status_code] || STATUS_META.review).label}</span></div>
                <div class="row-main"><div class="row-title">${escapeHtml(p.title)}</div><span class="row-step-count">${escapeHtml(p.plc_brand_platform || '')}</span></div>
              </div>`).join('') : '<div class="empty">KHÔNG CÓ BÀI PLC LIÊN QUAN</div>'}
          </div>
        </div>`;
      return;
    }

    if (ws === 'network') {
      bodyEl.innerHTML = `
        <div class="xref" style="grid-template-columns:1fr;">
          <div class="xref-col" style="border-right:0;">
            <div class="col-head"><span>CẤU HÌNH MẠNG TRUYỀN THÔNG LIÊN QUAN</span><span>${nets.length}</span></div>
            ${nets.length ? nets.map((n) => `
              <div class="row" data-ctx-record-kind="network" data-ctx-record-id="${escapeHtml(n.id)}" onclick="jumpToNetworkNote('${escapeHtml(n.id)}')">
                <div class="row-top"><span class="row-id">${escapeHtml(n.id)}</span><span>·</span><span class="row-cat">${escapeHtml(n.protocol)}</span>
                  <span class="led-wrap lbl-${n.status_code}" style="margin-left:auto;"><span class="led led-${n.status_code}"></span>${(STATUS_META[n.status_code] || STATUS_META.review).label}</span></div>
                <div class="row-main"><div class="row-title">${escapeHtml(n.target_device)}</div></div>
              </div>`).join('') : '<div class="empty">KHÔNG CÓ CẤU HÌNH MẠNG LIÊN QUAN</div>'}
          </div>
        </div>`;
      return;
    }

    bodyEl.innerHTML = `
      <div class="xref">
        <div class="xref-col">
          <div class="col-head"><span>CA SỬA CHỮA LIÊN QUAN</span><span>${repairs.length}</span></div>
          ${repairs.length ? repairs.map((c) => `
            <div class="row" data-ctx-record-kind="repair" data-ctx-record-id="${escapeHtml(c.id)}" onclick="jumpToRepairCase('${escapeHtml(c.id)}')">
              <div class="row-top"><span class="row-id">${escapeHtml(c.id)}</span><span class="row-cat">${escapeHtml(categoryLabel(c.device_category))}</span>
                <span class="led-wrap lbl-${c.status_code}" style="margin-left:auto;"><span class="led led-${c.status_code}"></span>${(STATUS_META[c.status_code] || STATUS_META.unclassified).label}</span></div>
              <div class="row-title">${escapeHtml(c.brand_model)}</div>
              <div class="row-sub"><b class="mono" style="color:#F87171;font-weight:600;">LỖI:</b> ${escapeHtml(c.fault_symptom_raw || '—')}</div>
              <div class="row-sub"><b class="mono" style="color:var(--green);font-weight:600;">XỬ LÝ:</b> ${escapeHtml(c.solution_raw || '—')}</div>
            </div>`).join('') : '<div class="empty">KHÔNG CÓ CA SỬA CHỮA</div>'}
        </div>
        <div class="xref-col">
          <div class="col-head"><span>KIẾN THỨC &amp; SOP LIÊN QUAN</span><span>${knws.length}</span></div>
          ${knws.length ? knws.map((k) => `
            <div class="row" data-ctx-record-kind="knowledge" data-ctx-record-id="${escapeHtml(k.id)}" onclick="jumpToKnowledgeItem('${escapeHtml(k.id)}')">
              <div class="row-top"><span class="row-id">${escapeHtml(k.id)}</span><span class="row-cat">${escapeHtml(groupLabel(k.source_group))}</span>
                <span class="led-wrap lbl-${k.status_code}" style="margin-left:auto;"><span class="led led-${k.status_code}"></span>${(STATUS_META[k.status_code] || STATUS_META.unclassified).label}</span></div>
              <div class="row-title">${escapeHtml(k.topic_model)}</div>
              <div class="row-sub">${escapeHtml(k.key_takeaway || k.why_question || '')}</div>
              <div class="row-sub" style="color:var(--text-3);">${escapeHtml(k.core_concept_workflow || k.actionable_application || '')}</div>
            </div>`).join('') : '<div class="empty">KHÔNG CÓ BÀI KIẾN THỨC</div>'}
        </div>
      </div>`;
  } catch (err) {
    bodyEl.innerHTML = `<div class="empty" style="color:var(--red);">${escapeHtml(err.message)}</div>`;
  }
}
function closeCrossRefDrawer() { document.getElementById('crossref-overlay').classList.add('hidden'); }
function jumpToRepairCase(id) {
  closeCrossRefDrawer();
  state.repairFilters = { category: 'ALL', status: 'ALL', q: '' };
  document.getElementById('repair-status-filter').value = 'ALL';
  document.getElementById('repair-search-input').value = '';
  document.getElementById('repair-search-clear').classList.add('hidden');
  state.selectedRepairId = id;
  if (!state.repairsListPinned) state.repairsListCollapsed = true;
  enterWorkspace('mrl', 'repairs');
}
function jumpToKnowledgeItem(id) {
  closeCrossRefDrawer();
  state.knowledgeFilters = { group: 'ALL', mode: 'ALL', category: 'ALL', status: 'ALL', q: '' };
  document.getElementById('knowledge-category-filter').value = 'ALL';
  document.getElementById('knowledge-status-filter').value = 'ALL';
  document.getElementById('knowledge-search-input').value = '';
  document.getElementById('knowledge-search-clear').classList.add('hidden');
  state.selectedKnowledgeId = id;
  if (!state.knowledgeListPinned) state.knowledgeListCollapsed = true;
  enterWorkspace('mrl', 'knowledge');
}

function jumpToPlcNote(id) {
  closeCrossRefDrawer();
  state.plcFilters = { category: 'ALL', status: 'ALL', q: '' };
  document.getElementById('plc-status-filter').value = 'ALL';
  document.getElementById('plc-search-input').value = '';
  document.getElementById('plc-search-clear').classList.add('hidden');
  state.selectedPlcId = id;
  if (!state.plcListPinned) state.plcListCollapsed = true;
  enterWorkspace('plc', 'plc');
}
function jumpToNetworkNote(id) {
  closeCrossRefDrawer();
  state.networkFilters = { protocol: 'ALL', status: 'ALL', q: '' };
  document.getElementById('network-status-filter').value = 'ALL';
  document.getElementById('network-search-input').value = '';
  document.getElementById('network-search-clear').classList.add('hidden');
  state.selectedNetworkId = id;
  if (!state.networkListPinned) state.networkListCollapsed = true;
  enterWorkspace('network', 'network');
}

