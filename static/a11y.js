/* MRL — lớp trợ năng (accessibility) bổ sung.
   Chạy độc lập với app.js: tự gắn ARIA, bàn phím và quản lý focus cho cả
   phần tử render động (innerHTML). */
(function () {
  'use strict';

  const ICON_LABELS = { '×': 'Đóng', '✕': 'Đóng', '✖': 'Đóng', '«': 'Ẩn', '☰': 'Menu', '←': 'Quay lại', '→': 'Tiếp' };
  const OVERLAYS = {
    'crossref-overlay': 'crossref-title',
    'repair-modal': 'repair-modal-title',
    'knowledge-modal': 'knowledge-modal-title',
    'plc-modal': 'plc-modal-title',
    'network-modal': 'network-modal-title',
    'category-manager-modal': 'cat-mgr-title',
    'en-vocab-modal': 'en-vocab-modal-title',
    'en-vocab-edit-modal': 'en-vocab-edit-modal-title',
    'en-ai-config-modal': 'en-ai-config-title',
  };
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function setIf(el, attr, val) {
    if (val != null && el.getAttribute(attr) !== String(val)) el.setAttribute(attr, val);
  }

  /* ---------- Nhãn cho nút chỉ có icon / ký tự ---------- */
  function labelButton(btn) {
    if (btn.hasAttribute('aria-label') || btn.hasAttribute('aria-labelledby')) return;
    const text = (btn.textContent || '').trim();
    const title = btn.getAttribute('title');
    if (text.length > 1 && /[\p{L}\p{N}]/u.test(text)) return;
    const label = title || ICON_LABELS[text];
    if (label) btn.setAttribute('aria-label', label);
  }

  /* ---------- Nhãn cho input / select chưa có label ---------- */
  function labelField(el) {
    if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return;
    if (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) return;
    if (el.closest('label')) return;
    // Trong form: label nằm ngay trước control trong cùng khối.
    const prev = el.previousElementSibling;
    if (prev && prev.tagName === 'LABEL') {
      if (!prev.id) prev.id = 'lbl-' + Math.random().toString(36).slice(2, 9);
      el.setAttribute('aria-labelledby', prev.id);
      return;
    }
    let label = el.getAttribute('title') || el.getAttribute('placeholder');
    if (!label && el.tagName === 'SELECT' && el.options && el.options[0]) {
      label = el.options[0].textContent.split(':')[0].trim();
    }
    if (label) el.setAttribute('aria-label', label.replace(/\s+/g, ' ').trim());
  }

  /* ---------- Phần tử div/span có onclick -> dùng được bằng bàn phím ---------- */
  function makeClickable(el) {
    if (el.dataset.a11yKb) return;
    const tag = el.tagName.toLowerCase();
    if (['button', 'a', 'input', 'select', 'textarea', 'label', 'img', 'summary'].includes(tag)) return;
    if (el.classList.contains('overlay') || el.classList.contains('lightbox')) return;
    el.dataset.a11yKb = '1';
    if (!el.hasAttribute('role')) el.setAttribute('role', el.classList.contains('etab') ? 'tab' : 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.addEventListener('keydown', function (e) {
      if (e.target !== el) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  }

  /* ---------- Trạng thái bật/tắt cho chip, segment, nav ---------- */
  function syncState(root) {
    root.querySelectorAll('.chip, .seg button, .ws-pill, .pane2-pill').forEach(function (b) {
      const on = b.classList.contains('active') || b.classList.contains('on');
      setIf(b, 'aria-pressed', on ? 'true' : 'false');
    });
    root.querySelectorAll('.nav-item').forEach(function (b) {
      if (b.classList.contains('active')) setIf(b, 'aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    root.querySelectorAll('.etab').forEach(function (t) {
      setIf(t, 'aria-selected', (t.classList.contains('is-p1') || t.classList.contains('is-p2')) ? 'true' : 'false');
    });
  }

  function enhance(root) {
    root.querySelectorAll('button').forEach(labelButton);
    root.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(labelField);
    root.querySelectorAll('[onclick]').forEach(makeClickable);
    syncState(root);
  }

  /* ---------- Overlay / modal: role, focus trap, trả focus ---------- */
  const opener = new Map();

  function setupOverlays() {
    Object.keys(OVERLAYS).forEach(function (id) {
      const ov = document.getElementById(id);
      if (!ov) return;
      const dlg = ov.querySelector('.modal, .drawer') || ov;
      setIf(dlg, 'role', 'dialog');
      setIf(dlg, 'aria-modal', 'true');
      if (document.getElementById(OVERLAYS[id])) setIf(dlg, 'aria-labelledby', OVERLAYS[id]);
      ov.querySelectorAll('.ov-x').forEach(function (b) { setIf(b, 'aria-label', 'Đóng'); });
    });
    const lb = document.getElementById('lightbox-modal');
    if (lb) { setIf(lb, 'role', 'dialog'); setIf(lb, 'aria-modal', 'true'); setIf(lb, 'aria-label', 'Xem ảnh phóng to'); }
    const toast = document.getElementById('toast-container');
    if (toast) { setIf(toast, 'role', 'status'); setIf(toast, 'aria-live', 'polite'); }
    const tabs = document.getElementById('editor-tabs-list');
    if (tabs) setIf(tabs, 'role', 'tablist');
    const nav = document.getElementById('sidebar-nav');
    if (nav) setIf(nav, 'aria-label', 'Điều hướng phân hệ');
  }

  function isVisible(el) { return el && !el.classList.contains('hidden'); }

  function onOverlayToggle(ov) {
    const visible = isVisible(ov);
    if (visible && !opener.has(ov)) {
      opener.set(ov, document.activeElement);
      requestAnimationFrame(function () {
        if (ov.contains(document.activeElement)) return;
        const target = ov.querySelector('input:not([type=hidden]),select,textarea') ||
          ov.querySelector('.ov-x') || ov.querySelector(FOCUSABLE);
        if (target) target.focus();
      });
    } else if (!visible && opener.has(ov)) {
      const back = opener.get(ov);
      opener.delete(ov);
      if (back && document.contains(back) && typeof back.focus === 'function') back.focus();
    }
  }

  function trapTab(e) {
    if (e.key !== 'Tab') return;
    const open = Array.from(document.querySelectorAll('.overlay:not(.hidden), .lightbox:not(.hidden)')).pop();
    if (!open) return;
    const items = Array.from(open.querySelectorAll(FOCUSABLE)).filter(function (n) { return n.offsetParent !== null; });
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (!open.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- Khởi chạy + theo dõi DOM động ---------- */
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; enhance(document); });
  }

  function init() {
    setupOverlays();
    enhance(document);
    document.addEventListener('keydown', trapTab, true);
    const mo = new MutationObserver(function (muts) {
      for (const m of muts) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          const t = m.target;
          if (t.classList.contains('overlay') || t.classList.contains('lightbox')) onOverlayToggle(t);
        }
      }
      schedule();
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
