/* MRL — lớp UX bổ sung: bộ lọc gọn, toast, skeleton, xác nhận, empty state,
   chế độ sáng, sidebar responsive. Không phụ thuộc vào cấu trúc nội bộ của app. */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ======================= Chế độ sáng / tối ======================= */
  const THEME_KEY = 'mrl-theme';
  function currentTheme() { return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'; }
  function applyTheme(theme) {
    if (theme === 'light') document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* bỏ qua */ }
    $$('.theme-btn').forEach(updateThemeBtn);
  }
  function updateThemeBtn(btn) {
    const light = currentTheme() === 'light';
    const isEn = document.documentElement.dataset.lang === 'en';
    const label = isEn
      ? (light ? 'Dark Mode' : 'Light Mode')
      : (light ? 'Chế độ tối' : 'Chế độ sáng');
    btn.textContent = (light ? '◑ ' : '◐ ') + label;
    btn.title = label + ' (Ctrl+Shift+L)';
    btn.setAttribute('aria-label', label + ' (Ctrl+Shift+L)');
    btn.setAttribute('aria-pressed', light ? 'true' : 'false');
  }
  function toggleTheme() { applyTheme(currentTheme() === 'light' ? 'dark' : 'light'); }
  function mountThemeButtons() {
    [$('.portal-top-right'), $('.ws-nav-head')].forEach(function (host) {
      if (!host || $('.theme-btn', host)) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-sm theme-btn' + (host.classList.contains('ws-nav-head') ? ' theme-btn-block' : '');
      b.addEventListener('click', toggleTheme);
      updateThemeBtn(b);
      host.appendChild(b);
    });
  }

  /* ======================= Bộ lọc gọn trên toolbar ======================= */
  const FILTER_LABELS = {
    'fc-mode-filter': 'Chế độ hỏi',
    'fc-status-filter': 'Trạng thái ôn',
    'fc-type-filter': 'Loại thẻ',
  };
  let filterSeq = 0;

  function selectLabel(sel) {
    if (FILTER_LABELS[sel.id]) return FILTER_LABELS[sel.id];
    const first = sel.options[0] ? sel.options[0].textContent : '';
    return first.includes(':') ? first.split(':')[0].trim() : (sel.getAttribute('aria-label') || 'Bộ lọc');
  }

  function activeFilterCount(selects) {
    return selects.filter(function (s) { return s.options[0] && s.value !== s.options[0].value; }).length;
  }

  function buildFilterMenu(toolbar) {
    if (toolbar.dataset.filterMenu) return;
    const selects = $$(':scope > select.sel:not([data-no-filter-menu])', toolbar);
    if (selects.length < 2) return;
    toolbar.dataset.filterMenu = '1';

    const id = 'filter-pop-' + (++filterSeq);
    const wrap = document.createElement('div');
    wrap.className = 'filter-menu';
    wrap.innerHTML =
      '<button type="button" class="btn btn-sm filter-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="' + id + '">' +
      '⚙ Bộ lọc <span class="filter-badge hidden">0</span></button>' +
      '<div id="' + id + '" class="filter-pop hidden" role="group" aria-label="Bộ lọc"></div>';
    toolbar.insertBefore(wrap, selects[0]);

    const toggle = $('.filter-toggle', wrap);
    const badge = $('.filter-badge', wrap);
    const pop = $('.filter-pop', wrap);

    selects.forEach(function (sel) {
      const lab = document.createElement('label');
      lab.append(selectLabel(sel));
      sel.style.maxWidth = '';
      lab.appendChild(sel);
      pop.appendChild(lab);
    });
    const foot = document.createElement('div');
    foot.className = 'filter-pop-foot';
    foot.innerHTML = '<button type="button" class="btn btn-sm">Đặt lại bộ lọc</button>';
    pop.appendChild(foot);

    function refresh() {
      const n = activeFilterCount(selects);
      badge.textContent = String(n);
      badge.classList.toggle('hidden', n === 0);
      toggle.classList.toggle('pin-active', n > 0);
    }
    function setOpen(open) {
      pop.classList.toggle('hidden', !open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        pop.style.left = '0'; pop.style.right = 'auto';
        const r = pop.getBoundingClientRect();
        if (r.right > window.innerWidth - 8) { pop.style.left = 'auto'; pop.style.right = '0'; }
        const r2 = pop.getBoundingClientRect();
        if (r2.left < 8) { pop.style.right = 'auto'; pop.style.left = (8 - r2.left) + 'px'; }
      }
    }
    toggle.addEventListener('click', function (e) { e.stopPropagation(); setOpen(pop.classList.contains('hidden')); });
    pop.addEventListener('change', refresh);
    pop.addEventListener('click', function (e) { e.stopPropagation(); });
    $('button', foot).addEventListener('click', function () {
      selects.forEach(function (s) {
        if (s.options[0] && s.value !== s.options[0].value) {
          s.value = s.options[0].value;
          s.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      refresh();
    });
    wrap._close = function () { setOpen(false); };
    wrap._refresh = refresh;
    refresh();
  }

  function mountFilterMenus() { $$('.toolbar').forEach(buildFilterMenu); }

  document.addEventListener('click', function () {
    $$('.filter-menu').forEach(function (m) { if (m._close) m._close(); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    const open = $$('.filter-pop').find(function (p) { return !p.classList.contains('hidden'); });
    if (!open) return;
    e.stopPropagation();
    const menu = open.closest('.filter-menu');
    if (menu && menu._close) menu._close();
    const t = $('.filter-toggle', menu);
    if (t) t.focus();
  }, true);

  /* ======================= Toast nâng cấp ======================= */
  const TOAST_ICONS = { success: '✓', error: '!', info: 'i' };
  window.showToast = function (message, type) {
    type = TOAST_ICONS[type] ? type : 'info';
    const box = document.getElementById('toast-container');
    if (!box) return;
    message = String(message == null ? '' : message);

    const dup = Array.from(box.children).find(function (t) { return t.dataset.msg === message && t.dataset.type === type; });
    if (dup) {
      const n = (Number(dup.dataset.count) || 1) + 1;
      dup.dataset.count = String(n);
      $('.toast-count', dup).textContent = ' ×' + n;
      dup._restart();
      return;
    }
    while (box.children.length >= 4) box.firstElementChild.remove();

    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.dataset.msg = message;
    t.dataset.type = type;
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const ico = document.createElement('span'); ico.className = 'toast-ico'; ico.textContent = TOAST_ICONS[type]; ico.setAttribute('aria-hidden', 'true');
    const msg = document.createElement('span'); msg.className = 'toast-msg'; msg.textContent = message;
    const cnt = document.createElement('span'); cnt.className = 'toast-count';
    msg.appendChild(cnt);
    const x = document.createElement('button'); x.type = 'button'; x.className = 'toast-x'; x.textContent = '×'; x.setAttribute('aria-label', document.documentElement.dataset.lang === 'en' ? 'Close notification' : 'Đóng thông báo');
    t.append(ico, msg, x);
    box.appendChild(t);

    const ms = type === 'error' ? 7000 : (type === 'success' ? 2800 : 3600);
    let timer = null, hovering = false;
    function close() { clearTimeout(timer); t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 260); }
    function arm() { clearTimeout(timer); t.style.opacity = '1'; timer = setTimeout(function () { if (!hovering) close(); }, ms); }
    t._restart = arm;
    x.addEventListener('click', close);
    t.addEventListener('mouseenter', function () { hovering = true; clearTimeout(timer); });
    t.addEventListener('mouseleave', function () { hovering = false; arm(); });
    arm();
  };

  /* ======================= Hộp xác nhận ======================= */
  window.uiConfirm = function (message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      const isEn = document.documentElement.dataset.lang === 'en';
      const danger = opts.danger != null ? opts.danger : /xóa|ghi đè|delete|remove|clear|reset/i.test(String(message));
      const previous = document.activeElement;
      const ov = document.createElement('div');
      ov.className = 'overlay center';
      ov.innerHTML =
        '<div class="modal narrow confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="ui-confirm-title" aria-describedby="ui-confirm-msg" style="max-width:440px;">' +
        '<div class="ov-head"><div class="ov-title" id="ui-confirm-title"><span></span></div></div>' +
        '<div class="ov-body"><div class="confirm-msg" id="ui-confirm-msg"></div>' +
        '<div class="form-foot"><button type="button" class="btn" data-act="no"></button><button type="button" class="btn" data-act="yes"></button></div></div></div>';
      $('#ui-confirm-title span', ov).textContent = opts.title || (isEn ? (danger ? 'Confirm Action' : 'Confirm') : (danger ? 'Xác nhận thao tác' : 'Xác nhận'));
      $('#ui-confirm-msg', ov).textContent = String(message);
      const no = $('[data-act=no]', ov), yes = $('[data-act=yes]', ov);
      no.textContent = opts.cancelText || (isEn ? 'Cancel' : 'Hủy');
      yes.textContent = opts.confirmText || (isEn ? (danger ? 'Yes, Continue' : 'Confirm') : (danger ? 'Đồng ý, tiếp tục' : 'Đồng ý'));
      yes.classList.add(danger ? 'btn-danger-solid' : 'btn-primary');
      document.body.appendChild(ov);

      let done = false;
      function finish(val) {
        if (done) return;
        done = true;
        document.removeEventListener('keydown', onKey, true);
        ov.remove();
        if (previous && document.contains(previous) && previous.focus) previous.focus();
        resolve(val);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
        else if (e.key === 'Enter' && document.activeElement === yes) { e.preventDefault(); e.stopPropagation(); finish(true); }
      }
      document.addEventListener('keydown', onKey, true);
      no.addEventListener('click', function () { finish(false); });
      yes.addEventListener('click', function () { finish(true); });
      ov.addEventListener('mousedown', function (e) { if (e.target === ov) finish(false); });
      (danger ? no : yes).focus();
    });
  };

  /* ======================= Skeleton + nút bận ======================= */
  const SKEL_ROW = '<div class="skel-row"><span class="skel w30"></span><span class="skel w90"></span><span class="skel w60"></span></div>';
  function skeletonList() { return '<div class="skel-wrap" aria-hidden="true">' + SKEL_ROW.repeat(6) + '</div>'; }

  function wrapBootstrap() {
    const orig = window.fetchBootstrap;
    if (typeof orig !== 'function' || orig._uiWrapped) return;
    const wrapped = async function () {
      const targets = $$('.list-body').filter(function (el) { return !el.children.length; });
      targets.forEach(function (el) { el.innerHTML = skeletonList(); });
      try { return await orig.apply(this, arguments); }
      finally { targets.forEach(function (el) { if (el.querySelector('.skel-wrap')) el.innerHTML = ''; }); }
    };
    wrapped._uiWrapped = true;
    window.fetchBootstrap = wrapped;
  }

  function wrapSubmit(name) {
    const orig = window[name];
    if (typeof orig !== 'function' || orig._uiWrapped) return;
    const wrapped = async function (ev) {
      const form = ev && ev.target;
      const btn = form && form.querySelector ? form.querySelector('[type=submit]') : null;
      if (btn) {
        if (btn.disabled) { if (ev.preventDefault) ev.preventDefault(); return; }
        btn.disabled = true; btn.classList.add('is-busy');
        btn.dataset.label = btn.textContent; btn.textContent = 'Đang lưu…';
      }
      try { return await orig.apply(this, arguments); }
      finally {
        if (btn) { btn.disabled = false; btn.classList.remove('is-busy'); btn.textContent = btn.dataset.label; }
      }
    };
    wrapped._uiWrapped = true;
    window[name] = wrapped;
  }

  function mountPortalSkeleton() {
    const grid = document.getElementById('portal-grid');
    if (grid && !grid.children.length) grid.innerHTML = '<div class="skel-card"></div><div class="skel-card"></div><div class="skel-card"></div><div class="skel-card"></div>';
  }

  /* ======================= Empty state có hướng dẫn ======================= */
  function clearFilters(view) {
    if (!view) return;
    const tb = $('.toolbar', view);
    if (!tb) return;
    $$('input.inp[type=text]', tb).forEach(function (i) { if (i.value) { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); } });
    $$('select.sel', tb).forEach(function (s) {
      if (s.options[0] && s.value !== s.options[0].value) { s.value = s.options[0].value; s.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    const chip = $('.chips .chip', tb);
    if (chip && !chip.classList.contains('active')) chip.click();
    $$('.filter-menu', tb).forEach(function (m) { if (m._refresh) m._refresh(); });
  }

  function decorateEmpty(el) {
    if (el.dataset.ui) return;
    if (!el.closest('.list-body, .detail-pane')) return;
    el.dataset.ui = '1';
    const text = (el.textContent || '').toUpperCase();
    const ico = document.createElement('span'); ico.className = 'empty-ico'; ico.setAttribute('aria-hidden', 'true');
    const hint = document.createElement('span'); hint.className = 'empty-hint';
    if (/PHÙ HỢP|KHÔNG TÌM THẤY/.test(text) && el.closest('.list-body')) {
      ico.textContent = '⌕';
      hint.textContent = 'Thử đổi từ khóa hoặc bỏ bớt bộ lọc.';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn-sm'; b.textContent = 'Xóa bộ lọc';
      b.addEventListener('click', function () { clearFilters(el.closest('.view')); });
      el.prepend(ico); el.append(hint, b);
    } else if (/^\s*CHƯA CHỌN/.test(text)) {
      ico.textContent = '☷';
      hint.textContent = 'Chọn một mục ở danh sách bên cạnh để xem chi tiết.';
      el.prepend(ico); el.append(hint);
    }
  }

  /* ======================= Sidebar responsive ======================= */
  document.addEventListener('click', function (e) {
    const app = document.getElementById('app-shell');
    if (e.target === app && window.innerWidth <= 960 && !app.classList.contains('sidebar-collapsed') && typeof window.toggleLeftSidebar === 'function') {
      window.toggleLeftSidebar();
    }
  });


  /* ======================= Esc đóng sidebar (màn hẹp) ======================= */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || window.innerWidth > 960) return;
    const app = document.getElementById('app-shell');
    if (!app || app.classList.contains('hidden') || app.classList.contains('sidebar-collapsed')) return;
    if ($('.overlay:not(.hidden), .lightbox:not(.hidden)') || typeof window.toggleLeftSidebar !== 'function') return;
    e.preventDefault(); e.stopPropagation();
    window.toggleLeftSidebar();
  }, true);

  /* ======================= Tab đang chọn luôn nằm trong tầm nhìn ======================= */
  let lastActiveTab = '';
  function revealActiveTab() {
    const el = $('.etab.is-p1');
    const sig = el ? (el.getAttribute('title') || el.textContent) : '';
    if (!el || sig === lastActiveTab) return;
    lastActiveTab = sig;
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  /* ======================= Phím tắt ======================= */
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); toggleTheme(); }
  });

  /* ======================= Khởi chạy ======================= */
  let queued = false;
  function sweep() {
    mountFilterMenus();
    mountThemeButtons();
    revealActiveTab();
    $$('.empty:not([data-ui])').forEach(decorateEmpty);
  }
  function init() {
    wrapBootstrap();
    ['submitRepairForm', 'submitKnowledgeForm', 'submitPlcForm', 'submitNetworkForm', 'submitEnVocabEditorForm', 'submitAiConfigForm'].forEach(wrapSubmit);
    mountPortalSkeleton();
    sweep();
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; sweep(); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  // Script nằm cuối <body> nên DOM đã sẵn sàng; chạy ngay để bọc hàm trước khi app tự khởi động.
  init();
})();
