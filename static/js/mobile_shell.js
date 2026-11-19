/* ==========================================================================
   MRL Native Mobile App Shell & Desktop Mobile/Cloud Modal Controller
   - Strictly separated from Desktop views; renders responsive navigation on <768px
   ========================================================================== */
(function () {
  'use strict';

  const MOBILE_BP = '(max-width: 767px)';
  let _lastPlcNetWs = 'plc';
  let _mobileSyncOpen = false;
  let _mobileDetail = null; // { kind, id }

  function isMobileViewport() {
    return window.matchMedia(MOBILE_BP).matches;
  }

  function _setBodyMobileClasses() {
    const isMob = isMobileViewport();
    document.body.classList.toggle('is-mobile-ui', isMob);
    if (!isMob) {
      document.body.classList.remove('mobile-detail-open', 'mobile-sync-open');
      _mobileDetail = null;
      _mobileSyncOpen = false;
    }
    _syncMobileChrome();
  }

  // -------------------------------------------------------------------------
  // Mobile Sub-bar & Bottom Navigation Sync
  // -------------------------------------------------------------------------
  function _activeBottomGroup() {
    if (_mobileSyncOpen) return 'sync';
    if (!state.activeWorkspace) return 'home';
    if (state.activeWorkspace === 'plc' || state.activeWorkspace === 'network') return 'plc_net';
    if (state.activeWorkspace === 'english') return 'english';
    return 'repair';
  }

  function _syncMobileChrome() {
    const navEl = document.getElementById('mobile-bottom-nav');
    const subEl = document.getElementById('mobile-subbar');
    const fabEl = document.getElementById('mobile-fab');
    const isEn = state.appLang === 'en';

    const grp = _activeBottomGroup();
    if (navEl) {
      navEl.querySelectorAll('.mob-nav-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-mob-tab') === grp);
      });
    }

    if (!isMobileViewport()) return;

    // FAB visibility
    if (fabEl) {
      const FAB_TABS = ['repairs', 'knowledge', 'plc', 'network', 'en-vocab-bank'];
      const showFab = Boolean(state.activeWorkspace) && !_mobileSyncOpen && !_mobileDetail && FAB_TABS.includes(state.activeTab);
      fabEl.classList.toggle('hidden', !showFab);
    }

    if (!subEl) return;
    if (!state.activeWorkspace || _mobileSyncOpen) {
      subEl.classList.add('hidden');
      subEl.innerHTML = '';
      return;
    }

    let pills = [];
    if (state.activeWorkspace === 'mrl') {
      pills = [
        { lbl: isEn ? 'Repair Cases' : 'Ca sửa chữa', on: state.activeTab === 'repairs', act: "mobileSubGo('mrl','repairs')" },
        { lbl: isEn ? 'Knowledge & SOP' : 'Kiến thức & SOP', on: state.activeTab === 'knowledge', act: "mobileSubGo('mrl','knowledge')" },
        { lbl: isEn ? 'Cross-Ref Dict' : 'Từ điển mã lỗi', on: state.activeTab === 'dictionary', act: "mobileSubGo('mrl','dictionary')" },
        { lbl: isEn ? 'Flashcards' : 'Flashcard MRL', on: state.activeTab === 'flashcards', act: "mobileSubGo('mrl','flashcards')" },
      ];
    } else if (state.activeWorkspace === 'plc' || state.activeWorkspace === 'network') {
      pills = [
        { lbl: '02 // PLC', on: state.activeWorkspace === 'plc' && state.activeTab === 'plc', act: "mobileSubGo('plc','plc')" },
        { lbl: '03 // NETWORK', on: state.activeWorkspace === 'network' && state.activeTab === 'network', act: "mobileSubGo('network','network')" },
        { lbl: isEn ? 'Drills' : 'Ôn tập', on: state.activeTab === 'flashcards', act: `mobileSubGo('${state.activeWorkspace}','flashcards')` },
        { lbl: isEn ? 'Scratchpad' : 'Vở nháp', on: state.activeTab === 'scratchpad', act: `mobileSubGo('${state.activeWorkspace}','scratchpad')` },
      ];
    } else if (state.activeWorkspace === 'english') {
      pills = [
        { lbl: isEn ? '01 Study Today' : '01 Học hôm nay', on: state.activeTab === 'en-quiz', act: "mobileSubGo('english','en-quiz')" },
        { lbl: isEn ? '02 Combat Lab' : '02 Thực chiến', on: state.activeTab === 'en-coach', act: "mobileSubGo('english','en-coach')" },
        { lbl: isEn ? '03 Vocab Bank' : '03 Kho từ & AI', on: state.activeTab === 'en-vocab-bank', act: "mobileSubGo('english','en-vocab-bank')" },
      ];
    }

    subEl.classList.remove('hidden');
    subEl.innerHTML = pills.map((p) =>
      `<button type="button" class="mob-sub-pill ${p.on ? 'active' : ''}" onclick="${p.act}">${p.lbl}</button>`
    ).join('');
  }

  window.mobileSubGo = function (ws, tab) {
    closeMobileDetailOverlay(false);
    _mobileSyncOpen = false;
    document.body.classList.remove('mobile-sync-open');
    if (ws === 'plc' || ws === 'network') _lastPlcNetWs = ws;
    if (state.activeWorkspace !== ws) enterWorkspace(ws, tab);
    else switchTab(tab);
    _syncMobileChrome();
  };

  window.mobileNavGo = function (target) {
    closeMobileDetailOverlay(false);
    if (target === 'sync') {
      _mobileSyncOpen = true;
      document.body.classList.add('mobile-sync-open');
      renderMobileSyncPanel();
      _syncMobileChrome();
      return;
    }
    _mobileSyncOpen = false;
    document.body.classList.remove('mobile-sync-open');

    if (target === 'home') {
      openPortalScreen();
      _syncMobileChrome();
      return;
    }
    if (target === 'repair') {
      enterWorkspace('mrl', 'repairs');
    } else if (target === 'plc_net') {
      const ws = _lastPlcNetWs === 'network' ? 'network' : 'plc';
      enterWorkspace(ws, ws);
    } else if (target === 'english') {
      const tab = (state.activeTab && state.activeTab.startsWith('en-')) ? state.activeTab : 'en-quiz';
      enterWorkspace('english', tab);
    }
    _syncMobileChrome();
  };

  // -------------------------------------------------------------------------
  // Slide-Over Full-Screen Detail Navigation
  // -------------------------------------------------------------------------
  function _getDetailRecord(kind, id) {
    if (kind === 'repair') return (state.repairCases || []).find((x) => x.id === id);
    if (kind === 'knowledge') return (state.knowledgeItems || []).find((x) => x.id === id);
    if (kind === 'plc') return (state.plcNotes || []).find((x) => x.id === id);
    if (kind === 'network') return (state.networkNotes || []).find((x) => x.id === id);
    if (kind === 'english_card') return (state.englishCards || []).find((x) => String(x.id) === String(id));
    return null;
  }

  function _updateDetailTopbar() {
    if (!_mobileDetail) return;
    const rec = _getDetailRecord(_mobileDetail.kind, _mobileDetail.id);
    const idEl = document.getElementById('mob-detail-id');
    const stEl = document.getElementById('mob-detail-status');
    const backEl = document.getElementById('mob-back-btn');
    const isEn = state.appLang === 'en';
    if (backEl) backEl.textContent = isEn ? '← Back to list' : '← Quay lại danh sách';
    if (idEl) {
      const titleHint = rec?.brand_model || rec?.topic_model || rec?.title || rec?.target_device || rec?.term || '';
      idEl.textContent = titleHint ? `${_mobileDetail.id} · ${titleHint}` : String(_mobileDetail.id);
    }
    if (stEl) {
      const showStatus = ['repair', 'knowledge', 'plc', 'network'].includes(_mobileDetail.kind);
      stEl.classList.toggle('hidden', !showStatus);
      if (showStatus && rec) stEl.value = rec.status_code || 'review';
    }
  }

  window.openMobileDetailOverlay = function (kind, id, pushHist = true) {
    if (!isMobileViewport()) return;
    _mobileDetail = { kind, id };
    _updateDetailTopbar();
    document.body.classList.add('mobile-detail-open');
    if (pushHist) {
      try { history.pushState({ mrlMobDetail: true }, ''); } catch (_) {}
    }
    _syncMobileChrome();
  };

  window.closeMobileDetailOverlay = function (fromPop = false) {
    if (!_mobileDetail && !document.body.classList.contains('mobile-detail-open')) return;
    _mobileDetail = null;
    document.body.classList.remove('mobile-detail-open');
    _syncMobileChrome();
    if (!fromPop && history.state && history.state.mrlMobDetail) {
      try { history.back(); } catch (_) {}
    }
  };

  window.onMobileDetailStatusChange = async function (nextStatus) {
    if (!_mobileDetail || !['repair', 'knowledge', 'plc', 'network'].includes(_mobileDetail.kind)) return;
    if (typeof quickUpdateStatus === 'function') {
      await quickUpdateStatus(_mobileDetail.kind, _mobileDetail.id, nextStatus);
      _updateDetailTopbar();
    }
  };

  window.addEventListener('popstate', () => {
    if (document.body.classList.contains('mobile-detail-open')) {
      closeMobileDetailOverlay(true);
    }
  });

  window.mobileFabAction = function () {
    const tab = state.activeTab;
    if (tab === 'repairs' && typeof openRepairModal === 'function') openRepairModal();
    else if (tab === 'knowledge' && typeof openKnowledgeModal === 'function') openKnowledgeModal();
    else if (tab === 'plc' && typeof openPlcModal === 'function') openPlcModal();
    else if (tab === 'network' && typeof openNetworkModal === 'function') openNetworkModal();
    else if (state.activeWorkspace === 'english' && typeof openEnVocabEditorModal === 'function') openEnVocabEditorModal();
  };

  // Wrap selection handlers AFTER all desktop scripts have loaded so taps on list cards open slide-over
  function _bindMobileHooks() {
    const pairs = [
      ['selectRepairCase', 'repair'],
      ['selectKnowledgeItem', 'knowledge'],
      ['selectPlcNote', 'plc'],
      ['selectNetworkNote', 'network'],
      ['selectEnBankItem', 'english_card'],
    ];
    pairs.forEach(([fnName, kind]) => {
      const orig = window[fnName];
      if (typeof orig !== 'function' || orig._mobWrapped) return;
      const wrapped = function (id) {
        const out = orig.apply(this, arguments);
        if (isMobileViewport()) openMobileDetailOverlay(kind, id);
        return out;
      };
      wrapped._mobWrapped = true;
      window[fnName] = wrapped;
    });

    // Wrap openPortalScreen / enterWorkspace / switchTab so bottom nav & subbar always stay in sync
    ['openPortalScreen', 'enterWorkspace', 'switchTab'].forEach((fnName) => {
      const orig = window[fnName];
      if (typeof orig !== 'function' || orig._mobNavWrapped) return;
      const wrapped = function () {
        if (fnName === 'enterWorkspace' && (arguments[0] === 'plc' || arguments[0] === 'network')) {
          _lastPlcNetWs = arguments[0];
        }
        const out = orig.apply(this, arguments);
        _syncMobileChrome();
        return out;
      };
      wrapped._mobNavWrapped = true;
      window[fnName] = wrapped;
    });
  }

  // Touch tap-to-flip on English SRS Flashcard face
  document.addEventListener('click', (ev) => {
    if (!isMobileViewport()) return;
    const front = ev.target.closest?.('.srs-fc-front');
    if (!front) return;
    if (ev.target.closest('button, a, input, textarea, select')) return;
    if (typeof flipSrsFlashcard === 'function') flipSrsFlashcard();
  });

  // -------------------------------------------------------------------------
  // Mobile Sync View (#view-mobile-sync) & Desktop Sync Modal (#mobile-sync-modal)
  // -------------------------------------------------------------------------
  function _syncFormFieldsHtml(prefix, syncCfg) {
    const isEn = state.appLang === 'en';
    const hasTok = Boolean(syncCfg.has_token || syncCfg.github_token);
    const gid = syncCfg.gist_id || '';
    const autoOn = syncCfg.auto_sync !== false;
    const lastAt = syncCfg.last_sync_at || (isEn ? 'Never synced' : 'Chưa đồng bộ');
    const lastSt = syncCfg.last_sync_status || (isEn ? 'Ready' : 'Sẵn sàng');
    return `
      <div class="msync-card">
        <div class="msync-card-title">☁️ ${isEn ? 'TWO-WAY CLOUD SYNC (GITHUB PRIVATE GIST)' : 'ĐỒNG BỘ 2 CHIỀU ĐÁM MÂY (GITHUB PRIVATE GIST)'}</div>
        <div style="font-size:12.5px;color:var(--text-3);margin-bottom:8px;">
          ${isEn
            ? 'Free 24/7 private sync across PC & Phone using a GitHub Personal Access Token (scope: gist).'
            : 'Miễn phí 100%, hoạt động 24/7 ngay cả khi tắt máy tính. Dùng Personal Access Token (quyền <code>gist</code>).'}
        </div>
        <div class="msync-status-line" id="${prefix}-sync-status-line">
          ${escapeHtml(lastSt)} · <span class="mono">${escapeHtml(lastAt)}</span>
        </div>
        <div class="fgrid c2" style="margin-top:10px;">
          <div>
            <label class="lbl">GitHub Personal Access Token ${hasTok ? '<b style="color:var(--green);">✓ Đã lưu</b>' : ''}</label>
            <input id="${prefix}-gh-token" class="inp mono" type="password" autocomplete="off"
              placeholder="${hasTok ? '******** (giữ nguyên nếu không đổi)' : 'ghp_... hoặc github_pat_...'}" />
          </div>
          <div>
            <label class="lbl">Private Gist ID</label>
            <input id="${prefix}-gist-id" class="inp mono" type="text" value="${escapeHtml(gid)}"
              placeholder="${isEn ? 'Auto-filled when created...' : 'Tự tạo hoặc dán Gist ID để nối PC & ĐT...'}" />
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12.5px;cursor:pointer;">
          <input id="${prefix}-auto-sync" type="checkbox" ${autoOn ? 'checked' : ''} />
          <span>${isEn ? 'Auto two-way sync on app start / mobile edits' : 'Tự động đồng bộ 2 chiều khi mở máy tính / sửa trên điện thoại'}</span>
        </label>
        <div class="msync-actions ${prefix === 'mob' ? 'msync-actions-mob' : ''}" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
          <button type="button" class="btn btn-sm msync-act-sub" onclick="createMobileGistNow('${prefix}')">✨ ${isEn ? 'Create Gist' : 'Tạo Gist mới'}</button>
          <button type="button" class="btn btn-sm msync-act-sub" onclick="saveMobileSyncConfig('${prefix}')">💾 ${isEn ? 'Save Config' : 'Lưu cấu hình'}</button>
          <button type="button" class="btn btn-sm btn-primary msync-act-main" onclick="triggerCloudSyncNow('${prefix}')">🔄 ${isEn ? 'Sync Now' : 'Đồng bộ Cloud ngay'}</button>
        </div>
      </div>`;
  }

  window.renderMobileSyncPanel = async function () {
    const host = document.getElementById('view-mobile-sync');
    if (!host) return;
    const isEn = state.appLang === 'en';
    const mode = window.MRLCoreStore ? MRLCoreStore.getMode() : 'offline';
    const cfg = window.MRLSyncEngine ? MRLSyncEngine.getConfig() : {};
    let srvInfo = null;
    if (mode === 'online') {
      try { srvInfo = await fetch('/api/mobile-info').then((r) => (r.ok ? r.json() : null)); } catch (_) {}
    }
    const syncCfg = srvInfo?.cloud_sync || cfg;
    const totalRec = (state.repairCases?.length || 0) + (state.knowledgeItems?.length || 0) + (state.plcNotes?.length || 0) + (state.networkNotes?.length || 0);
    const totalCards = (state.englishCards || []).length;

    host.innerHTML = `
      <div class="mob-sync-head">
        <div class="mob-sync-title">☁️ ${isEn ? 'Sync, Backup & Mobile Settings' : 'Đồng bộ Cloud & Cài đặt Mobile'}</div>
        <span class="badge mono" style="color:${mode === 'online' ? 'var(--green)' : '#818CF8'};">
          ${mode === 'online' ? '🟢 PC LAN' : '📱 OFFLINE IDB'}
        </span>
      </div>

      <div class="msync-card">
        <div class="msync-card-title">📊 ${isEn ? 'DEVICE STORAGE STATUS' : 'TRẠNG THÁI DỮ LIỆU TRÊN MÁY'}</div>
        <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px;">
          <span>${isEn ? 'Technical Records (MRL / PLC / NET):' : 'Bản ghi Kỹ thuật (MRL / PLC / NET):'}</span>
          <b>${totalRec}</b>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13.5px;">
          <span>${isEn ? 'English SRS Flashcards:' : 'Thẻ từ vựng Tiếng Anh SRS:'}</span>
          <b>${totalCards}</b>
        </div>
      </div>

      ${_syncFormFieldsHtml('mob', syncCfg)}

      <div class="msync-card">
        <div class="msync-card-title">🤖 ${isEn ? 'AI & INTERFACE PREFERENCES' : 'AI GEMINI & GIAO DIỆN'}</div>
        <div class="mob-sync-grid-btns">
          <button type="button" class="btn" onclick="openAiConfigModal()">🔑 Gemini Key (${state.hasGeminiKey ? 'ON' : 'OFF'})</button>
          <button type="button" class="btn" onclick="setAppLanguage('${state.appLang === 'en' ? 'vi' : 'en'}'); renderMobileSyncPanel();">🌐 ${state.appLang === 'en' ? 'Ngôn ngữ: EN → VI' : 'Ngôn ngữ: VI → EN'}</button>
          <button type="button" class="btn" onclick="document.querySelector('.theme-btn')?.click(); renderMobileSyncPanel();">◑ ${document.documentElement.dataset.theme === 'light' ? 'Dark Mode' : 'Light Mode'}</button>
          <button type="button" class="btn btn-indigo" onclick="MRLCoreStore.checkOtaUpdate()">🚀 OTA Update</button>
        </div>
      </div>

      <div class="msync-card">
        <div class="msync-card-title">💾 ${isEn ? 'LOCAL JSON BACKUP' : 'SAO LƯU / PHỤC HỒI FILE JSON'}</div>
        <div class="mob-sync-grid-btns">
          <button type="button" class="btn" onclick="MRLSyncEngine.exportBackupJson()">📤 ${isEn ? 'Export JSON' : 'Xuất JSON'}</button>
          <label class="btn" style="cursor:pointer;">
            📥 ${isEn ? 'Import JSON' : 'Nhập JSON'}
            <input type="file" accept=".json,application/json" style="display:none" onchange="onMobileBackupFilePick(event)" />
          </label>
        </div>
      </div>`;
  };

  window.onMobileBackupFilePick = async function (ev) {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f || !window.MRLSyncEngine) return;
    try {
      const st = await MRLSyncEngine.importBackupJson(f);
      showToast(`Đã hợp nhất JSON (↓${st.pulled} ↑${st.pushed} 🗑${st.deleted})`, 'success');
      renderMobileSyncPanel();
    } catch (err) {
      showToast(err.message || 'Lỗi nhập file JSON', 'error');
    }
  };

  // Desktop Modal: 📱 Mobile & Cloud Sync
  window.openMobileSyncModal = async function () {
    const modal = document.getElementById('mobile-sync-modal');
    const body = document.getElementById('mobile-sync-modal-body');
    if (!modal || !body) return;
    modal.classList.remove('hidden');
    body.innerHTML = '<div class="empty-box">⏳ Đang kiểm tra IP LAN & trạng thái Cloud Sync...</div>';

    let info = null;
    try {
      const res = await fetch('/api/mobile-info');
      if (res.ok) info = await res.json();
    } catch (_) {}

    const lanUrl = info?.lan_url || window.location.origin;
    const lanReachable = info?.lan_reachable;
    const qrSvg = info?.qr_svg || '';
    const syncCfg = info?.cloud_sync || (window.MRLSyncEngine ? MRLSyncEngine.getConfig() : {});
    const distMeta = info?.mobile_dist;
    const ghPages = info?.gh_pages || {};
    const ghLiveUrl = ghPages.live_url || ghPages.last_url || '';
    const ghStatusText = ghPages.last_status
      ? `${escapeHtml(ghPages.last_status)}${ghPages.last_published_at ? ` · <span class="mono">${escapeHtml(ghPages.last_published_at)}</span>` : ''}`
      : (ghLiveUrl
        ? `Sẵn sàng đẩy tới <span class="mono">${escapeHtml(ghPages.repo_slug)} (${escapeHtml(ghPages.branch || 'main')})</span>`
        : 'Nhập Repo GitHub Pages (VD: <code>username/mrl-mobile</code>) để bật 1-Click Publish.');
    const lanStatusHtml =
      lanReachable === true
        ? `<div class="msync-status-line" style="margin-top:8px;border-color:rgba(16,185,129,0.45);color:#34D399;">🟢 Máy chủ Wi-Fi LAN đang mở (<code>${escapeHtml(lanUrl)}</code>) — sẵn sàng quét QR!</div>`
        : lanReachable === false
        ? `<div class="msync-status-line" style="margin-top:8px;border-color:rgba(239,68,68,0.45);color:#F87171;">🔴 Máy chủ hiện chỉ lắng nghe <code>127.0.0.1</code> (chưa mở Wi-Fi LAN). Hãy tắt toàn bộ cửa sổ MRL rồi mở lại bằng <code>MRL.lnk</code> hoặc <code>MRL.exe</code>.</div>`
        : '';

    body.innerHTML = `
      <div class="msync-card">
        <div class="msync-card-title">📶 MỞ NHANH TRÊN ĐIỆN THOẠI QUA CÙNG MẠNG WI-FI (TEST &amp; CÀI PWA)</div>
        <div class="msync-lan-grid">
          <div class="msync-qr-box">${qrSvg || '<span class="mono">QR Unavailable</span>'}</div>
          <div>
            <div style="font-size:12.5px;color:var(--text-2);line-height:1.55;">
              1. Kết nối điện thoại cùng mạng Wi-Fi với máy tính này.<br />
              2. Quét mã QR bên cạnh bằng Camera điện thoại hoặc mở địa chỉ:
            </div>
            <div class="msync-url-row">
              <input id="desk-lan-url-inp" class="inp mono" type="text" readonly value="${escapeHtml(lanUrl)}" />
              <button type="button" class="btn btn-sm btn-primary" onclick="copyLanUrlToClipboard()">📋 Copy</button>
            </div>
            ${lanStatusHtml}
            <div style="font-size:11.5px;color:var(--text-3);margin-top:6px;">
              💡 Trong trình duyệt điện thoại, bấm <b>Thêm vào Màn hình chính (Add to Home Screen)</b> để dùng toàn màn hình như App gốc.
            </div>
          </div>
        </div>
      </div>

      ${_syncFormFieldsHtml('desk', syncCfg)}

      <div class="msync-card">
        <div class="msync-card-title">🚀 ĐÓNG GÓI MOBILE ĐỘC LẬP (CHẠY KHI TẮT MÁY TÍNH + OTA AUTO-UPDATE)</div>
        <div style="font-size:12.5px;color:var(--text-3);margin-bottom:8px;">
          Xuất toàn bộ giao diện Mobile PWA + dữ liệu từ <code>mrl_database.db</code> ra <code>mobile_dist/</code> và đẩy thẳng lên GitHub Pages chỉ với 1 click (tự xóa <code>.git</code> &amp; kiểm tra sạch Token/DB trước khi push).
        </div>
        <div id="desk-dist-meta" class="msync-status-line" style="margin-bottom:10px;">
          ${distMeta
            ? `✓ Bản đóng gói gần nhất: <span class="mono">${escapeHtml(distMeta.built_at)}</span> · ${distMeta.seed_records} bản ghi + ${distMeta.seed_cards || 57} thẻ SRS · ${distMeta.files_count} files`
            : 'Chưa đóng gói mobile_dist/ trong lần chạy này.'}
        </div>
        <div class="fgrid c2" style="margin-bottom:8px;">
          <div>
            <label class="lbl">GitHub Pages Repo</label>
            <input id="desk-ghpages-repo" class="inp mono" type="text" value="${escapeHtml(ghPages.repo_slug || '')}" placeholder="tên-github/mrl-mobile" />
          </div>
          <div>
            <label class="lbl">Branch</label>
            <input id="desk-ghpages-branch" class="inp mono" type="text" value="${escapeHtml(ghPages.branch || 'main')}" placeholder="main" />
          </div>
        </div>
        <div style="margin-bottom:8px;">
          <label class="lbl">Token đẩy Repo (tùy chọn — bỏ trống sẽ tự dùng Token Cloud Sync ở trên, cần quyền repo) ${ghPages.has_own_token ? '<b style="color:var(--green);">✓ Đã lưu riêng</b>' : ''}</label>
          <input id="desk-ghpages-token" class="inp mono" type="password" autocomplete="off"
            placeholder="${ghPages.has_own_token ? '******** (giữ nguyên nếu không đổi)' : 'Bỏ trống để dùng lại Token Cloud Sync ở trên (hoặc dán Token có quyền repo)'}" />
        </div>
        <div id="desk-ghpages-status" class="msync-status-line" style="margin-bottom:10px;">
          ${ghStatusText}${ghLiveUrl ? ` · <a href="${escapeHtml(ghLiveUrl)}" target="_blank" rel="noopener" style="color:var(--amber);text-decoration:underline;">${escapeHtml(ghLiveUrl)}</a>` : ''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" id="desk-publish-gh-btn" class="btn btn-sm btn-primary" onclick="triggerPublishGithubPages()">☁️ Build &amp; Đẩy lên GitHub Pages</button>
          <button type="button" id="desk-build-dist-btn" class="btn btn-sm btn-indigo" onclick="triggerBuildMobileDist()">🚀 Xuất &amp; Cập nhật gói Mobile (mobile_dist/)</button>
          <button type="button" class="btn btn-sm" onclick="saveGithubPagesConfig()">💾 Lưu Repo</button>
          <button type="button" class="btn btn-sm" onclick="MRLSyncEngine.exportBackupJson()">📤 Tải Snapshot JSON</button>
        </div>
      </div>`;
  };

  window.closeMobileSyncModal = function () {
    document.getElementById('mobile-sync-modal')?.classList.add('hidden');
  };

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      const m = document.getElementById('mobile-sync-modal');
      if (m && !m.classList.contains('hidden')) closeMobileSyncModal();
    }
  });

  window.copyLanUrlToClipboard = function () {
    const v = document.getElementById('desk-lan-url-inp')?.value || '';
    if (!v) return;
    navigator.clipboard?.writeText?.(v)
      .then(() => showToast('Đã copy địa chỉ Wi-Fi LAN: ' + v, 'success'))
      .catch(() => showToast('Copy thủ công: ' + v, 'info'));
  };

  function _readSyncInputs(prefix) {
    const tok = (document.getElementById(`${prefix}-gh-token`)?.value || '').trim();
    const gid = (document.getElementById(`${prefix}-gist-id`)?.value || '').trim();
    const auto = Boolean(document.getElementById(`${prefix}-auto-sync`)?.checked ?? true);
    return { tok, gid, auto };
  }

  window.saveMobileSyncConfig = async function (prefix) {
    const { tok, gid, auto } = _readSyncInputs(prefix);
    const mode = window.MRLCoreStore ? MRLCoreStore.getMode() : 'online';
    try {
      if (mode === 'online') {
        const res = await fetch('/api/sync/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ github_token: tok || '__KEEP__', gist_id: gid, auto_sync: auto }),
        });
        if (!res.ok) throw new Error('Không thể lưu cấu hình Sync');
      }
      MRLSyncEngine.saveConfig({ github_token: tok || '__KEEP__', gist_id: gid, auto_sync: auto });
      showToast('Đã lưu cấu hình Cloud Sync', 'success');
      if (prefix === 'desk') openMobileSyncModal();
      else renderMobileSyncPanel();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.createMobileGistNow = async function (prefix) {
    const { tok } = _readSyncInputs(prefix);
    try {
      showToast('⏳ Đang tạo Private Gist trên GitHub...', 'info');
      const data = await MRLSyncEngine.createPrivateGist(tok || undefined);
      const gidInput = document.getElementById(`${prefix}-gist-id`);
      if (gidInput) gidInput.value = data.gist_id || '';
      showToast(`✓ Đã tạo Private Gist: ${data.gist_id}`, 'success');
      if (prefix === 'desk') openMobileSyncModal();
      else renderMobileSyncPanel();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.triggerCloudSyncNow = async function (prefix) {
    const { tok, gid, auto } = _readSyncInputs(prefix);
    if (window.MRLSyncEngine) MRLSyncEngine.saveConfig({ auto_sync: auto });
    try {
      showToast('🔄 Đang đồng bộ 2 chiều với Cloud...', 'info');
      const res = await MRLSyncEngine.syncNow(tok || undefined, gid || undefined);
      showToast(`✓ Đồng bộ xong (↓${res.pulled} ↑${res.pushed} 🗑${res.deleted})`, 'success');
      if (prefix === 'desk') openMobileSyncModal();
      else renderMobileSyncPanel();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.triggerBuildMobileDist = async function () {
    const btn = document.getElementById('desk-build-dist-btn');
    if (btn) btn.disabled = true;
    try {
      showToast('⏳ Đang xuất gói PWA độc lập (mobile_dist/)...', 'info');
      const res = await fetch('/api/mobile/build-dist', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Build mobile_dist thất bại');
      showToast(`✓ Đã xuất mobile_dist/ (${data.files_count} files, ${data.seed_records} bản ghi)`, 'success');
      openMobileSyncModal();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.saveGithubPagesConfig = async function () {
    const repo = (document.getElementById('desk-ghpages-repo')?.value || '').trim();
    const branch = (document.getElementById('desk-ghpages-branch')?.value || 'main').trim() || 'main';
    const tok = (document.getElementById('desk-ghpages-token')?.value || '').trim();
    try {
      const res = await fetch('/api/mobile/github-pages-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_slug: repo,
          branch,
          github_token: tok || '__KEEP__',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Không thể lưu cấu hình GitHub Pages');
      showToast(`✓ Đã lưu Repo GitHub Pages: ${data.repo_slug || '(trống)'} (${data.branch})`, 'success');
      openMobileSyncModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.triggerPublishGithubPages = async function () {
    const btn = document.getElementById('desk-publish-gh-btn');
    const buildBtn = document.getElementById('desk-build-dist-btn');
    const statusEl = document.getElementById('desk-ghpages-status');
    const distEl = document.getElementById('desk-dist-meta');
    const repo = (document.getElementById('desk-ghpages-repo')?.value || '').trim();
    const branch = (document.getElementById('desk-ghpages-branch')?.value || 'main').trim() || 'main';
    const ownTok = (document.getElementById('desk-ghpages-token')?.value || '').trim();
    const syncTok = (document.getElementById('desk-gh-token')?.value || '').trim();
    const tokenToSend = ownTok || syncTok || '';

    if (!repo) {
      showToast('Vui lòng nhập GitHub Pages Repo (dạng username/mrl-mobile)', 'error');
      document.getElementById('desk-ghpages-repo')?.focus();
      return;
    }

    if (btn) btn.disabled = true;
    if (buildBtn) buildBtn.disabled = true;
    if (statusEl) {
      statusEl.innerHTML = '⏳ Đang build <code>mobile_dist/</code> &amp; đẩy lên GitHub Pages...';
    }
    try {
      showToast('☁️ Đang build & đẩy mobile_dist/ lên GitHub Pages...', 'info');
      const res = await fetch('/api/mobile/publish-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_slug: repo,
          branch,
          github_token: tokenToSend,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Đẩy lên GitHub Pages thất bại');

      const liveUrl = data.live_url || '';
      const stamp = data.build_stamp || '';
      if (statusEl) {
        statusEl.innerHTML = `✓ Đã đẩy bản <span class="mono">${escapeHtml(stamp)}</span> lên GitHub Pages — chờ ~1 phút rồi bấm <b>OTA Update</b> trên điện thoại${liveUrl ? ` · <a href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener" style="color:var(--amber);text-decoration:underline;">${escapeHtml(liveUrl)}</a>` : ''}`;
      }
      if (distEl && data.built_at) {
        distEl.innerHTML = `✓ Bản đóng gói gần nhất: <span class="mono">${escapeHtml(data.built_at)}</span> · ${data.seed_records} bản ghi + ${data.seed_cards || 57} thẻ SRS · ${data.files_count} files`;
      }
      const ownTokInp = document.getElementById('desk-ghpages-token');
      if (ownTokInp) ownTokInp.value = '';
      showToast(`✓ Đã đẩy bản ${stamp} lên GitHub Pages thành công!`, 'success');
    } catch (err) {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:#F87171;">✗ ${escapeHtml(err.message)}</span>`;
      }
      showToast(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
      if (buildBtn) buildBtn.disabled = false;
    }
  };

  // Lifecycle & Resize listener
  window.addEventListener('resize', _setBodyMobileClasses);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      _setBodyMobileClasses();
      setTimeout(_bindMobileHooks, 0);
    });
  } else {
    _setBodyMobileClasses();
    _bindMobileHooks();
  }
})();
