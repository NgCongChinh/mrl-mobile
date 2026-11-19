// ---------------------------------------------------------------------------
// Đính kèm hình ảnh & dán Clipboard (Ctrl + V)
// ---------------------------------------------------------------------------
function renderAttachmentSection(parentType, parentId, attachments, showDropzone = true) {
  if (!showDropzone && (!attachments || !attachments.length)) return '';
  const gallery = attachments.length
    ? `<div class="gallery">${attachments.map((a) => {
        const resolved = typeof resolveAssetUrl === 'function' ? resolveAssetUrl(a.file_path) : a.file_path;
        return `
        <div class="shot">
          <img src="${escapeHtml(resolved)}" alt="" onclick="openLightbox('${escapeHtml(resolved)}', '${escapeHtml(a.caption || parentId)}')" />
          <div class="shot-cap"><span title="${escapeHtml(a.caption || '')}">${escapeHtml(a.caption || 'ẢNH')}</span>
            <button type="button" onclick="deleteAttachment(${a.attachment_id})">Xóa</button></div>
        </div>`;
      }).join('')}</div>`
    : '';

  const dropzoneHtml = showDropzone ? `
      <div id="paste-dropzone" class="attach-bar" tabindex="0"
        ondragover="event.preventDefault(); this.classList.add('paste-zone-active')"
        ondragleave="this.classList.remove('paste-zone-active')"
        ondrop="handleDropUpload(event, '${parentType}', '${escapeHtml(parentId)}')">
        <input id="paste-caption-input" class="inp" type="text" placeholder="Ghi chú ảnh (VD: Xung kích Gate +15V / -8V)..." />
        <span class="attach-hint">Nhấn <kbd>Ctrl</kbd> + <kbd>V</kbd> để dán trực tiếp từ Clipboard hoặc kéo thả ảnh Oscilloscope / PCBA vào đây</span>
        <label class="btn btn-sm">Chọn ảnh<input type="file" accept="image/*" style="display:none" onchange="handleFileInputUpload(event, '${parentType}', '${escapeHtml(parentId)}')" /></label>
        <label class="btn btn-sm btn-camera-capture">📷 Chụp ảnh Bo mạch / Máy đo<input type="file" accept="image/*" capture="environment" style="display:none" onchange="handleFileInputUpload(event, '${parentType}', '${escapeHtml(parentId)}')" /></label>
      </div>` : '';

  return `
    <div class="sec">
      <div class="sec-head">
        <span class="sec-title">HÌNH ẢNH DẠNG SÓNG &amp; BO MẠCH (${attachments.length})</span>
      </div>
      ${dropzoneHtml}
      ${gallery}
    </div>`;
}

async function uploadImageBlob(blob, parentType, parentId, filename = 'clipboard.png') {
  const ci = document.getElementById('paste-caption-input');
  const caption = ci && ci.value.trim() ? ci.value.trim() : 'Ảnh dạng sóng / PCBA';
  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('parent_type', parentType);
  fd.append('parent_id', parentId);
  fd.append('caption', caption);
  try {
    showToast('Đang tải ảnh lên...');
    const res = await fetch('/api/attachments/upload', { method: 'POST', body: fd });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Upload ảnh thất bại'); }
    if (ci) ci.value = '';
    showToast('Đã đính kèm ảnh', 'success');
    await fetchBootstrap(true);
  } catch (err) { showToast(err.message, 'error'); }
}
function handleFileInputUpload(event, parentType, parentId) {
  const f = event.target.files?.[0];
  if (!f) return;
  uploadImageBlob(f, parentType, parentId, f.name);
  event.target.value = '';
}
function handleDropUpload(event, parentType, parentId) {
  event.preventDefault();
  event.currentTarget.classList.remove('paste-zone-active');
  const f = event.dataTransfer?.files?.[0];
  if (f && f.type.startsWith('image/')) uploadImageBlob(f, parentType, parentId, f.name);
  else showToast('Chỉ hỗ trợ file hình ảnh', 'error');
}
document.addEventListener('paste', (event) => {
  if (event.target?.closest?.('.rich-canvas-box, #scratchpad-canvas, #pane2-scratchpad-canvas')) return;
  if (!document.getElementById('repair-modal').classList.contains('hidden')) return;
  if (!document.getElementById('knowledge-modal').classList.contains('hidden')) return;
  if (!document.getElementById('plc-modal').classList.contains('hidden')) return;
  if (!document.getElementById('network-modal').classList.contains('hidden')) return;
  const items = event.clipboardData?.items;
  if (!items) return;
  let img = null;
  for (const it of items) { if (it.type && it.type.startsWith('image/')) { img = it.getAsFile(); break; } }
  if (!img) return;
  if (state.splitMode && state.activePane === 'secondary' && state.pane2.group === 'scratchpad') {
    event.preventDefault();
    insertPastedImageIntoPane2Scratchpad(img);
    return;
  }
  if (state.activeWorkspace && state.activeTab === 'scratchpad') {
    event.preventDefault();
    insertPastedImageIntoScratchpad(img);
    return;
  }
  if (state.activeTab === 'repairs' && state.selectedRepairId) {
    event.preventDefault();
    uploadImageBlob(img, 'repair', state.selectedRepairId, `clipboard_${Date.now()}.png`);
  } else if (state.activeTab === 'knowledge' && state.selectedKnowledgeId) {
    event.preventDefault();
    uploadImageBlob(img, 'knowledge', state.selectedKnowledgeId, `clipboard_${Date.now()}.png`);
  } else if (state.activeTab === 'plc' && state.selectedPlcId) {
    event.preventDefault();
    uploadImageBlob(img, 'plc', state.selectedPlcId, `clipboard_${Date.now()}.png`);
  } else if (state.activeTab === 'network' && state.selectedNetworkId) {
    event.preventDefault();
    uploadImageBlob(img, 'network', state.selectedNetworkId, `clipboard_${Date.now()}.png`);
  }
});
async function deleteAttachment(id) {
  if (!await uiConfirm('Xóa hình ảnh đính kèm này?')) return;
  try {
    const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Không thể xóa ảnh');
    showToast('Đã xóa ảnh đính kèm', 'success');
    await fetchBootstrap(true);
  } catch (err) { showToast(err.message, 'error'); }
}
function openLightbox(src, caption) {
  const resolved = typeof resolveAssetUrl === 'function' ? resolveAssetUrl(src) : src;
  document.getElementById('lightbox-img').src = resolved || '';
  document.getElementById('lightbox-caption').textContent = caption || '';
  document.getElementById('lightbox-modal').classList.remove('hidden');
}
function closeLightbox() {
  document.getElementById('lightbox-modal').classList.add('hidden');
  document.getElementById('lightbox-img').src = '';
}

// ---------------------------------------------------------------------------
// Rich Free-Drag Image Canvas & Dynamic Custom Sections + Vở Nháp (03 Nháp)
// ---------------------------------------------------------------------------
const SECTION_STYLE_OPTIONS = [
  { value: 'info', label: 'Khung thông tin' },
  { value: 'warn', label: 'Khung nổi bật (Vàng)' },
  { value: 'code', label: 'Code / Khung Hex (Copy)' },
  { value: 'pitfall', label: 'Lưu ý / Bẫy lỗi (Cam)' },
  { value: 'qa', label: 'Hỏi đáp Why? (Xanh)' },
];

const DEFAULT_PLC_SECTIONS_NEW = [
  { title: 'BẢN CHẤT & NGUYÊN LÝ HOẠT ĐỘNG', style: 'warn', content: '', images: [] },
  { title: 'CODE MẪU (SCL / LOGIC LAD)', style: 'code', content: '', images: [] },
  { title: 'LỖI CẤU HÌNH HAY QUÊN / BẪY THƯỜNG GẶP', style: 'pitfall', content: '', images: [] },
  { title: 'CÂU HỎI PHẢN BIỆN (WHY?) & TRẢ LỜI', style: 'qa', content: '', images: [] },
];

const DEFAULT_NET_SECTIONS_NEW = [
  { title: 'SƠ ĐỒ ĐẤU NỐI VẬT LÝ (CHÂN A+/B-, CAN_H/L, DB9, 120Ω)', style: 'warn', content: '', images: [] },
  { title: 'THÔNG SỐ TRUYỀN THÔNG & PARAMETER THIẾT BỊ', style: 'info', content: '', images: [] },
  { title: 'SCRIPT TEST NHANH (PYTHON / PLC CONFIG)', style: 'code', content: '', images: [] },
  { title: 'KINH NGHIỆM BẮT LỖI MẤT KẾT NỐI · NHIỄU · TIMEOUT', style: 'pitfall', content: '', images: [] },
];

let _pendingCanvasImageCb = null;
document.getElementById('canvas-image-file-input')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || !_pendingCanvasImageCb) return;
  const cb = _pendingCanvasImageCb;
  _pendingCanvasImageCb = null;
  await cb(file);
});

function pickCanvasImageFile(cb) {
  _pendingCanvasImageCb = cb;
  document.getElementById('canvas-image-file-input')?.click();
}

async function uploadCanvasImageBlob(file, nameHint = 'canvas_paste.png') {
  const fd = new FormData();
  fd.append('file', file, file.name || nameHint);
  const res = await fetch('/api/canvas-images/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.detail || 'Tải ảnh lên thất bại');
  }
  return res.json();
}

function syncCanvasMinHeight(boxEl, images, baseMinH) {
  if (!boxEl) return;
  let maxB = baseMinH;
  (images || []).forEach((im) => {
    const b = (Number(im.y) || 0) + (Number(im.height) || 180) + 34;
    if (b > maxB) maxB = b;
  });
  boxEl.style.minHeight = `${Math.ceil(maxB)}px`;
  const ta = boxEl.querySelector('textarea');
  if (ta) {
    const textMin = Math.max(maxB, ta.scrollHeight || baseMinH);
    ta.style.minHeight = `${Math.ceil(textMin)}px`;
  }
}

function renderFloatingCanvasLayer(boxEl, layerEl, images, baseMinH, onChanged) {
  if (!boxEl || !layerEl) return;
  syncCanvasMinHeight(boxEl, images, baseMinH);
  layerEl.innerHTML = '';

  images.forEach((img, idx) => {
    const item = document.createElement('div');
    const ix = Math.max(4, Math.round(img.x || 24));
    item.className = 'floating-img-item';
    item.style.left = `${ix}px`;
    item.style.top = `${Math.round(img.y || 24)}px`;
    item.style.width = `${Math.round(img.width || 300)}px`;
    item.style.maxWidth = `calc(100% - ${ix + 8}px)`;
    item.style.height = `${Math.round(img.height || 195)}px`;

    item.innerHTML = `
      <div class="fimg-bar" title="Nhấn giữ để kéo ảnh tới bất kỳ đâu">
        <span class="fimg-pos">⠿ ${Math.round(img.x || 0)},${Math.round(img.y || 0)}</span>
        <span class="fimg-bar-btns">
          <button type="button" title="Phóng to xem chi tiết">⛶</button>
          <button type="button" class="del" title="Xóa ảnh">×</button>
        </span>
      </div>
      <div class="fimg-body"><img src="${escapeHtml(typeof resolveAssetUrl === 'function' ? resolveAssetUrl(img.url) : img.url)}" draggable="false" alt="" /></div>
      <div class="fimg-resize" title="Kéo để chỉnh to/nhỏ"></div>`;

    const [zoomBtn, delBtn] = item.querySelectorAll('.fimg-bar-btns button');
    zoomBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openLightbox(img.url, img.caption || `Ảnh ${idx + 1}`);
    });
    delBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      images.splice(idx, 1);
      renderFloatingCanvasLayer(boxEl, layerEl, images, baseMinH, onChanged);
      if (onChanged) onChanged();
    });

    const bodyEl = item.querySelector('.fimg-body');
    const barEl = item.querySelector('.fimg-bar');
    const posSpan = item.querySelector('.fimg-pos');

    bodyEl.addEventListener('dblclick', (ev) => {
      ev.stopPropagation();
      openLightbox(img.url, img.caption || `Ảnh ${idx + 1}`);
    });

    const startMove = (ev) => {
      if (ev.button !== 0 || ev.target.closest('button')) return;
      ev.preventDefault();
      ev.stopPropagation();
      item.classList.add('dragging');
      const startX = ev.clientX;
      const startY = ev.clientY;
      const origX = Number(img.x) || 0;
      const origY = Number(img.y) || 0;
      const boxW = boxEl.clientWidth || 700;

      const onMove = (mv) => {
        const dx = mv.clientX - startX;
        const dy = mv.clientY - startY;
        const nx = Math.max(4, Math.min(origX + dx, Math.max(40, boxW - (Number(img.width) || 120) - 6)));
        const ny = Math.max(4, origY + dy);
        img.x = Math.round(nx);
        img.y = Math.round(ny);
        item.style.left = `${img.x}px`;
        item.style.top = `${img.y}px`;
        item.style.maxWidth = `calc(100% - ${img.x + 8}px)`;
        posSpan.textContent = `⠿ ${img.x},${img.y}`;
        syncCanvasMinHeight(boxEl, images, baseMinH);
      };
      const onUp = () => {
        item.classList.remove('dragging');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (onChanged) onChanged();
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };
    barEl.addEventListener('mousedown', startMove);
    bodyEl.addEventListener('mousedown', startMove);

    const resizeHandle = item.querySelector('.fimg-resize');
    resizeHandle.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      item.classList.add('dragging');
      const startX = ev.clientX;
      const startY = ev.clientY;
      const origW = Number(img.width) || 300;
      const origH = Number(img.height) || 195;
      const boxW = boxEl.clientWidth || 700;
      const maxW = Math.max(120, boxW - (Number(img.x) || 0) - 6);

      const onMove = (mv) => {
        const nw = Math.max(80, Math.min(origW + (mv.clientX - startX), maxW));
        const nh = Math.max(55, origH + (mv.clientY - startY));
        img.width = Math.round(nw);
        img.height = Math.round(nh);
        item.style.width = `${img.width}px`;
        item.style.height = `${img.height}px`;
        syncCanvasMinHeight(boxEl, images, baseMinH);
      };
      const onUp = () => {
        item.classList.remove('dragging');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (onChanged) onChanged();
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    layerEl.appendChild(item);
  });
}

async function addCanvasImageFile(boxEl, layerEl, images, file, baseMinH, onChanged) {
  try {
    const res = await uploadCanvasImageBlob(file);
    const boxW = boxEl?.clientWidth || 680;
    const count = images.length;
    const w = Math.min(340, Math.max(180, boxW - 40));
    const h = 210;
    const x = Math.min(Math.max(16, (boxW - w - 24) - (count % 2) * 30), Math.max(16, 260 + (count % 3) * 32));
    const y = 16 + (count % 4) * 36;
    images.push({ id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, url: res.url, x: Math.max(12, x), y, width: w, height: h, caption: file.name || '' });
    renderFloatingCanvasLayer(boxEl, layerEl, images, baseMinH, onChanged);
    showToast('Đã dán ảnh — nhấn giữ kéo di chuyển tự do', 'success');
    if (onChanged) onChanged();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function addCustomSectionRow(containerId, secData = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const s = secData || { title: '', style: 'info', content: '', images: [] };
  const card = document.createElement('div');
  card.className = 'custom-sec-card';
  card.dataset.style = s.style || 'info';
  card._canvasImages = Array.isArray(s.images) ? s.images.map((im) => ({ ...im })) : [];

  const styleOpts = SECTION_STYLE_OPTIONS.map((o) =>
    `<option value="${o.value}" ${(s.style || 'info') === o.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
  ).join('');

  card.innerHTML = `
    <div class="custom-sec-head">
      <input type="text" class="inp sec-title-inp" placeholder="Tự đặt tên mục (VD: Mã định danh khung truyền COB-ID)..." value="${escapeHtml(s.title || '')}" />
      <select class="sel sec-style-sel">${styleOpts}</select>
      <div class="sec-ops">
        <button type="button" class="btn btn-sm sec-img-btn" title="Chèn ảnh từ máy (hoặc nhấn Ctrl+V thẳng vào ô dưới)">+ Ảnh</button>
        <button type="button" class="btn btn-sm sec-up-btn" title="Đưa mục lên trên">↑</button>
        <button type="button" class="btn btn-sm sec-dn-btn" title="Đưa mục xuống dưới">↓</button>
        <button type="button" class="btn btn-sm btn-danger sec-del-btn">Xóa mục</button>
      </div>
    </div>
    <div class="rich-canvas-box">
      <textarea class="sec-content-inp" spellcheck="false" rows="4" placeholder="Nhập nội dung chi tiết hoặc bấm Ctrl+V để dán ảnh chụp màn hình và kéo đặt bất kỳ đâu...">${escapeHtml(s.content || '')}</textarea>
      <div class="canvas-images-layer"></div>
    </div>`;

  const boxEl = card.querySelector('.rich-canvas-box');
  const layerEl = card.querySelector('.canvas-images-layer');
  const styleSel = card.querySelector('.sec-style-sel');
  styleSel.addEventListener('change', () => { card.dataset.style = styleSel.value; });

  card.querySelector('.sec-up-btn').addEventListener('click', () => {
    const prev = card.previousElementSibling;
    if (prev) container.insertBefore(card, prev);
  });
  card.querySelector('.sec-dn-btn').addEventListener('click', () => {
    const next = card.nextElementSibling;
    if (next) container.insertBefore(next, card);
  });
  card.querySelector('.sec-del-btn').addEventListener('click', () => card.remove());
  card.querySelector('.sec-img-btn').addEventListener('click', () => {
    pickCanvasImageFile((file) => addCanvasImageFile(boxEl, layerEl, card._canvasImages, file, 150, null));
  });

  boxEl.addEventListener('paste', (ev) => {
    const items = ev.clipboardData?.items;
    if (!items) return;
    let imgFile = null;
    for (const it of items) { if (it.type && it.type.startsWith('image/')) { imgFile = it.getAsFile(); break; } }
    if (!imgFile) return;
    ev.preventDefault();
    ev.stopPropagation();
    addCanvasImageFile(boxEl, layerEl, card._canvasImages, imgFile, 150, null);
  });

  container.appendChild(card);
  renderFloatingCanvasLayer(boxEl, layerEl, card._canvasImages, 150, null);
}

function addPlcSectionRow(secData = null) { addCustomSectionRow('plc-form-sections-container', secData); }
function addNetworkSectionRow(secData = null) { addCustomSectionRow('net-form-sections-container', secData); }
function addKnowledgeSectionRow(secData = null) { addCustomSectionRow('knw-form-sections-container', secData); }

function collectCustomSections(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} .custom-sec-card`)).map((card, idx) => ({
    id: `sec-${idx + 1}`,
    title: card.querySelector('.sec-title-inp').value.trim(),
    style: card.querySelector('.sec-style-sel').value,
    content: card.querySelector('.sec-content-inp').value.trimEnd(),
    images: (card._canvasImages || []).map((im) => ({
      id: im.id || '', url: im.url, x: Number(im.x) || 0, y: Number(im.y) || 0,
      width: Number(im.width) || 280, height: Number(im.height) || 180, caption: im.caption || '',
    })),
  })).filter((s) => s.title || s.content.trim() || s.images.length);
}

let _inlineSecSaveTimer = null;

function _cloneSectionsList(list) {
  return (list || []).map((s, idx) => ({
    id: s.id || `sec-${idx + 1}`,
    title: s.title || '',
    style: s.style || 'info',
    content: s.content || '',
    images: Array.isArray(s.images) ? s.images.map((im) => ({ ...im })) : [],
  }));
}

function _getEditableSectionsForRecord(kind, rec) {
  if (!rec) return [];
  if (Array.isArray(rec.custom_sections_json) && rec.custom_sections_json.length) {
    return _cloneSectionsList(rec.custom_sections_json);
  }
  if (kind === 'plc') {
    const out = [];
    if (rec.core_summary) out.push({ id: 'sec-1', title: 'BẢN CHẤT & NGUYÊN LÝ HOẠT ĐỘNG', style: 'warn', content: rec.core_summary, images: [] });
    if (rec.code_snippet) out.push({ id: 'sec-2', title: 'CODE MẪU (SCL / LOGIC LAD)', style: 'code', content: rec.code_snippet, images: [] });
    if (rec.common_pitfalls) out.push({ id: 'sec-3', title: 'LỖI CẤU HÌNH HAY QUÊN / BẪY THƯỜNG GẶP', style: 'pitfall', content: rec.common_pitfalls, images: [] });
    if (rec.interview_qa) out.push({ id: 'sec-4', title: 'CÂU HỎI PHẢN BIỆN (WHY?) & TRẢ LỜI', style: 'qa', content: rec.interview_qa, images: [] });
    return out;
  }
  if (kind === 'network') {
    const out = [];
    if (rec.physical_wiring) out.push({ id: 'sec-1', title: 'ĐẤU NỐI VẬT LÝ · CHÂN CÁP · ĐIỆN TRỞ 120Ω', style: 'warn', content: rec.physical_wiring, images: [] });
    if (rec.comm_settings) out.push({ id: 'sec-2', title: 'THÔNG SỐ TRUYỀN THÔNG & PARAMETER BIẾN TẦN', style: 'info', content: rec.comm_settings, images: [] });
    if (rec.test_script_code) out.push({ id: 'sec-3', title: 'SCRIPT TEST NHANH (PYTHON / PLC CONFIG)', style: 'code', content: rec.test_script_code, images: [] });
    if (rec.troubleshooting_tips) out.push({ id: 'sec-4', title: 'KINH NGHIỆM BẮT LỖI TRUYỀN THÔNG (MẤT KẾT NỐI · NHIỄU · TIMEOUT)', style: 'pitfall', content: rec.troubleshooting_tips, images: [] });
    return out;
  }
  return [];
}

function _replaceRecordInState(kind, saved) {
  if (!saved || !saved.id) return;
  const map = { plc: 'plcNotes', network: 'networkNotes', knowledge: 'knowledgeItems' };
  const arrName = map[kind];
  if (!arrName) return;
  const idx = state[arrName].findIndex((x) => x.id === saved.id);
  if (idx >= 0) state[arrName][idx] = saved;
  syncPrimaryEditorTab();
}

function _rerenderInlineHost(kind, id, pane, skipSamePane = false) {
  if (!(skipSamePane && pane === 'primary')) {
    if (kind === 'plc' && state.selectedPlcId === id) {
      const filtered = getFilteredPlcNotes();
      const idx = Math.max(0, filtered.findIndex((p) => p.id === id));
      if (filtered[idx]) renderPlcDetail(filtered[idx], idx, filtered.length);
    } else if (kind === 'network' && state.selectedNetworkId === id) {
      const filtered = getFilteredNetworkNotes();
      const idx = Math.max(0, filtered.findIndex((n) => n.id === id));
      if (filtered[idx]) renderNetworkDetail(filtered[idx], idx, filtered.length);
    } else if (kind === 'knowledge' && state.selectedKnowledgeId === id) {
      const filtered = getFilteredKnowledgeItems();
      const idx = Math.max(0, filtered.findIndex((k) => k.id === id));
      if (filtered[idx]) renderKnowledgeDetail(filtered[idx], idx, filtered.length);
    }
  }
  if (!(skipSamePane && pane === 'secondary')) {
    if (state.splitMode && state.pane2?.group === kind && state.pane2?.id === id) {
      renderPane2();
    }
  }
}

function _buildMergedInlineSections(ed) {
  const rec = _findRecordByKindId(ed.kind, ed.id);
  const currentList = _getEditableSectionsForRecord(ed.kind, rec);
  const out = _cloneSectionsList(currentList);
  const cleanDraft = {
    id: ed.draft.id || `sec-${ed.idx + 1}`,
    title: (ed.draft.title || '').trim(),
    style: ed.draft.style || 'info',
    content: (ed.draft.content || '').trimEnd(),
    images: Array.isArray(ed.draft.images) ? ed.draft.images.map((im) => ({
      id: im.id || '', url: im.url, x: Number(im.x) || 0, y: Number(im.y) || 0,
      width: Number(im.width) || 280, height: Number(im.height) || 180, caption: im.caption || '',
    })) : [],
  };
  if (ed.idx >= out.length) out.push(cleanDraft);
  else out[ed.idx] = cleanDraft;
  return out;
}

async function _patchSectionsApi(kind, id, sectionsList) {
  const res = await fetch(`/api/sections/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ custom_sections_json: sectionsList }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.detail || 'Lưu mục nội dung thất bại');
  }
  const saved = await res.json();
  _replaceRecordInState(kind, saved);
  return saved;
}

async function saveInlineSectionNow(showNotify = false) {
  clearTimeout(_inlineSecSaveTimer);
  const ed = state.inlineSectionEdit;
  if (!ed || ed.saving) return;
  const stEl = document.getElementById('inline-save-status');
  const box = document.getElementById('inline-sec-editor-box');
  if (box) {
    ed.draft.title = box.querySelector('.sec-title-inp')?.value || '';
    ed.draft.style = box.querySelector('.sec-style-sel')?.value || 'info';
    ed.draft.content = box.querySelector('.sec-content-inp')?.value || '';
  }
  const merged = _buildMergedInlineSections(ed);
  if (ed.isNew && !ed.draft.title.trim() && !ed.draft.content.trim() && !ed.draft.images.length) {
    ed.dirty = false;
    if (stEl) { stEl.textContent = 'NHẬP NỘI DUNG ĐỂ LƯU'; stEl.style.color = 'var(--text-3)'; }
    return;
  }
  ed.saving = true;
  if (stEl) { stEl.textContent = 'ĐANG LƯU...'; stEl.style.color = 'var(--amber)'; }
  try {
    const saved = await _patchSectionsApi(ed.kind, ed.id, merged);
    ed.dirty = false;
    ed.mutated = true;
    ed.isNew = false;
    const savedCount = (saved.custom_sections_json || []).length;
    if (ed.idx >= savedCount && savedCount > 0) ed.idx = savedCount - 1;
    if (stEl) { stEl.textContent = 'ĐÃ LƯU TỰ ĐỘNG'; stEl.style.color = 'var(--green)'; }
    _rerenderInlineHost(ed.kind, ed.id, ed.pane, true);
    if (showNotify) showToast('Đã lưu mục nội dung', 'success');
  } catch (err) {
    if (stEl) { stEl.textContent = 'LỖI LƯU'; stEl.style.color = 'var(--red)'; }
    if (showNotify) showToast(err.message, 'error');
  } finally {
    ed.saving = false;
  }
}

async function _flushInlineSectionOnLeave(rerender = false) {
  clearTimeout(_inlineSecSaveTimer);
  const ed = state.inlineSectionEdit;
  if (!ed) return;
  const box = document.getElementById('inline-sec-editor-box');
  if (box) {
    const tVal = box.querySelector('.sec-title-inp')?.value || '';
    const sVal = box.querySelector('.sec-style-sel')?.value || 'info';
    const cVal = box.querySelector('.sec-content-inp')?.value || '';
    if (tVal !== ed.draft.title || sVal !== ed.draft.style || cVal !== ed.draft.content) {
      ed.draft.title = tVal;
      ed.draft.style = sVal;
      ed.draft.content = cVal;
      ed.dirty = true;
    }
  }
  const hasPayload = Boolean(ed.draft.title.trim() || ed.draft.content.trim() || ed.draft.images.length);
  const merged = (ed.dirty && !(ed.isNew && !hasPayload)) ? _buildMergedInlineSections(ed) : null;
  if (merged) {
    const rec = _findRecordByKindId(ed.kind, ed.id);
    if (rec) _replaceRecordInState(ed.kind, { ...rec, custom_sections_json: merged });
  }
  const { kind, id, pane } = ed;
  state.inlineSectionEdit = null;
  if (rerender) _rerenderInlineHost(kind, id, pane, false);
  if (merged) {
    try {
      await _patchSectionsApi(kind, id, merged);
    } catch (err) {
      console.error(err);
    }
  }
}

async function openInlineSectionEditor(kind, id, idx, pane = 'primary') {
  if (state.inlineSectionEdit) {
    const cur = state.inlineSectionEdit;
    if (cur.kind === kind && cur.id === id && cur.idx === idx && cur.pane === pane) return;
    await _flushInlineSectionOnLeave(false);
  }
  const rec = _findRecordByKindId(kind, id);
  if (!rec) return;
  const secs = _getEditableSectionsForRecord(kind, rec);
  if (idx < 0 || idx >= secs.length) return;
  state.inlineSectionEdit = {
    kind,
    id,
    pane,
    idx,
    origSections: _cloneSectionsList(secs),
    draft: _cloneSectionsList([secs[idx]])[0],
    isNew: false,
    dirty: false,
    mutated: false,
    saving: false,
    focusTarget: 'content',
  };
  _rerenderInlineHost(kind, id, pane, false);
}

async function addInlineNewSection(kind, id, pane = 'primary') {
  if (state.inlineSectionEdit) {
    await _flushInlineSectionOnLeave(false);
  }
  const rec = _findRecordByKindId(kind, id);
  if (!rec) return;
  const secs = _getEditableSectionsForRecord(kind, rec);
  const newDraft = { id: `sec-${secs.length + 1}`, title: '', style: 'info', content: '', images: [] };
  state.inlineSectionEdit = {
    kind,
    id,
    pane,
    idx: secs.length,
    origSections: _cloneSectionsList(secs),
    draft: newDraft,
    isNew: true,
    dirty: false,
    mutated: false,
    saving: false,
    focusTarget: 'title',
  };
  _rerenderInlineHost(kind, id, pane, false);
}

async function finishInlineSectionEdit() {
  clearTimeout(_inlineSecSaveTimer);
  const ed = state.inlineSectionEdit;
  if (!ed) return;
  const box = document.getElementById('inline-sec-editor-box');
  if (box) {
    ed.draft.title = box.querySelector('.sec-title-inp')?.value || '';
    ed.draft.style = box.querySelector('.sec-style-sel')?.value || 'info';
    ed.draft.content = box.querySelector('.sec-content-inp')?.value || '';
  }
  if (ed.dirty || (ed.draft.title.trim() || ed.draft.content.trim() || ed.draft.images.length)) {
    await saveInlineSectionNow(false);
  }
  const { kind, id, pane } = ed;
  state.inlineSectionEdit = null;
  _rerenderInlineHost(kind, id, pane, false);
  showToast('Đã lưu & hoàn tất chỉnh sửa mục', 'success');
}

async function cancelInlineSectionEdit() {
  clearTimeout(_inlineSecSaveTimer);
  const ed = state.inlineSectionEdit;
  if (!ed) return;
  const { kind, id, pane, mutated, origSections } = ed;
  state.inlineSectionEdit = null;
  if (mutated) {
    try {
      await _patchSectionsApi(kind, id, origSections);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
  _rerenderInlineHost(kind, id, pane, false);
}

async function moveInlineSection(delta) {
  const ed = state.inlineSectionEdit;
  if (!ed) return;
  clearTimeout(_inlineSecSaveTimer);
  if (ed.dirty) await saveInlineSectionNow(false);
  const rec = _findRecordByKindId(ed.kind, ed.id);
  const secs = _getEditableSectionsForRecord(ed.kind, rec);
  const targetIdx = ed.idx + delta;
  if (ed.isNew || targetIdx < 0 || targetIdx >= secs.length) return;
  const tmp = secs[ed.idx];
  secs[ed.idx] = secs[targetIdx];
  secs[targetIdx] = tmp;
  try {
    await _patchSectionsApi(ed.kind, ed.id, secs);
    ed.idx = targetIdx;
    ed.origSections = _cloneSectionsList(secs);
    ed.draft = _cloneSectionsList([secs[targetIdx]])[0];
    ed.mutated = true;
    _rerenderInlineHost(ed.kind, ed.id, ed.pane, false);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteInlineSection() {
  const ed = state.inlineSectionEdit;
  if (!ed) return;
  clearTimeout(_inlineSecSaveTimer);
  const hasContent = Boolean((ed.draft.content || '').trim() || (ed.draft.images || []).length);
  if (hasContent && !await uiConfirm(`Xóa mục "${ed.draft.title || 'này'}"?`)) return;
  const { kind, id, pane, isNew, idx } = ed;
  if (isNew) {
    state.inlineSectionEdit = null;
    _rerenderInlineHost(kind, id, pane, false);
    return;
  }
  const rec = _findRecordByKindId(kind, id);
  const secs = _getEditableSectionsForRecord(kind, rec);
  secs.splice(idx, 1);
  try {
    await _patchSectionsApi(kind, id, secs);
    state.inlineSectionEdit = null;
    _rerenderInlineHost(kind, id, pane, false);
    showToast('Đã xóa mục khỏi bài', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function _hydrateInlineSectionEditor(rootEl) {
  if (!rootEl) return;
  const box = rootEl.querySelector('#inline-sec-editor-box');
  const ed = state.inlineSectionEdit;
  if (!box || !ed) return;

  const titleInp = box.querySelector('.sec-title-inp');
  const styleSel = box.querySelector('.sec-style-sel');
  const contentTa = box.querySelector('.sec-content-inp');
  const canvasBox = box.querySelector('.rich-canvas-box');
  const layerEl = box.querySelector('.canvas-images-layer');
  const imgBtn = box.querySelector('.sec-img-btn');
  const stEl = box.querySelector('#inline-save-status');

  const markDirty = () => {
    ed.draft.title = titleInp.value;
    ed.draft.style = styleSel.value;
    ed.draft.content = contentTa.value;
    ed.dirty = true;
    if (stEl) { stEl.textContent = 'ĐANG GÕ...'; stEl.style.color = 'var(--amber)'; }
    clearTimeout(_inlineSecSaveTimer);
    _inlineSecSaveTimer = setTimeout(() => saveInlineSectionNow(false), 650);
  };

  titleInp.addEventListener('input', markDirty);
  styleSel.addEventListener('change', () => {
    box.dataset.style = styleSel.value;
    ed.draft.style = styleSel.value;
    ed.dirty = true;
    saveInlineSectionNow(false);
  });
  contentTa.addEventListener('input', markDirty);
  contentTa.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      finishInlineSectionEdit();
    }
  });

  const onImagesChanged = () => {
    ed.dirty = true;
    saveInlineSectionNow(false);
  };

  imgBtn?.addEventListener('click', () => {
    pickCanvasImageFile((file) => addCanvasImageFile(canvasBox, layerEl, ed.draft.images, file, 165, onImagesChanged));
  });

  canvasBox.addEventListener('paste', (ev) => {
    const items = ev.clipboardData?.items;
    if (!items) return;
    let imgFile = null;
    for (const it of items) { if (it.type && it.type.startsWith('image/')) { imgFile = it.getAsFile(); break; } }
    if (!imgFile) return;
    ev.preventDefault();
    ev.stopPropagation();
    addCanvasImageFile(canvasBox, layerEl, ed.draft.images, imgFile, 165, onImagesChanged);
  });

  renderFloatingCanvasLayer(canvasBox, layerEl, ed.draft.images, 165, onImagesChanged);

  if (ed.focusTarget) {
    const targetEl = ed.focusTarget === 'title' ? titleInp : contentTa;
    ed.focusTarget = null;
    setTimeout(() => {
      targetEl.focus();
      if (targetEl === contentTa) {
        const len = contentTa.value.length;
        contentTa.setSelectionRange(len, len);
      }
    }, 10);
  }
}

function renderCustomSectionsHtml(sections = [], prefixKey = 'sec', highlightTags = [], inlineOpts = null) {
  const ed = state.inlineSectionEdit;
  const renderList = [...(sections || [])];
  const hasDraftNew = Boolean(inlineOpts && ed && ed.kind === inlineOpts.kind && ed.id === inlineOpts.id && ed.pane === inlineOpts.pane && ed.idx >= renderList.length);
  if (hasDraftNew) renderList.push(ed.draft);

  const fmt = (txt) => highlightTagsHtml(txt, highlightTags || [], []);

  const cardsHtml = renderList.map((s, idx) => {
    const isEditingHere = Boolean(inlineOpts && ed && ed.kind === inlineOpts.kind && ed.id === inlineOpts.id && ed.pane === inlineOpts.pane && ed.idx === idx);
    if (isEditingHere) {
      const styleOpts = SECTION_STYLE_OPTIONS.map((o) =>
        `<option value="${o.value}" ${(ed.draft.style || 'info') === o.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
      ).join('');
      const stText = ed.saving ? 'ĐANG LƯU...' : (ed.dirty ? 'CHƯA LƯU' : (ed.isNew && !ed.draft.title && !ed.draft.content && !ed.draft.images.length ? 'NHẬP NỘI DUNG ĐỂ LƯU' : 'ĐÃ LƯU TỰ ĐỘNG'));
      return `
        <div class="sec inline-sec-editor" id="inline-sec-editor-box" data-style="${escapeHtml(ed.draft.style || 'info')}">
          <div class="custom-sec-head">
            <input type="text" class="inp sec-title-inp" spellcheck="false" placeholder="Tên mục (VD: CÁC BƯỚC XỬ LÝ VẤN ĐỀ, CODE SCL...)" value="${escapeHtml(ed.draft.title || '')}" />
            <select class="sel sec-style-sel">${styleOpts}</select>
            <div class="sec-ops">
              <button type="button" class="btn btn-sm sec-img-btn" title="Chèn ảnh từ máy hoặc nhấn Ctrl+V vào khung dưới">+ Ảnh</button>
              <button type="button" class="btn btn-sm" onclick="moveInlineSection(-1)" ${ed.isNew || idx === 0 ? 'disabled' : ''} title="Đưa mục lên trên">↑</button>
              <button type="button" class="btn btn-sm" onclick="moveInlineSection(1)" ${ed.isNew || idx >= renderList.length - 1 ? 'disabled' : ''} title="Đưa mục xuống dưới">↓</button>
              <button type="button" class="btn btn-sm btn-danger" onclick="deleteInlineSection()">Xóa mục</button>
            </div>
          </div>
          <div class="rich-canvas-box inline-canvas-box">
            <textarea id="inline-sec-textarea" class="sec-content-inp" spellcheck="false" rows="6" placeholder="Gõ nội dung xử lý, bước làm hoặc bấm Ctrl+V dán ảnh chụp màn hình và kéo thả tự do...">${escapeHtml(ed.draft.content || '')}</textarea>
            <div class="canvas-images-layer"></div>
          </div>
          <div class="inline-sec-foot">
            <span class="mono" style="font-size:12px;color:var(--text-3);">Ctrl+V dán ảnh kéo thả · Ctrl+S lưu · Ctrl+Enter xong</span>
            <div style="display:flex;align-items:center;gap:8px;">
              <span id="inline-save-status" class="inline-save-status">${stText}</span>
              <button type="button" class="btn btn-sm" onclick="cancelInlineSectionEdit()">↩ Hủy</button>
              <button type="button" class="btn btn-sm btn-primary" onclick="finishInlineSectionEdit()">✓ Lưu &amp; Xong</button>
            </div>
          </div>
        </div>`;
    }

    const title = s.title || `MỤC ${pad2(idx + 1)}`;
    const style = s.style || 'info';
    const rawContent = String(s.content || '');
    const content = style === 'code' ? rawContent.replace(/^\n+|\n+$/g, '') : rawContent.trim();
    const imgs = s.images || [];
    const secKey = `${prefixKey}:${idx}`;
    sectionRawTextMap[secKey] = {
      secKey,
      title,
      content,
      style,
      recordId: inlineOpts?.id || '',
      kind: inlineOpts?.kind || '',
    };
    const showBiCtl = !String(prefixKey || '').startsWith('fc-');
    const biOn = Boolean(showBiCtl && state.bilingualSections?.[secKey]?.open);
    const biBtnHtml = showBiCtl
      ? `<button type="button" class="btn btn-sm sec-bilingual-btn ${biOn ? 'split-on' : ''}" data-bi-key="${escapeHtml(secKey)}" onclick="event.stopPropagation(); toggleSectionBilingual('${escapeHtml(secKey)}')" title="Đối chiếu Song ngữ Việt ⇄ Anh cho khối này">🇬🇧 Song ngữ</button>`
      : '';
    const biPanelHtml = showBiCtl
      ? `<div id="bilingual-box-${escapeHtml(secKey)}" class="bilingual-sec-wrap ${biOn ? '' : 'hidden'}">${biOn && typeof renderCachedBilingualSectionHtml === 'function' ? renderCachedBilingualSectionHtml(secKey) : ''}</div>`
      : '';

    const minH = imgs.length ? Math.max(90, ...imgs.map((im) => (Number(im.y) || 0) + (Number(im.height) || 180) + 16)) : 0;
    const imgsHtml = imgs.map((im) => {
      const ix = Math.max(0, Math.round(im.x || 0));
      const resolvedUrl = typeof resolveAssetUrl === 'function' ? resolveAssetUrl(im.url) : im.url;
      return `<div class="detail-floating-img" style="left:${ix}px; top:${Math.round(im.y || 0)}px; width:${Math.round(im.width || 280)}px; max-width:calc(100% - ${ix + 8}px); height:${Math.round(im.height || 180)}px;" onclick="openLightbox('${escapeHtml(resolvedUrl)}', '${escapeHtml(title)}')"><img src="${escapeHtml(resolvedUrl)}" alt="${escapeHtml(title)}" /></div>`;
    }).join('');

    const editCall = inlineOpts
      ? `openInlineSectionEditor('${escapeHtml(inlineOpts.kind)}', '${escapeHtml(inlineOpts.id)}', ${idx}, '${escapeHtml(inlineOpts.pane)}')`
      : '';
    const editBtnHtml = inlineOpts
      ? `<button type="button" class="btn btn-sm sec-inline-edit-btn" onclick="${editCall}" title="Viết / chỉnh sửa trực tiếp mục này">✎ Viết / Sửa</button>`
      : '';
    const headOpsHtml = (biBtnHtml || editBtnHtml)
      ? `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${biBtnHtml}${editBtnHtml}</div>`
      : '';

    const emptyHtml = inlineOpts
      ? `<div class="inline-empty-prompt" onclick="${editCall}">+ Mục này đang trống — bấm vào đây để viết hoặc dán ảnh (Ctrl+V) ngay...</div>`
      : '<span style="color:var(--text-3);">— Trống —</span>';

    const innerBox = `<div class="detail-canvas-box"${minH ? ` style="min-height:${Math.ceil(minH)}px;"` : ''}><div class="detail-canvas-text">${content ? fmt(content) : (imgs.length ? '' : emptyHtml)}</div>${imgsHtml}</div>${biPanelHtml}`;

    if (style === 'code') {
      const bufKey = `${prefixKey}:${idx}`;
      codeBufferMap[bufKey] = content;
      return `
        <div class="sec">
          <div class="code-box">
            <div class="code-head">
              <span style="color:var(--amber);font-weight:700;">${escapeHtml(title)}</span>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <button type="button" class="btn btn-sm" onclick="copyCodeBlock(this, '${escapeHtml(bufKey)}')">Copy</button>
                ${biBtnHtml}
                ${editBtnHtml}
              </div>
            </div>
            <div class="detail-canvas-box" ${minH ? `style="min-height:${Math.ceil(minH)}px;"` : ''}>
              ${content ? `<pre class="code-pre">${escapeHtml(content)}</pre>` : (imgs.length ? '' : `<div style="padding:12px 14px;">${emptyHtml}</div>`)}
              ${imgsHtml}
            </div>
            ${biPanelHtml}
          </div>
        </div>`;
    }
    if (style === 'warn') {
      return `<div class="sec"><div class="warn"><div class="warn-title sec-title-row"><span>${escapeHtml(title)}</span>${headOpsHtml}</div><div class="warn-body">${innerBox}</div></div></div>`;
    }
    if (style === 'pitfall') {
      return `<div class="sec"><div class="pitfall-block"><div class="nb-title sec-title-row"><span>${escapeHtml(title)}</span>${headOpsHtml}</div><div class="nb-body">${innerBox}</div></div></div>`;
    }
    if (style === 'qa') {
      return `<div class="sec"><div class="qa-block"><div class="nb-title sec-title-row"><span>${escapeHtml(title)}</span>${headOpsHtml}</div><div class="nb-body">${innerBox}</div></div></div>`;
    }
    return `<div class="sec"><div class="note-block accent"><div class="nb-title sec-title-row"><span>${escapeHtml(title)}</span>${headOpsHtml}</div><div class="nb-body">${innerBox}</div></div></div>`;
  }).join('');

  const addBarHtml = inlineOpts && !hasDraftNew
    ? `<div class="inline-add-sec-bar"><button type="button" class="btn btn-sm inline-add-sec-btn" onclick="addInlineNewSection('${escapeHtml(inlineOpts.kind)}', '${escapeHtml(inlineOpts.id)}', '${escapeHtml(inlineOpts.pane)}')">+ Thêm mục mới ngay tại đây (viết chữ · dán ảnh Ctrl+V)</button></div>`
    : '';

  return cardsHtml + addBarHtml;
}

// ---- Vở Nháp Độc Lập (03 Nháp) ----
let _scratchpadTimer = null;
let _scratchpadBound = false;

function _ensureScratchpadBinding() {
  if (_scratchpadBound) return;
  _scratchpadBound = true;
  const ta = document.getElementById('scratchpad-textarea');
  const canvas = document.getElementById('scratchpad-canvas');
  if (!ta || !canvas) return;

  ta.addEventListener('input', () => {
    const ws = state.activeWorkspace || 'mrl';
    if (!state.scratchpads[ws]) state.scratchpads[ws] = { workspace: ws, content: '', images_json: [], font_mode: 'sans' };
    state.scratchpads[ws].content = ta.value;
    const st = document.getElementById('scratchpad-status');
    if (st) {
      st.textContent = state.appLang === 'en' ? 'TYPING...' : 'ĐANG GÕ...';
      st.style.color = 'var(--amber)';
    }
    clearTimeout(_scratchpadTimer);
    _scratchpadTimer = setTimeout(() => saveScratchpadNow(false), 450);
  });

  canvas.addEventListener('paste', (ev) => {
    const items = ev.clipboardData?.items;
    if (!items) return;
    let imgFile = null;
    for (const it of items) { if (it.type && it.type.startsWith('image/')) { imgFile = it.getAsFile(); break; } }
    if (!imgFile) return;
    ev.preventDefault();
    ev.stopPropagation();
    insertPastedImageIntoScratchpad(imgFile);
  });
}

function insertPastedImageIntoScratchpad(file) {
  const ws = state.activeWorkspace || 'mrl';
  if (!state.scratchpads[ws]) state.scratchpads[ws] = { workspace: ws, content: '', images_json: [], font_mode: 'sans' };
  const pad = state.scratchpads[ws];
  const canvas = document.getElementById('scratchpad-canvas');
  const layer = document.getElementById('scratchpad-images-layer');
  addCanvasImageFile(canvas, layer, pad.images_json, file, 600, () => saveScratchpadNow(false));
}

function renderScratchpadView() {
  _ensureScratchpadBinding();
  const ws = state.activeWorkspace || 'mrl';
  const titleMap = {
    mrl: 'VỞ NHÁP GHI CHÚ NHANH · PHÂN HỆ MRL',
    plc: 'VỞ NHÁP GHI CHÚ NHANH · LẬP TRÌNH PLC',
    network: 'VỞ NHÁP GHI CHÚ NHANH · MẠNG TRUYỀN THÔNG',
    english: 'VỞ NHÁP TIẾNG ANH · ĐỌC DỊCH MANUAL & TẠO QUIZ',
  };
  document.getElementById('scratchpad-title').textContent = titleMap[ws] || titleMap.mrl;
  document.getElementById('scratchpad-sample-manual-btn')?.classList.toggle('hidden', ws !== 'english');
  document.getElementById('scratchpad-to-quiz-btn')?.classList.toggle('hidden', ws !== 'english');

  if (!state.scratchpads[ws]) state.scratchpads[ws] = { workspace: ws, content: '', images_json: [], font_mode: 'sans' };
  const pad = state.scratchpads[ws];
  if (!Array.isArray(pad.images_json)) pad.images_json = [];

  const ta = document.getElementById('scratchpad-textarea');
  const canvas = document.getElementById('scratchpad-canvas');
  const layer = document.getElementById('scratchpad-images-layer');
  if (ta.value !== (pad.content || '')) ta.value = pad.content || '';
  const isMono = pad.font_mode === 'mono';
  ta.classList.toggle('mono-mode', isMono);
  document.getElementById('scratchpad-font-btn').textContent = `Font: ${isMono ? 'Kỹ thuật (Mono)' : 'Chữ thường'}`;

  renderFloatingCanvasLayer(canvas, layer, pad.images_json, Math.max(540, window.innerHeight - 130), () => saveScratchpadNow(false));
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

async function saveScratchpadNow(showNotify = false) {
  clearTimeout(_scratchpadTimer);
  const ws = state.activeWorkspace || 'mrl';
  if (!state.scratchpads[ws]) state.scratchpads[ws] = { workspace: ws, content: '', images_json: [], font_mode: 'sans' };
  const pad = state.scratchpads[ws];
  const ta = document.getElementById('scratchpad-textarea');
  if (ta && state.activeTab === 'scratchpad') pad.content = ta.value;

  const stEl = document.getElementById('scratchpad-status');
  try {
    const res = await fetch(`/api/scratchpads/${encodeURIComponent(ws)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: pad.content || '',
        images_json: pad.images_json || [],
        font_mode: pad.font_mode || 'sans',
      }),
    });
    if (!res.ok) throw new Error(state.appLang === 'en' ? 'Scratchpad save failed' : 'Lưu nháp thất bại');
    const saved = await res.json();
    state.scratchpads[ws] = saved;
    if (stEl) {
      stEl.textContent = state.appLang === 'en' ? 'AUTO-SAVED' : 'ĐÃ LƯU TỰ ĐỘNG';
      stEl.style.color = 'var(--green)';
    }
    const badge = document.querySelector('#tab-btn-scratchpad .nav-count');
    if (badge) badge.textContent = (saved.content?.trim() || saved.images_json?.length) ? '●' : '';
    if (state.splitMode && state.pane2.group === 'scratchpad' && (state.pane2.ws || 'plc') === ws) {
      const p2ta = document.getElementById('pane2-scratchpad-textarea');
      if (p2ta && document.activeElement !== p2ta) renderPane2Scratchpad();
    }
    if (showNotify) showToast(state.appLang === 'en' ? 'Scratchpad saved' : 'Đã lưu trang nháp', 'success');
  } catch (err) {
    if (stEl) {
      stEl.textContent = state.appLang === 'en' ? 'SAVE FAILED' : 'LỖI LƯU NHÁP';
      stEl.style.color = 'var(--red)';
    }
    if (showNotify) showToast(err.message, 'error');
  }
}

function toggleScratchpadFont() {
  const ws = state.activeWorkspace || 'mrl';
  if (!state.scratchpads[ws]) state.scratchpads[ws] = { workspace: ws, content: '', images_json: [], font_mode: 'sans' };
  state.scratchpads[ws].font_mode = state.scratchpads[ws].font_mode === 'mono' ? 'sans' : 'mono';
  renderScratchpadView();
  saveScratchpadNow(false);
}

function triggerScratchpadImagePick() {
  pickCanvasImageFile((file) => insertPastedImageIntoScratchpad(file));
}

async function clearScratchpad() {
  if (!await uiConfirm('Xóa sạch toàn bộ chữ và ảnh trên trang nháp hiện tại?')) return;
  const ws = state.activeWorkspace || 'mrl';
  state.scratchpads[ws] = { workspace: ws, content: '', images_json: [], font_mode: state.scratchpads[ws]?.font_mode || 'sans' };
  document.getElementById('scratchpad-textarea').value = '';
  renderScratchpadView();
  await saveScratchpadNow(true);
}

