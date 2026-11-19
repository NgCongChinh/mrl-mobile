// ---------------------------------------------------------------------------
// 10 Phân hệ 04 // ENGLISH — Technical English & OpenQuiz AI v2
//   - Tab 01 (en-quiz):       Motivation Dashboard + Ôn tập SRS & 4 Chế độ
//   - Tab 02 (en-coach):      Phòng Thực Chiến 1-1 (Dịch câu & Phỏng vấn + Mic + Keyword Lamps)
//   - Tab 03 (en-reading):    Tạo Bài Đọc Hiểu Kỹ Thuật Tự Động (Highlight + 3 MCQ)
//   - Tab 04 (en-vocab-bank): Kho Từ vựng & Lexical Chunks + SM-2 Telemetry
//   - Tab 05 (en-ingest):     Phễu Nạp Dữ Liệu Nhanh (Magic Fill / Quét 83 ca MRL / Manual Extract)
// ---------------------------------------------------------------------------

const SAMPLE_MANUAL_EXCERPTS = {
  yaskawa:
    'During power-up, the pre-charge resistor limits the high inrush current into the DC Bus capacitors.\n' +
    'If the bootstrap capacitor loses capacitance, the high-side IGBT gate driver fails to turn on properly.\n' +
    'Inspect the optocoupler isolation IC if the PWM gate pulse is distorted or missing.\n' +
    'When a Variable Frequency Drive (VFD) trips on Undervoltage (UV1), disconnect the motor leads and check DC Bus voltage.',
  siemens:
    'Main [OB1]: the PLC program scan cycle repeats infinitely from top to bottom.\n' +
    'Cyclic interrupt [OB30] automatically interrupts OB1 at a fixed 100ms sampling time for Analog and PID control.\n' +
    'To prevent a CPU STOP upon station failure, add Organization Block OB86 for wire break detection on PROFINET.\n' +
    'As shown in the wiring diagram, install 120Ω terminating resistors across terminals A+ and B- to avoid ground loop noise.',
};

// Event delegation an toàn cho speech & clipboard (tránh lỗi dấu nháy đơn trong onclick HTML)
document.addEventListener('click', (ev) => {
  const sp = ev.target.closest?.('[data-speak]');
  if (sp) {
    ev.stopPropagation();
    const txt = sp.getAttribute('data-speak') || '';
    const rate = Number(sp.getAttribute('data-rate') || '0.94');
    if (typeof speakEnglishText === 'function') speakEnglishText(txt, rate);
    return;
  }
  const cp = ev.target.closest?.('[data-copy-txt]');
  if (cp) {
    ev.stopPropagation();
    copyCoachSampleText(cp.getAttribute('data-copy-txt') || '');
  }
});

function _syncAiKeyButtons() {
  const isEn = state.appLang === 'en';
  const txt = state.hasGeminiKey
    ? (isEn ? '🔑 Gemini AI: ENABLED' : '🔑 Gemini AI: ĐÃ BẬT')
    : (isEn ? '🔑 Gemini API Key (Offline)' : '🔑 Cấu hình Gemini API Key (Offline)');
  ['en-top-ai-cfg-btn'].forEach((id) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.textContent = txt;
    b.classList.toggle('btn-green', Boolean(state.hasGeminiKey));
  });
}

function copyCoachSampleText(text) {
  const clean = String(text || '');
  if (!clean) return;
  navigator.clipboard?.writeText?.(clean)
    .then(() => showToast(state.appLang === 'en' ? 'Copied sample sentence' : 'Đã copy câu mẫu', 'success'))
    .catch(() => showToast(state.appLang === 'en' ? 'Copy failed' : 'Không thể copy', 'error'));
}

function _applyEnglishCardsResponse(data) {
  if (!data || typeof data !== 'object') return;
  const prevGoalReached = Boolean(state.englishStreak?.goal_reached);
  if (Array.isArray(data.english_cards)) state.englishCards = data.english_cards;
  if (Array.isArray(data.english_vocab)) state.englishVocab = data.english_vocab;
  if (Array.isArray(data.en_vocabulary)) state.enVocabulary = data.en_vocabulary;
  if (Array.isArray(data.english_combat_drills)) state.englishCombatDrills = data.english_combat_drills;
  if (data.srs_counts) state.srsCounts = data.srs_counts;
  if (data.english_streak) {
    state.englishStreak = data.english_streak;
    if (!prevGoalReached && data.english_streak.goal_reached) {
      showToast(
        state.appLang === 'en'
          ? '🎉 Daily goal reached (15/15)! Streak flame lit!'
          : '🎉 Xuất sắc! Đã hoàn thành mục tiêu 15 thẻ hôm nay — Chuỗi ngày học đang rực sáng!',
        'success'
      );
    }
  }
  if (typeof syncEnUiState === 'function') syncEnUiState();
  if (typeof renderStreakBadges === 'function') renderStreakBadges();
  if (typeof renderHeaderStats === 'function') renderHeaderStats();
}

function _srsStageLabel(stage) {
  const st = String(stage || 'new').toLowerCase();
  if (state.appLang === 'en') {
    if (st === 'mastered') return 'Mastered';
    if (st === 'learning') return 'Learning';
    if (st === 'review') return 'Review';
    return 'New';
  }
  if (st === 'mastered') return 'Đã làm chủ';
  if (st === 'learning') return 'Đang học';
  if (st === 'review') return 'Cần ôn tập';
  return 'Từ mới';
}

function _previewSm2Intervals(card) {
  const ef = Number(card?.ease_factor || 2.5);
  const ivl = Number(card?.interval_days || 0);
  const reps = Number(card?.repetitions || 0);
  const hard = ivl < 1 ? 1 : Math.max(1, Math.round(ivl * 1.2));
  let good = 1;
  if (reps === 0 || ivl <= 0) good = 1;
  else if (reps === 1 || ivl <= 1.5) good = 3;
  else good = Math.max(4, Math.round(ivl * ef));
  const easy = Math.max(4, Math.round(Math.max(1, ivl) * ef * 1.3));
  return { again: '10m', hard: `${hard}d`, good: `${good}d`, easy: `${easy}d` };
}

function _getSrsStudyDeck() {
  const cards = state.englishCards && state.englishCards.length ? state.englishCards : [];
  const f = state.openQuiz.srsFilter || 'due_now';
  const cat = state.openQuiz.categoryFilter || 'ALL';
  const nowStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace('T', ' ');

  let list = cards.filter((c) => {
    if (cat !== 'ALL' && c.category !== cat) return false;
    const st = String(c.srs_stage || 'new').toLowerCase();
    const nxt = String(c.next_review_at || '').trim();
    if (f === 'due_now') return (st === 'learning' || st === 'review') && (!nxt || nxt <= nowStr);
    if (f === 'learning') return st === 'learning';
    if (f === 'new') return st === 'new';
    if (f === 'mastered') return st === 'mastered';
    if (f === 'review') return st === 'review';
    return true;
  });

  // Fallback nhẹ nếu bộ lọc Due hôm nay đã sạch thẻ!
  return list;
}

// ===========================================================================
// TAB 01: MOTIVATION DASHBOARD & ÔN TẬP SRS ĐA CHẾ ĐỘ
// ===========================================================================
function setEnQuizStudyMode(mode) {
  state.openQuiz.studyMode = mode;
  state.openQuiz.cardFlipped = false;
  renderEnQuizView();
}

function setEnQuizSrsFilter(filterKey) {
  state.openQuiz.srsFilter = filterKey;
  state.openQuiz.cardIdx = 0;
  state.openQuiz.cardFlipped = false;
  renderEnQuizView();
}

function moveSrsCard(delta) {
  const deck = _getSrsStudyDeck();
  if (!deck.length) return;
  state.openQuiz.cardIdx = (state.openQuiz.cardIdx + delta + deck.length) % deck.length;
  state.openQuiz.cardFlipped = false;
  renderEnQuizView();
}

function flipSrsFlashcard() {
  state.openQuiz.cardFlipped = !state.openQuiz.cardFlipped;
  renderEnQuizView();
}

async function gradeSrsCard(cardId, grade) {
  try {
    const res = await fetch(`/api/english/cards/${encodeURIComponent(cardId)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade: Number(grade), mode: state.openQuiz.studyMode || 'flashcard' }),
    });
    if (!res.ok) throw new Error('Không thể lưu kết quả ôn tập SM-2');
    const data = await res.json();
    _applyEnglishCardsResponse(data);
    state.openQuiz.cardFlipped = false;

    const updatedDeck = _getSrsStudyDeck();
    if (state.openQuiz.cardIdx >= updatedDeck.length) {
      state.openQuiz.cardIdx = Math.max(0, updatedDeck.length - 1);
    } else if (state.openQuiz.srsFilter === 'ALL' || state.openQuiz.srsFilter === 'mastered') {
      state.openQuiz.cardIdx = (state.openQuiz.cardIdx + 1) % Math.max(1, updatedDeck.length);
    }

    const c = data.card;
    if (c) {
      const lbl = c.interval_days > 0 ? `${Math.round(c.interval_days)} ngày` : '10 phút';
      showToast(
        state.appLang === 'en'
          ? `SM-2 Updated "${c.term}" → Next review in ${c.interval_days > 0 ? Math.round(c.interval_days) + 'd' : '10m'} (+1 streak progress)`
          : `SM-2 đã lên lịch "${c.term}" → Ôn lại sau ${lbl} (+1 tiến độ hôm nay)`,
        grade >= 3 ? 'success' : 'info'
      );
    }
    renderEnQuizView();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function submitDictationCheck(cardId, expectedText) {
  const inp = document.getElementById('oq-dictation-ta');
  const typed = (inp?.value || state.openQuiz.dictationInputs[cardId] || '').trim();
  if (!typed) {
    showToast(state.appLang === 'en' ? 'Please type what you heard first' : 'Hãy gõ những gì bạn nghe được trước khi kiểm tra', 'info');
    return;
  }
  state.openQuiz.dictationInputs[cardId] = typed;
  const tok = (s) => String(s || '').replace(/[.,!?;:"'()\[\]]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const expWords = tok(expectedText);
  const usrWords = tok(typed);
  let hits = 0;
  const diffHtml = expWords.map((ew, i) => {
    const uw = usrWords[i] || '';
    const ok = uw.toLowerCase() === ew.toLowerCase() || usrWords.some((x) => x.toLowerCase() === ew.toLowerCase());
    if (ok) hits += 1;
    return `<span class="${ok ? 'diff-ok' : 'diff-err'}">${escapeHtml(ew)}${!ok && uw ? ` <small>(${state.appLang === 'en' ? 'typed:' : 'bạn gõ:'} ${escapeHtml(uw)})</small>` : ''}</span>`;
  }).join(' ');
  const pct = expWords.length ? Math.round((hits * 100) / expWords.length) : 0;
  state.openQuiz.dictationGraded[cardId] = { pct, diffHtml, expectedText, typed };
  renderEnQuizView();
}

function _buildCardQuizDeck(cards, mode) {
  const all = state.englishCards && state.englishCards.length ? state.englishCards : cards;
  return cards.map((c, idx) => {
    const distractors = all.filter((x) => x.id !== c.id).slice(0, 12);
    const picked = [];
    for (let i = 0; i < distractors.length && picked.length < 3; i += 1) {
      const cand = distractors[(idx * 3 + i) % distractors.length];
      if (cand && !picked.some((p) => p.id === cand.id)) picked.push(cand);
    }
    if (mode === 'cloze') {
      const ex = (c.example_en || `Check ${c.term} during VFD & PLC inspection.`).trim();
      const escTerm = c.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const blanked = new RegExp(escTerm, 'i').test(ex)
        ? ex.replace(new RegExp(escTerm, 'i'), '________')
        : `${ex} (________)`;
      const opts = [c.term, ...picked.map((p) => p.term)].sort((a, b) => a.length - b.length);
      return {
        id: `CARD-CLZ-${c.id}`,
        card_id: c.id,
        quiz_type: 'cloze',
        category: c.category,
        question_text: blanked,
        blank_answer: c.term,
        options: opts,
        correct_index: Math.max(0, opts.indexOf(c.term)),
        explanation_vi: `"${c.term}" (${c.ipa}) = ${c.meaning_vi}. ${c.example_vi || ''}`,
        context_quote: ex,
        source_ref: c.linked_record_id || c.id,
      };
    }
    const opts = [c.meaning_vi, ...picked.map((p) => p.meaning_vi)];
    // Deterministic rotate so correct answer moves across A/B/C/D
    const shift = idx % opts.length;
    const rotated = opts.slice(shift).concat(opts.slice(0, shift));
    return {
      id: `CARD-MCQ-${c.id}`,
      card_id: c.id,
      quiz_type: 'mcq',
      category: c.category,
      question_text: `Thuật ngữ / Cụm từ "${c.term}" ${c.ipa || ''} trong [${c.category}] có nghĩa chuẩn xác nào?`,
      options: rotated,
      correct_index: rotated.indexOf(c.meaning_vi),
      explanation_vi: `${c.term} (${c.word_class}): ${c.meaning_vi}. Collocations: ${c.collocations || 'N/A'}.`,
      context_quote: c.example_en || '',
      source_ref: c.linked_record_id || c.id,
    };
  });
}

function _getOpenQuizDeck() {
  const srsDeck = _getSrsStudyDeck();
  const baseCards = srsDeck.length ? srsDeck : (state.englishCards || []);
  const m = state.openQuiz.studyMode || 'flashcard';
  if (m === 'mcq' || m === 'cloze') {
    // Kết hợp câu từ custom/AI quizzes nếu có + câu sinh từ thẻ SRS đang chọn
    const qCat = state.openQuiz.categoryFilter || 'ALL';
    const stored = (state.englishQuizzes || []).filter((q) => q.quiz_type === m && (qCat === 'ALL' || q.category === qCat));
    const fromCards = _buildCardQuizDeck(baseCards, m);
    return state.openQuiz.sessionCustomDeck?.length ? state.openQuiz.sessionCustomDeck : (fromCards.length ? fromCards : stored);
  }
  const f = state.openQuiz.typeFilter || 'ALL';
  const cat = state.openQuiz.categoryFilter || 'ALL';
  return (state.englishQuizzes || []).filter((q) => {
    if (q.quiz_type === 'translate') return false;
    if (f !== 'ALL' && q.quiz_type !== f) return false;
    if (cat !== 'ALL' && q.category !== cat) return false;
    return true;
  });
}

function _activeQuizSessionDeck() {
  if (Array.isArray(state.openQuiz.sessionCustomDeck) && state.openQuiz.sessionCustomDeck.length) {
    return state.openQuiz.sessionCustomDeck;
  }
  return _getOpenQuizDeck();
}

function onEnQuizFilterChange() {
  const catSel = document.getElementById('en-quiz-cat-filter');
  state.openQuiz.categoryFilter = catSel?.value || 'ALL';
  state.openQuiz.sessionCustomDeck = null;
  state.openQuiz.cardIdx = 0;
  state.openQuiz.index = 0;
  state.openQuiz.cardFlipped = false;
  renderEnQuizView();
}

function toggleEnQuizGeneratorPanel() {
  state.openQuiz.showGenPanel = !state.openQuiz.showGenPanel;
  document.getElementById('en-quiz-gen-toggle-btn')?.classList.toggle('split-on', state.openQuiz.showGenPanel);
  renderEnQuizView();
}

function setOpenQuizSourceMode(mode) {
  state.openQuiz.sourceMode = mode;
  renderEnQuizView();
}

function fillSampleManualToOpenQuiz(which) {
  const txt = SAMPLE_MANUAL_EXCERPTS[which] || SAMPLE_MANUAL_EXCERPTS.siemens;
  state.openQuiz.manualDraft = txt;
  const ta = document.getElementById('oq-manual-ta');
  if (ta) ta.value = txt;
}

function focusOpenQuizPaste() {
  state.openQuiz.showGenPanel = true;
  state.openQuiz.sourceMode = 'manual_text';
  renderEnQuizView();
  setTimeout(() => document.getElementById('oq-manual-ta')?.focus(), 60);
}

async function generateOpenQuizNow() {
  const isEn = state.appLang === 'en';
  const srcMode = state.openQuiz.sourceMode || 'database';
  const manualTa = document.getElementById('oq-manual-ta');
  const manualText = (manualTa ? manualTa.value : state.openQuiz.manualDraft || '').trim();
  const cntSel = document.getElementById('oq-gen-count');
  const count = Number(cntSel?.value || 8);

  if (srcMode === 'manual_text' && manualText.length < 15) {
    showToast(isEn ? 'Please paste an English Manual excerpt (at least 15 characters)' : 'Vui lòng dán đoạn văn Manual tiếng Anh (tối thiểu 15 ký tự)', 'error');
    return;
  }

  const btn = document.getElementById('oq-generate-run-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = isEn ? '⏳ Generating...' : '⏳ Đang tạo đề...';
  }
  try {
    const res = await fetch('/api/english/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_mode: srcMode,
        category: state.openQuiz.categoryFilter || 'ALL',
        quiz_types: ['mcq', 'cloze'],
        count,
        manual_text: manualText,
        save_to_db: false,
      }),
    });
    if (!res.ok) throw new Error('Không thể tạo đề OpenQuiz');
    const data = await res.json();
    state.openQuiz.sessionCustomDeck = data.items || [];
    state.openQuiz.studyMode = 'mcq';
    state.openQuiz.index = 0;
    state.openQuiz.answers = {};
    state.openQuiz.clozeInputs = {};
    state.openQuiz.stats = { correct: 0, wrong: 0 };
    renderEnQuizView();
    showToast(
      isEn
        ? `Generated ${state.openQuiz.sessionCustomDeck.length} questions (${data.engine === 'gemini' ? 'Gemini AI' : 'Offline Engine'})`
        : `Đã tạo ${state.openQuiz.sessionCustomDeck.length} câu hỏi chuẩn OpenQuizAI (${data.engine === 'gemini' ? 'Gemini AI' : 'Offline Engine'})`,
      'success'
    );
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⚡ Tạo đề mới ngay';
    }
  }
}

function clearOpenQuizCustomSession() {
  state.openQuiz.sessionCustomDeck = null;
  state.openQuiz.index = 0;
  state.openQuiz.answers = {};
  state.openQuiz.clozeInputs = {};
  state.openQuiz.stats = { correct: 0, wrong: 0 };
  renderEnQuizView();
}

function _recalcOpenQuizStats(deck) {
  let correct = 0, wrong = 0;
  deck.forEach((q) => {
    const ans = state.openQuiz.answers[q.id];
    if (ans !== undefined && ans !== null) {
      if (Number(ans) === Number(q.correct_index)) correct += 1;
      else wrong += 1;
    }
  });
  state.openQuiz.stats = { correct, wrong };
}

async function selectOpenQuizOption(quizId, optIdx) {
  const deck = _activeQuizSessionDeck();
  const q = deck.find((x) => x.id === quizId);
  if (!q) return;
  state.openQuiz.answers[quizId] = optIdx;
  _recalcOpenQuizStats(deck);
  renderEnQuizView();
  if (q.card_id) {
    const ok = Number(optIdx) === Number(q.correct_index);
    // Tự động chấm nhẹ SM-2 cho thẻ nếu là Quiz/Cloze từ bộ thẻ SRS
    await fetch(`/api/english/cards/${encodeURIComponent(q.card_id)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade: ok ? 3 : 1, mode: state.openQuiz.studyMode }),
    }).then((r) => r.ok ? r.json() : null).then((d) => { if (d) _applyEnglishCardsResponse(d); }).catch(() => {});
  }
}

function submitClozeTypedAnswer(quizId) {
  const deck = _activeQuizSessionDeck();
  const q = deck.find((x) => x.id === quizId);
  if (!q) return;
  const inp = document.getElementById('oq-cloze-typed-input');
  const val = (inp?.value || '').trim();
  if (!val) {
    showToast(state.appLang === 'en' ? 'Enter a word/phrase or choose A/B/C/D below' : 'Hãy nhập từ tiếng Anh hoặc bấm chọn đáp án A/B/C/D bên dưới', 'info');
    return;
  }
  state.openQuiz.clozeInputs[quizId] = val;
  const target = (q.blank_answer || (q.options || [])[q.correct_index] || '').trim().toLowerCase();
  const norm = val.toLowerCase();
  const matchIdx = (q.options || []).findIndex((o) => o.trim().toLowerCase() === norm);
  if (norm === target) {
    selectOpenQuizOption(quizId, q.correct_index);
  } else {
    const wrongIdx = matchIdx >= 0 ? matchIdx : ((q.correct_index === 0) ? 1 : 0);
    selectOpenQuizOption(quizId, wrongIdx);
  }
}

function moveOpenQuiz(delta) {
  const deck = _activeQuizSessionDeck();
  if (!deck.length) return;
  state.openQuiz.index = (state.openQuiz.index + delta + deck.length) % deck.length;
  renderEnQuizView();
}

function restartOpenQuizSession() {
  state.openQuiz.index = 0;
  state.openQuiz.answers = {};
  state.openQuiz.clozeInputs = {};
  state.openQuiz.stats = { correct: 0, wrong: 0 };
  renderEnQuizView();
}

function _renderEnQuizCompactBar(srs) {
  const st = state.englishStreak || { current_streak: 0, longest_streak: 0, daily_goal: 15, today_done: 0, goal_reached: false };
  const goal = Number(st.daily_goal || 15);
  const done = Number(st.today_done || 0);
  const pct = Math.min(100, Math.round((done * 100) / Math.max(1, goal)));
  const isEn = state.appLang === 'en';
  const curFilter = state.openQuiz.srsFilter || 'due_now';

  const streakEl = document.getElementById('en-quiz-streak-pill');
  if (streakEl) {
    streakEl.classList.toggle('goal-reached', Boolean(st.goal_reached));
    streakEl.innerHTML = `
      <span class="streak-flame">🔥</span>
      <span>${isEn ? `${st.current_streak || 0}d streak` : `${st.current_streak || 0} ngày liên tiếp`}</span>
      <span class="streak-sep">·</span>
      <span>${isEn ? `Today: ${done}/${goal}` : `Hôm nay: ${done}/${goal}`}</span>
      <span class="streak-mini-bar"><i style="width:${pct}%"></i></span>`;
  }

  const pillsEl = document.getElementById('en-quiz-srs-pills');
  if (pillsEl) {
    pillsEl.innerHTML = `
      <button type="button" class="srs-cpill due ${curFilter === 'due_now' ? 'active' : ''}" onclick="setEnQuizSrsFilter('due_now')">
        <span>${isEn ? 'Due Today' : 'Cần ôn hôm nay'}</span><b>${srs.due_now}</b>
      </button>
      <button type="button" class="srs-cpill learning ${curFilter === 'learning' ? 'active' : ''}" onclick="setEnQuizSrsFilter('learning')">
        <span>${isEn ? 'Learning' : 'Đang học'}</span><b>${srs.learning}</b>
      </button>
      <button type="button" class="srs-cpill new ${curFilter === 'new' ? 'active' : ''}" onclick="setEnQuizSrsFilter('new')">
        <span>${isEn ? 'New' : 'Từ mới'}</span><b>${srs.new}</b>
      </button>
      <button type="button" class="srs-cpill mastered ${curFilter === 'mastered' ? 'active' : ''}" onclick="setEnQuizSrsFilter('mastered')">
        <span>${isEn ? 'Mastered' : 'Đã làm chủ'}</span><b>${srs.mastered}</b>
      </button>
      <button type="button" class="srs-cpill ${curFilter === 'ALL' ? 'active' : ''}" onclick="setEnQuizSrsFilter('ALL')">
        <span>${isEn ? 'All' : 'Tất cả'}</span><b>${srs.total}</b>
      </button>`;
  }

  const catSel = document.getElementById('en-quiz-cat-filter');
  if (catSel && typeof ENGLISH_CATEGORIES !== 'undefined') {
    const prev = state.openQuiz.categoryFilter || 'ALL';
    catSel.innerHTML = `<option value="ALL">${isEn ? 'Topic: All Categories' : 'Chủ đề: Tất cả'}</option>` +
      ENGLISH_CATEGORIES.filter((c) => c.key !== 'ALL').map((c) =>
        `<option value="${escapeHtml(c.key)}">${escapeHtml(isEn ? chipDisplayLabel(c) : c.key)}</option>`
      ).join('');
    catSel.value = Array.from(catSel.options).some((o) => o.value === prev) ? prev : 'ALL';
    state.openQuiz.categoryFilter = catSel.value;
  }
}

function renderEnQuizView() {
  _syncAiKeyButtons();
  const pillsEl = document.getElementById('en-quiz-type-pills');
  const container = document.getElementById('en-quiz-container');
  if (!container) return;

  const srs = computeClientSrsCounts(state.englishCards || []);
  _renderEnQuizCompactBar(srs);
  if (pillsEl) pillsEl.innerHTML = '';
  document.getElementById('en-quiz-gen-toggle-btn')?.classList.toggle('split-on', Boolean(state.openQuiz.showGenPanel));

  const studyMode = state.openQuiz.studyMode || 'flashcard';
  const modeTabsHtml = `
    <div class="srs-mode-tabs">
      <button type="button" class="srs-mode-btn ${studyMode === 'flashcard' ? 'active' : ''}" onclick="setEnQuizStudyMode('flashcard')">1. 🃏 Lật thẻ SRS (Flashcard)</button>
      <button type="button" class="srs-mode-btn ${studyMode === 'mcq' ? 'active' : ''}" onclick="setEnQuizStudyMode('mcq')">2. ⚡ Trắc nghiệm tốc độ (Multiple Choice)</button>
      <button type="button" class="srs-mode-btn ${studyMode === 'cloze' ? 'active' : ''}" onclick="setEnQuizStudyMode('cloze')">3. 🧩 Điền cụm từ (Cloze / Chunking Test)</button>
      <button type="button" class="srs-mode-btn ${studyMode === 'dictation' ? 'active' : ''}" onclick="setEnQuizStudyMode('dictation')">4. 🎧 Nghe chép chính tả (Audio Dictation)</button>
    </div>`;

  const srcMode = state.openQuiz.sourceMode || 'database';
  const genPanelHtml = state.openQuiz.showGenPanel ? `
    <div class="oq-gen-panel" style="margin-top:14px;">
      <div class="oq-gen-head">
        <span class="oq-gen-title">⚡ TẠO ĐỀ TRẮC NGHIỆM BỔ SUNG TỪ MANUAL (${state.hasGeminiKey ? 'GEMINI AI ENGINE' : 'OFFLINE RULE-BASED ENGINE'})</span>
        <div class="oq-src-tabs">
          <button type="button" class="oq-src-btn ${srcMode === 'database' ? 'active' : ''}" onclick="setOpenQuizSourceMode('database')">Chế độ 1: Từ Kho Từ &amp; 83 Ca MRL/PLC/NET</button>
          <button type="button" class="oq-src-btn ${srcMode === 'manual_text' ? 'active' : ''}" onclick="setOpenQuizSourceMode('manual_text')">Chế độ 2: Dán Manual Tiếng Anh (Paste Text)</button>
        </div>
      </div>
      ${srcMode === 'manual_text' ? `
        <div class="oq-manual-box">
          <textarea id="oq-manual-ta" class="oq-manual-ta" spellcheck="false" placeholder="Dán đoạn Manual tiếng Anh Yaskawa, Siemens TIA Portal hoặc Modbus/PROFINET vào đây..." oninput="state.openQuiz.manualDraft = this.value">${escapeHtml(state.openQuiz.manualDraft || '')}</textarea>
          <div class="oq-manual-actions">
            <button type="button" class="btn btn-sm" onclick="fillSampleManualToOpenQuiz('yaskawa')">📋 Mẫu Manual Biến tần VFD</button>
            <button type="button" class="btn btn-sm" onclick="fillSampleManualToOpenQuiz('siemens')">📋 Mẫu Manual Siemens OB86 / PROFINET</button>
            <select id="oq-gen-count" class="sel" data-no-filter-menu="1">
              <option value="6">6 câu</option><option value="8" selected>8 câu</option><option value="12">12 câu</option>
            </select>
            <button type="button" id="oq-generate-run-btn" class="btn btn-sm btn-indigo" onclick="generateOpenQuizNow()">⚡ Tạo đề mới ngay</button>
          </div>
        </div>` : `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <span style="font-size:12px;color:var(--muted);">Sinh nhanh câu hỏi trắc nghiệm từ kho thẻ SRS kết hợp dữ liệu MRL / PLC / Network:</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <select id="oq-gen-count" class="sel" data-no-filter-menu="1">
              <option value="6">6 câu</option><option value="8" selected>8 câu</option><option value="12">12 câu</option>
            </select>
            <button type="button" id="oq-generate-run-btn" class="btn btn-sm btn-indigo" onclick="generateOpenQuizNow()">⚡ Tạo đề mới ngay</button>
          </div>
        </div>`}
    </div>` : '';

  let bodyHtml = '';

  // ----- CHẾ ĐỘ 1: LẬT THẺ SRS (SM-2) -----
  if (studyMode === 'flashcard') {
    const srsDeck = _getSrsStudyDeck();
    if (!srsDeck.length) {
      bodyHtml = `
        <div class="empty-box" style="padding:28px;">
          <b>🎉 Đã hoàn tất toàn bộ thẻ trong nhóm lọc hiện tại!</b>
          <div style="margin-top:8px;color:var(--muted);">Bạn có thể chuyển sang bộ lọc "Tất cả thẻ", "Từ mới" hoặc sang Tab 02 / Tab 03 để thực chiến tiếp.</div>
          <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;">
            <button type="button" class="btn btn-sm btn-indigo" onclick="setEnQuizSrsFilter('new')">Học Từ mới (${srs.new})</button>
            <button type="button" class="btn btn-sm" onclick="setEnQuizSrsFilter('ALL')">Ôn Tất cả thẻ (${srs.total})</button>
          </div>
        </div>`;
    } else {
      const idx = Math.min(state.openQuiz.cardIdx, srsDeck.length - 1);
      const card = srsDeck[idx];
      const ivls = _previewSm2Intervals(card);
      const flipped = Boolean(state.openQuiz.cardFlipped);
      bodyHtml = `
        <div class="oq-progress-row">
          <div class="oq-progress-meta">
            <span>${state.appLang === 'en' ? `CARD ${idx + 1} / ${srsDeck.length}` : `THẺ ${idx + 1} / ${srsDeck.length}`}</span>
            <span class="badge mono">${escapeHtml(card.id)}</span>
            <span class="badge">${escapeHtml(_srsStageLabel(card.srs_stage))}</span>
            <span class="badge">${escapeHtml(card.category || '')}</span>
            ${card.word_class ? `<span class="badge">${escapeHtml(card.word_class)}</span>` : ''}
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn btn-sm" onclick="moveSrsCard(-1)">← Thẻ trước</button>
            <button type="button" class="btn btn-sm" onclick="moveSrsCard(1)">Thẻ sau →</button>
          </div>
        </div>

        <div class="srs-fc-card">
          <div class="srs-fc-front">
            <div class="srs-fc-term">${escapeHtml(card.term)}</div>
            <div class="srs-fc-ipa">${escapeHtml(card.ipa || '')}</div>
            <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">
              <button type="button" class="btn btn-sm" data-speak="${escapeHtml(card.term)}">🔊 Phát âm chuẩn</button>
              <button type="button" class="btn btn-sm" data-speak="${escapeHtml(card.term)}" data-rate="0.72">🐢 Đọc chậm</button>
              ${card.linked_record_id ? `<span class="badge mono">Nguồn: ${escapeHtml(card.linked_record_id)}</span>` : ''}
            </div>
            ${!flipped ? `
              <div style="margin-top:16px;">
                <button type="button" class="btn btn-indigo" onclick="flipSrsFlashcard()">👁️ Hiện nghĩa Tiếng Việt, Collocations &amp; Ví dụ</button>
              </div>
            ` : ''}
          </div>
          ${flipped ? `
            <div class="srs-fc-back">
              <div style="font-size:16px;font-weight:700;color:var(--green);margin-bottom:6px;">${escapeHtml(card.meaning_vi)}</div>
              ${card.collocations ? `<div style="font-size:12.5px;margin-bottom:8px;"><b style="color:#818CF8;">Collocations:</b> <span class="mono">${escapeHtml(card.collocations)}</span></div>` : ''}
              ${card.example_en ? `
                <div class="coach-sample-row" style="margin-bottom:8px;">
                  <div>
                    <div class="coach-sample-en">${escapeHtml(card.example_en)}</div>
                    <div style="font-size:12px;color:var(--muted);margin-top:3px;">${escapeHtml(card.example_vi || '')}</div>
                  </div>
                  <button type="button" class="btn btn-sm" data-speak="${escapeHtml(card.example_en)}">🔊 Nghe câu</button>
                </div>` : ''}
              <div style="font-size:11px;color:var(--muted);margin-top:6px;">SM-2 Hiện tại: Ease ${Number(card.ease_factor || 2.5).toFixed(2)} · Interval ${Number(card.interval_days || 0)}d · Repetitions ${Number(card.repetitions || 0)} · Chọn mức độ nhớ bên dưới để lên lịch:</div>
              <div class="srs-grade-bar">
                <button type="button" class="srs-grade-btn g1" onclick="gradeSrsCard('${escapeHtml(card.id)}', 1)"><span>1 - Quên (Again)</span><small>${ivls.again} · Reset</small></button>
                <button type="button" class="srs-grade-btn g2" onclick="gradeSrsCard('${escapeHtml(card.id)}', 2)"><span>2 - Khó (Hard)</span><small>${ivls.hard}</small></button>
                <button type="button" class="srs-grade-btn g3" onclick="gradeSrsCard('${escapeHtml(card.id)}', 3)"><span>3 - Tốt (Good)</span><small>${ivls.good}</small></button>
                <button type="button" class="srs-grade-btn g4" onclick="gradeSrsCard('${escapeHtml(card.id)}', 4)"><span>4 - Rất dễ (Easy)</span><small>${ivls.easy}</small></button>
              </div>
            </div>
          ` : ''}
        </div>`;
    }
  }
  // ----- CHẾ ĐỘ 4: NGHE CHÉP CHÍNH TẢ (AUDIO DICTATION) -----
  else if (studyMode === 'dictation') {
    const srsDeck = _getSrsStudyDeck();
    const pool = srsDeck.length ? srsDeck : (state.englishCards || []);
    if (!pool.length) {
      bodyHtml = `<div class="empty-box">Chưa có thẻ từ vựng nào để luyện nghe chép.</div>`;
    } else {
      const idx = Math.min(state.openQuiz.cardIdx, pool.length - 1);
      const card = pool[idx];
      const expected = (card.example_en || card.term || '').trim();
      const graded = state.openQuiz.dictationGraded[card.id];
      const draftVal = state.openQuiz.dictationInputs[card.id] || '';
      bodyHtml = `
        <div class="oq-progress-row">
          <div class="oq-progress-meta">
            <span>${state.appLang === 'en' ? `DICTATION ${idx + 1} / ${pool.length}` : `NGHE CHÉP CÂU ${idx + 1} / ${pool.length}`}</span>
            <span class="badge mono">${escapeHtml(card.id)}</span>
            <span class="badge">${escapeHtml(card.term)}</span>
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn btn-sm" onclick="moveSrsCard(-1)">${state.appLang === 'en' ? '← Prev' : '← Câu trước'}</button>
            <button type="button" class="btn btn-sm" onclick="moveSrsCard(1)">${state.appLang === 'en' ? 'Next →' : 'Câu tiếp →'}</button>
          </div>
        </div>

        <div class="srs-fc-card">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
            <div>
              <b style="font-size:13px;color:#818CF8;">${state.appLang === 'en' ? '🎧 Listen carefully and type the exact English sentence:' : '🎧 Nghe kỹ câu kỹ thuật Tiếng Anh và chép lại chính xác từng từ:'}</b>
              <div style="font-size:11.5px;color:var(--muted);margin-top:3px;">${state.appLang === 'en' ? 'Meaning Hint' : 'Gợi ý nghĩa Việt'}: ${escapeHtml(card.example_vi || card.meaning_vi || '')}</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button type="button" class="btn btn-sm btn-indigo" data-speak="${escapeHtml(expected)}" data-rate="0.95">${state.appLang === 'en' ? '🔊 Normal (1.0x)' : '🔊 Nghe chuẩn (1.0x)'}</button>
              <button type="button" class="btn btn-sm" data-speak="${escapeHtml(expected)}" data-rate="0.75">${state.appLang === 'en' ? '🐢 Slow (0.75x)' : '🐢 Nghe chậm (0.75x)'}</button>
            </div>
          </div>
          <textarea id="oq-dictation-ta" class="coach-user-ta" style="min-height:74px;" spellcheck="false"
            placeholder="Gõ lại câu Tiếng Anh bạn vừa nghe được..."
            oninput="state.openQuiz.dictationInputs['${escapeHtml(card.id)}'] = this.value">${escapeHtml(draftVal)}</textarea>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
            <button type="button" class="btn btn-sm btn-indigo" onclick="submitDictationCheck('${escapeHtml(card.id)}', ${escapeHtml(JSON.stringify(expected))})">✓ Kiểm tra &amp; Chấm từng từ</button>
            <button type="button" class="btn btn-sm" onclick="state.openQuiz.dictationGraded['${escapeHtml(card.id)}'] = { pct: -1, diffHtml: '', expectedText: ${escapeHtml(JSON.stringify(expected))}, typed: '' }; renderEnQuizView();">👁️ Hiện đáp án gốc</button>
          </div>
          ${graded ? `
            <div class="dictation-diff">
              ${graded.pct >= 0 ? `<div style="margin-bottom:6px;font-weight:700;color:${graded.pct >= 80 ? '#34D399' : '#FBBF24'};">Độ chính xác từng từ: ${graded.pct}%</div><div>${graded.diffHtml}</div>` : `<div><b>Câu gốc:</b> ${escapeHtml(graded.expectedText)}</div>`}
              ${(() => {
                const dIvls = _previewSm2Intervals(card);
                return `
                  <div class="srs-grade-bar" style="margin-top:10px;">
                    <button type="button" class="srs-grade-btn g1" onclick="gradeSrsCard('${escapeHtml(card.id)}', 1)"><span>1 - Quên (Again)</span><small>${dIvls.again}</small></button>
                    <button type="button" class="srs-grade-btn g2" onclick="gradeSrsCard('${escapeHtml(card.id)}', 2)"><span>2 - Khó (Hard)</span><small>${dIvls.hard}</small></button>
                    <button type="button" class="srs-grade-btn g3" onclick="gradeSrsCard('${escapeHtml(card.id)}', 3)"><span>3 - Tốt (Good)</span><small>${dIvls.good}</small></button>
                    <button type="button" class="srs-grade-btn g4" onclick="gradeSrsCard('${escapeHtml(card.id)}', 4)"><span>4 - Rất dễ (Easy)</span><small>${dIvls.easy}</small></button>
                  </div>`;
              })()}
            </div>` : ''}
        </div>`;
    }
  }
  // ----- CHẾ ĐỘ 2 & 3: TRẮC NGHIỆM MCQ & ĐIỀN TỪ CLOZE -----
  else {
    const deck = _activeQuizSessionDeck();
    _recalcOpenQuizStats(deck);
    if (!deck.length) {
      bodyHtml = `<div class="empty-box">Không có câu hỏi nào trong bộ lọc này. Hãy đổi bộ lọc SRS hoặc tạo đề từ Manual!</div>`;
    } else {
      const idx = Math.min(state.openQuiz.index, deck.length - 1);
      const q = deck[idx];
      const chosen = state.openQuiz.answers[q.id];
      const answered = chosen !== undefined && chosen !== null;
      const pct = Math.round(((idx + 1) * 100) / deck.length);
      const totalAns = state.openQuiz.stats.correct + state.openQuiz.stats.wrong;
      const acc = totalAns ? Math.round((state.openQuiz.stats.correct * 100) / totalAns) : 0;

      const qRendered = q.quiz_type === 'cloze'
        ? escapeHtml(q.question_text).replace(/_{3,}/g, `<span class="oq-cloze-blank">${answered ? escapeHtml(q.blank_answer || (q.options || [])[q.correct_index] || '____') : '________'}</span>`)
        : escapeHtml(q.question_text);

      const optsHtml = (q.options || []).map((opt, oi) => {
        const cls = ['oq-opt'];
        if (answered) {
          cls.push('locked');
          if (oi === Number(q.correct_index)) cls.push('correct');
          else if (oi === Number(chosen)) cls.push('wrong');
        }
        return `<button type="button" class="${cls.join(' ')}" onclick="selectOpenQuizOption('${escapeHtml(q.id)}', ${oi})">
          <span class="oq-opt-idx">${String.fromCharCode(65 + oi)}</span>
          <span>${escapeHtml(opt)}</span>
        </button>`;
      }).join('');

      bodyHtml = `
        <div class="oq-progress-row">
          <div class="oq-progress-meta">
            <span>CÂU <b>${idx + 1}</b> / ${deck.length}</span>
            <span>ĐÚNG: <b style="color:var(--green);">${state.openQuiz.stats.correct}</b></span>
            <span>SAI: <b style="color:var(--red);">${state.openQuiz.stats.wrong}</b></span>
            <span>ĐIỂM: <b style="color:#818CF8;">${acc}%</b></span>
          </div>
          <div style="display:flex;gap:6px;">
            ${state.openQuiz.sessionCustomDeck?.length ? `<button type="button" class="btn btn-sm" onclick="clearOpenQuizCustomSession()">← Quay về đề SRS</button>` : ''}
            <button type="button" class="btn btn-sm" onclick="restartOpenQuizSession()">🔄 Làm lại</button>
          </div>
        </div>
        <div class="oq-progress-bar"><div class="oq-progress-fill" style="width:${pct}%"></div></div>

        <div class="oq-card">
          <div class="oq-card-head">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <span class="mono" style="color:var(--muted);font-weight:700;">${escapeHtml(q.id)}</span>
              <span class="badge">${q.quiz_type === 'cloze' ? 'ĐIỀN CỤM TỪ CLOZE' : 'TRẮC NGHIỆM MCQ'}</span>
              <span class="badge">${escapeHtml(q.category || '')}</span>
              ${q.source_ref ? `<span class="badge mono">${escapeHtml(q.source_ref)}</span>` : ''}
            </div>
          </div>
          <div class="oq-question-box">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <small style="color:#818CF8;font-weight:700;">${q.quiz_type === 'cloze' ? 'ĐIỀN THUẬT NGỮ / LEXICAL CHUNK VÀO CHỖ TRỐNG' : 'CHỌN ĐÁP ÁN KỸ THUẬT ĐÚNG NHẤT'}</small>
              <button type="button" class="btn btn-sm" data-speak="${escapeHtml(q.context_quote || q.question_text)}">🔊 Nghe EN</button>
            </div>
            <div class="oq-question-text">${qRendered}</div>
          </div>
          ${q.quiz_type === 'cloze' && !answered ? `
            <div class="oq-cloze-input-row">
              <input id="oq-cloze-typed-input" class="inp mono" type="text" placeholder="Tự gõ đáp án (nhấn Enter) HOẶC chọn A/B/C/D..."
                value="${escapeHtml(state.openQuiz.clozeInputs[q.id] || '')}"
                onkeydown="if(event.key==='Enter'){event.preventDefault();submitClozeTypedAnswer('${escapeHtml(q.id)}');}" />
              <button type="button" class="btn btn-sm btn-indigo" onclick="submitClozeTypedAnswer('${escapeHtml(q.id)}')">Kiểm tra</button>
            </div>` : ''}
          <div class="oq-options">${optsHtml}</div>
          ${answered ? `
            <div class="oq-feedback-box">
              <div class="oq-result-banner ${Number(chosen) === Number(q.correct_index) ? 'ok' : 'bad'}">
                <span>${Number(chosen) === Number(q.correct_index) ? '✓ CHÍNH XÁC! Đã cập nhật SM-2 &amp; tiến độ chuỗi ngày học.' : `✕ CHƯA ĐÚNG — Đáp án đúng: ${String.fromCharCode(65 + Number(q.correct_index))}`}</span>
              </div>
              <div class="nb-body" style="padding:10px 12px;">${escapeHtml(q.explanation_vi || '')}</div>
              ${q.context_quote ? `<div class="oq-quote"><b>Ngữ cảnh:</b> ${escapeHtml(q.context_quote)}</div>` : ''}
            </div>` : ''}
          <div class="oq-nav-foot">
            <button type="button" class="btn btn-sm" onclick="moveOpenQuiz(-1)">← Câu trước</button>
            <button type="button" class="btn btn-sm btn-indigo" onclick="moveOpenQuiz(1)">Câu tiếp theo →</button>
          </div>
        </div>`;
    }
  }

  container.innerHTML = modeTabsHtml + bodyHtml + genPanelHtml;
  if (state.appLang === 'en' && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

// ===========================================================================
// TAB 02: PHÒNG THỰC CHIẾN 4 CHẾ ĐỘ (NÓI HỘI THOẠI · DỊCH · PHỎNG VẤN · ĐỌC MANUAL)
// ===========================================================================
function setEnCoachMode(mode) {
  const valid = ['speaking', 'translation', 'interview', 'reading'].includes(mode) ? mode : 'speaking';
  state.enCoach.mode = valid;
  state.enCoach.result = null;
  if (valid === 'reading') {
    renderEnCoachView();
    return;
  }
  pickRandomCoachPrompt();
}

function _getFilteredCombatDrills() {
  const drills = state.englishCombatDrills && state.englishCombatDrills.length ? state.englishCombatDrills : [];
  const mode = state.enCoach.mode || 'speaking';
  const cat = document.getElementById('en-coach-source-filter')?.value || state.enCoach.category || 'ALL';
  let byMode = drills.filter((d) => (d.drill_mode || 'translation') === mode);
  if (!byMode.length) byMode = drills;
  if (cat !== 'ALL') {
    const byCat = byMode.filter((d) => d.category === cat);
    if (byCat.length) return byCat;
  }
  return byMode;
}

function selectCombatDrill(drillId) {
  const drills = state.englishCombatDrills || [];
  const d = drills.find((x) => x.id === drillId);
  if (!d) return;
  state.enCoach.drillId = d.id;
  state.enCoach.mode = d.drill_mode || state.enCoach.mode || 'translation';
  state.enCoach.customMode = false;
  state.enCoach.viPrompt = d.source_vi || '';
  state.enCoach.referenceEn = d.reference_en || '';
  state.enCoach.spokenEn = d.spoken_en || '';
  state.enCoach.sourceRef = d.linked_record_id || d.id;
  state.enCoach.targetKeywords = Array.isArray(d.target_keywords) ? d.target_keywords : [];
  state.enCoach.userEn = '';
  state.enCoach.result = null;
  renderEnCoachView();
}

function pickRandomCoachPrompt() {
  const pool = _getFilteredCombatDrills();
  if (!pool.length) return;
  const others = pool.filter((p) => p.id !== state.enCoach.drillId);
  const pick = (others.length ? others : pool)[Math.floor(Math.random() * (others.length || pool.length))];
  selectCombatDrill(pick.id);
}

function toggleCustomCoachPrompt() {
  state.enCoach.customMode = !state.enCoach.customMode;
  if (state.enCoach.customMode) {
    state.enCoach.drillId = '';
    state.enCoach.viPrompt = '';
    state.enCoach.referenceEn = '';
    state.enCoach.targetKeywords = [];
    state.enCoach.result = null;
  }
  renderEnCoachView();
}

function _isKeywordMatchedInText(kw, text) {
  const low = String(text || '').toLowerCase();
  const base = String(kw || '').trim().toLowerCase();
  if (!base) return false;
  if (low.includes(base)) return true;
  const tokens = (base.match(/[a-z0-9]+/g) || []).filter((t) => t.length >= 3);
  return tokens.length >= 2 && tokens.slice(0, 2).every((t) => low.includes(t));
}

function updateCoachKeywordLampsLive(userText) {
  state.enCoach.userEn = userText;
  const bar = document.getElementById('coach-kw-lamps');
  if (!bar) return;
  bar.querySelectorAll('.kw-lamp').forEach((el) => {
    const kw = el.getAttribute('data-kw') || '';
    const hit = _isKeywordMatchedInText(kw, userText);
    el.classList.toggle('hit', hit);
    const ico = el.querySelector('.kw-ico');
    if (ico) ico.textContent = hit ? '✓' : '○';
  });
}

let _coachRecognition = null;
function toggleCoachSpeechInput() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = document.getElementById('coach-mic-btn');
  if (!SpeechRec) {
    showToast(
      state.appLang === 'en'
        ? 'Browser Web Speech API is unavailable here — please type your answer directly'
        : 'Trình duyệt/Webview này chưa hỗ trợ Micro Web Speech — bạn có thể gõ trực tiếp vào ô bên dưới!',
      'info'
    );
    return;
  }
  if (state.enCoach.recording && _coachRecognition) {
    try { _coachRecognition.stop(); } catch (e) {}
    state.enCoach.recording = false;
    micBtn?.classList.remove('recording');
    return;
  }
  try {
    _coachRecognition = new SpeechRec();
    _coachRecognition.lang = 'en-US';
    _coachRecognition.interimResults = true;
    _coachRecognition.continuous = true;
    const ta = document.getElementById('en-coach-user-ta');
    const prefix = (ta?.value || '').trim();
    _coachRecognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += `${event.results[i][0].transcript} `;
      }
      const nextVal = `${prefix ? prefix + ' ' : ''}${transcript}`.trim();
      if (ta) ta.value = nextVal;
      updateCoachKeywordLampsLive(nextVal);
    };
    _coachRecognition.onerror = () => {
      state.enCoach.recording = false;
      micBtn?.classList.remove('recording');
      showToast(state.appLang === 'en' ? 'Microphone unavailable or blocked' : 'Không truy cập được Micro hoặc bị từ chối quyền', 'error');
    };
    _coachRecognition.onend = () => {
      state.enCoach.recording = false;
      micBtn?.classList.remove('recording');
    };
    _coachRecognition.start();
    state.enCoach.recording = true;
    micBtn?.classList.add('recording');
    showToast(state.appLang === 'en' ? '🎙️ Listening in English...' : '🎙️ Đang nghe giọng Tiếng Anh... (bấm lại để dừng)', 'info');
  } catch (err) {
    state.enCoach.recording = false;
    showToast('Speech recognition error', 'error');
  }
}

async function submitEnCoachEvaluation() {
  const viEl = document.getElementById('en-coach-vi-custom');
  const viPrompt = (viEl ? viEl.value : state.enCoach.viPrompt || '').trim();
  const userEn = (document.getElementById('en-coach-user-ta')?.value || state.enCoach.userEn || '').trim();
  if (!viPrompt) {
    showToast(state.appLang === 'en' ? 'No scenario prompt selected' : 'Chưa có tình huống Tiếng Việt để chấm', 'error');
    return;
  }
  if (!userEn) {
    showToast(state.appLang === 'en' ? 'Type or speak your English response first' : 'Hãy gõ hoặc nói câu Tiếng Anh của bạn trước khi bấm Chấm!', 'info');
    document.getElementById('en-coach-user-ta')?.focus();
    return;
  }
  state.enCoach.viPrompt = viPrompt;
  state.enCoach.userEn = userEn;
  state.enCoach.loading = true;
  renderEnCoachView();
  try {
    const res = await fetch('/api/english/evaluate-combat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drill_id: state.enCoach.drillId || '',
        mode: state.enCoach.mode || 'translation',
        prompt_vi: viPrompt,
        user_en: userEn,
        reference_en: state.enCoach.referenceEn || '',
        target_keywords: state.enCoach.targetKeywords || [],
      }),
    });
    if (!res.ok) throw new Error('Không thể chấm câu thực chiến');
    const data = await res.json();
    state.enCoach.loading = false;
    state.enCoach.result = data;
    _applyEnglishCardsResponse(data);
    renderEnCoachView();
  } catch (err) {
    state.enCoach.loading = false;
    renderEnCoachView();
    showToast(err.message, 'error');
  } finally {
    state.enCoach.loading = false;
  }
}

async function saveCoreVocabFromCoach(idx, btnEl) {
  const cv = (state.enCoach.result?.core_vocab || [])[idx];
  if (!cv) return;
  try {
    const res = await fetch('/api/english/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        term: cv.term || cv.term_or_chunk,
        ipa: cv.ipa || cv.pronunciation || '',
        word_class: cv.word_class || 'Noun',
        category: cv.category || 'PLC & Tự động hóa',
        meaning_vi: cv.meaning_vi,
        collocations: cv.collocations || '',
        example_en: cv.example_en || state.enCoach.result?.natural_en_report || '',
        example_vi: cv.example_vi || state.enCoach.viPrompt || '',
        linked_record_id: state.enCoach.sourceRef || '',
        srs_stage: 'new',
      }),
    });
    if (!res.ok) throw new Error('Lưu thẻ SRS thất bại');
    const data = await res.json();
    _applyEnglishCardsResponse(data);
    if (btnEl) {
      btnEl.textContent = '✓ Đã lưu vào SRS';
      btnEl.disabled = true;
    }
    showToast(`Đã thêm "${cv.term || cv.term_or_chunk}" vào Kho SRS`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderEnCoachView() {
  _syncAiKeyButtons();
  const modePills = document.getElementById('en-coach-mode-pills');
  const combatCtrls = document.getElementById('en-coach-combat-controls');
  const readingCtrls = document.getElementById('en-coach-reading-controls');
  const catSel = document.getElementById('en-coach-source-filter');
  const container = document.getElementById('en-coach-container');
  if (!container) return;

  const isEn = state.appLang === 'en';
  const mode = ['speaking', 'translation', 'interview', 'reading'].includes(state.enCoach.mode)
    ? state.enCoach.mode
    : 'speaking';
  state.enCoach.mode = mode;

  if (modePills) {
    modePills.innerHTML = `
      <button type="button" class="chip ${mode === 'speaking' ? 'active' : ''}" onclick="setEnCoachMode('speaking')">${isEn ? 'A: Daily &amp; Workplace Speaking' : 'Chế độ A: Giao tiếp &amp; Hội thoại'}</button>
      <button type="button" class="chip ${mode === 'translation' ? 'active' : ''}" onclick="setEnCoachMode('translation')">${isEn ? 'B: Tech Translation &amp; Schematics' : 'Chế độ B: Dịch Kỹ Thuật &amp; Bản vẽ'}</button>
      <button type="button" class="chip ${mode === 'interview' ? 'active' : ''}" onclick="setEnCoachMode('interview')">${isEn ? 'C: 1-1 Interview &amp; Mic' : 'Chế độ C: Phỏng vấn 1-1 &amp; Mic'}</button>
      <button type="button" class="chip ${mode === 'reading' ? 'active' : ''}" onclick="setEnCoachMode('reading')">${isEn ? 'D: Contextual Manual Reading' : 'Chế độ D: Đọc hiểu &amp; Manual AI'}</button>`;
  }

  combatCtrls?.classList.toggle('hidden', mode === 'reading');
  readingCtrls?.classList.toggle('hidden', mode !== 'reading');

  if (mode === 'reading') {
    renderEnReadingView(container);
    return;
  }

  if (catSel && typeof ENGLISH_CATEGORIES !== 'undefined') {
    const prevCat = catSel.value || 'ALL';
    catSel.innerHTML = `<option value="ALL">${isEn ? 'Topic: All' : 'Chủ đề: Tất cả (Giao tiếp + Kỹ thuật)'}</option>` +
      ENGLISH_CATEGORIES.filter((c) => c.key !== 'ALL').map((c) =>
        `<option value="${escapeHtml(c.key)}">${escapeHtml(isEn ? chipDisplayLabel(c) : c.key)}</option>`
      ).join('');
    catSel.value = Array.from(catSel.options).some((o) => o.value === prevCat) ? prevCat : 'ALL';
  }

  const drills = _getFilteredCombatDrills();
  const currentInMode = drills.find((d) => d.id === state.enCoach.drillId);
  if ((!state.enCoach.viPrompt || (state.enCoach.drillId && !currentInMode)) && !state.enCoach.customMode) {
    if (drills.length) {
      const first = drills[0];
      state.enCoach.drillId = first.id;
      state.enCoach.viPrompt = first.source_vi || '';
      state.enCoach.referenceEn = first.reference_en || '';
      state.enCoach.spokenEn = first.spoken_en || '';
      state.enCoach.promptEn = first.prompt_en || '';
      state.enCoach.sourceRef = first.linked_record_id || first.id;
      state.enCoach.targetKeywords = Array.isArray(first.target_keywords) ? first.target_keywords : [];
    }
  }
  const activeDrill = currentInMode || drills.find((d) => d.id === state.enCoach.drillId);

  const drillChipsHtml = drills.slice(0, 10).map((d) => `
    <button type="button" class="chip ${d.id === state.enCoach.drillId ? 'active' : ''}" onclick="selectCombatDrill('${escapeHtml(d.id)}')" title="${escapeHtml(d.source_vi || '')}">
      ${escapeHtml(d.id)}${d.last_score ? ` (${d.last_score}%)` : ''}
    </button>`).join('');

  const kws = state.enCoach.targetKeywords || [];
  const lampsHtml = kws.length ? `
    <div id="coach-kw-lamps" class="kw-lamps-bar">
      <span style="font-size:11px;font-weight:700;color:var(--muted);">${isEn ? 'MANDATORY KEYWORDS:' : 'TỪ KHÓA BẮT BUỘC:'}</span>
      ${kws.map((kw) => {
        const hit = _isKeywordMatchedInText(kw, state.enCoach.userEn);
        return `<span class="kw-lamp ${hit ? 'hit' : ''}" data-kw="${escapeHtml(kw)}"><span class="kw-ico">${hit ? '✓' : '○'}</span><span>${escapeHtml(kw)}</span></span>`;
      }).join('')}
    </div>` : '';

  const r = state.enCoach.result;
  let framesHtml = '';
  if (r) {
    const vocabRows = (r.core_vocab || []).map((cv, i) => `
      <div class="coach-vocab-row">
        <div>
          <b class="mono" style="color:var(--text);">${escapeHtml(cv.term || cv.term_or_chunk)}</b>
          <span class="vb-ipa">${escapeHtml(cv.ipa || cv.pronunciation || '')}</span>
          ${cv.word_class ? `<span class="badge">${escapeHtml(cv.word_class)}</span>` : ''}
          <span style="color:var(--muted);">— ${escapeHtml(cv.meaning_vi)}</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn btn-sm" data-speak="${escapeHtml(cv.term || cv.term_or_chunk)}">🔊</button>
          <button type="button" class="btn btn-sm btn-indigo" onclick="saveCoreVocabFromCoach(${i}, this)">+ Lưu vào SRS</button>
        </div>
      </div>`).join('');

    const syncedList = Array.isArray(r.active_recall_synced) ? r.active_recall_synced : [];
    const syncBannerHtml = syncedList.length ? `
      <div class="combat-srs-sync-banner">
        <b>🔄 Active Recall SRS:</b>
        <span>${isEn ? `Auto-synced ${syncedList.length} card(s):` : `Đã tự động cập nhật SM-2 cho ${syncedList.length} thẻ:`}</span>
        ${syncedList.map((s) => `<span class="badge mono">${escapeHtml(s.term)} → ${s.action === 'promoted' ? `+${Math.round(Number(s.interval_days || 1))}d` : 'Due Review'}</span>`).join('')}
      </div>` : '';

    const reportTxt = r.natural_en_report || (r.natural_en_expressions || [])[0] || '';
    const interviewTxt = r.natural_en_interview || (r.natural_en_expressions || [])[1] || reportTxt;

    framesHtml = `
      <div class="coach-results">
        <!-- KHUNG 1: SỬA NGỮ PHÁP & CÁCH DIỄN ĐẠT (LUÔN HIỂN THỊ ĐẦU TIÊN) -->
        <div class="coach-frame fix">
          <div class="coach-frame-head">
            <span class="coach-frame-title">1. [SỬA NGỮ PHÁP &amp; CÁCH DIỄN ĐẠT]</span>
            <span class="badge">${r.engine === 'gemini' ? 'GEMINI AI' : 'OFFLINE COACH'} · TỪ KHÓA: ${(r.matched_keywords || []).length}/${(r.matched_keywords || []).length + (r.missing_keywords || []).length}</span>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Câu gốc của bạn:</div>
          <div style="font-size:13px;margin-bottom:8px;opacity:0.9;">${escapeHtml(r.user_original || '')}</div>
          <div style="font-size:12px;color:var(--amber);font-weight:700;margin-bottom:4px;">Phiên bản chỉnh sửa chuẩn ngữ pháp:</div>
          <div class="coach-corrected-box">${escapeHtml(r.corrected_user_en || '')}</div>
          <ul class="coach-note-list">${(r.grammar_notes || []).map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
        </div>

        <!-- KHUNG 2: CÂU MẪU CHUẨN KỸ SƯ -->
        <div class="coach-frame natural">
          <div class="coach-frame-head">
            <span class="coach-frame-title">2. [CÂU MẪU CHUẨN KỸ SƯ]</span>
          </div>
          <div class="coach-sample-row">
            <div>
              <div style="font-size:10.5px;color:var(--muted);margin-bottom:2px;">📄 VĂN VIẾT BÁO CÁO KỸ THUẬT (Technical Report):</div>
              <div class="coach-sample-en">${escapeHtml(reportTxt)}</div>
            </div>
            <div style="display:flex;gap:5px;flex-shrink:0;">
              <button type="button" class="btn btn-sm" data-speak="${escapeHtml(reportTxt)}">🔊</button>
              <button type="button" class="btn btn-sm" data-copy-txt="${escapeHtml(reportTxt)}">📋 Copy</button>
            </div>
          </div>
          <div class="coach-sample-row" style="margin-top:8px;">
            <div>
              <div style="font-size:10.5px;color:var(--muted);margin-bottom:2px;">🎤 VĂN NÓI PHỎNG VẤN / GIAO TIẾP (Spoken Interview):</div>
              <div class="coach-sample-en">${escapeHtml(interviewTxt)}</div>
            </div>
            <div style="display:flex;gap:5px;flex-shrink:0;">
              <button type="button" class="btn btn-sm" data-speak="${escapeHtml(interviewTxt)}">🔊</button>
              <button type="button" class="btn btn-sm" data-copy-txt="${escapeHtml(interviewTxt)}">📋 Copy</button>
            </div>
          </div>
        </div>

        <!-- KHUNG 3: ĐIỂM SỐ & THUẬT NGỮ CẦN GHI NHỚ -->
        <div class="coach-frame vocab">
          <div class="coach-frame-head">
            <span class="coach-frame-title">3. [ĐIỂM SỐ &amp; THUẬT NGỮ CẦN GHI NHỚ]</span>
            <span class="coach-score-pill">ĐIỂM: ${r.score}/100</span>
          </div>
          <div class="coach-verdict-txt" style="font-size:12.5px;font-weight:700;margin-bottom:8px;">${escapeHtml(r.verdict || '')}</div>
          <div class="coach-vocab-list">${vocabRows || '<div style="font-size:12px;color:var(--muted);">Đã khớp từ vựng nền tảng — xem gợi ý tự nhiên ở Khung 2.</div>'}</div>
          ${syncBannerHtml}
        </div>
      </div>`;
  }

  const modeTitleLabel = mode === 'speaking'
    ? (isEn ? 'MODE A: DAILY & WORKPLACE SPEAKING REFLEX' : 'CHẾ ĐỘ A: GIAO TIẾP & PHẢN XẠ HỘI THOẠI (DAILY & WORKPLACE)')
    : (mode === 'interview'
      ? (isEn ? 'MODE C: SENIOR ENGINEER INTERVIEW (FORCED OUTPUT)' : 'CHẾ ĐỘ C: PHỎNG VẤN KỸ SƯ 1-1 & ÉP DÙNG TỪ (MIC)')
      : (isEn ? 'MODE B: TECHNICAL TRANSLATION & SCHEMATICS' : 'CHẾ ĐỘ B: LUYỆN DỊCH KỸ THUẬT & GIẢI THÍCH BẢN VẼ'));

  const promptHintEn = (!state.enCoach.customMode && activeDrill?.prompt_en) ? activeDrill.prompt_en : '';

  container.innerHTML = `
    <div style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
      ${drillChipsHtml}
    </div>
    <div class="coach-prompt-card">
      <div class="coach-prompt-meta">
        <span>${modeTitleLabel}</span>
        ${state.enCoach.sourceRef ? `<span class="badge mono">${escapeHtml(state.enCoach.sourceRef)}</span>` : ''}
      </div>
      ${state.enCoach.customMode
        ? `<textarea id="en-coach-vi-custom" class="coach-user-ta" style="min-height:68px;" spellcheck="false" placeholder="Nhập tình huống Tiếng Việt bạn muốn luyện diễn đạt sang Tiếng Anh..." oninput="state.enCoach.viPrompt = this.value">${escapeHtml(state.enCoach.viPrompt || '')}</textarea>`
        : `<div class="coach-vi-prompt">${escapeHtml(state.enCoach.viPrompt || '')}</div>
           ${promptHintEn ? `<div style="margin-top:6px;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span>💬 EN Question: <i>${escapeHtml(promptHintEn)}</i></span><button type="button" class="btn btn-sm" style="padding:1px 7px;font-size:11px;" data-speak="${escapeHtml(promptHintEn)}">🔊</button></div>` : ''}`
      }
      ${lampsHtml}
      <div class="coach-answer-wrap">
        <label class="lbl" style="display:block;margin-bottom:5px;">CÂU TRẢ LỜI / DỊCH TIẾNG ANH CỦA BẠN (Ctrl+Enter để nộp):</label>
        <textarea id="en-coach-user-ta" class="coach-user-ta" spellcheck="false"
          placeholder="Viết hoặc bấm Micro 🎙️ nói câu Tiếng Anh (cố gắng lồng ghép các từ khóa mục tiêu phía trên)..."
          oninput="updateCoachKeywordLampsLive(this.value)"
          onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();submitEnCoachEvaluation();}">${escapeHtml(state.enCoach.userEn || '')}</textarea>
        <div class="coach-submit-row">
          <button type="button" id="coach-mic-btn" class="btn btn-sm mic-btn ${state.enCoach.recording ? 'recording' : ''}" onclick="toggleCoachSpeechInput()">🎙️ Nói Tiếng Anh (Mic)</button>
          <button type="button" class="btn btn-sm btn-indigo" onclick="submitEnCoachEvaluation()" ${state.enCoach.loading ? 'disabled' : ''}>${state.enCoach.loading ? '⏳ Đang chấm 3 khung...' : '🚀 Chấm điểm &amp; Sửa 3 khung AI'}</button>
          <button type="button" class="btn btn-sm" onclick="speakEnglishText(document.getElementById('en-coach-user-ta')?.value || '')">🔊 Nghe câu bạn viết</button>
          ${state.enCoach.referenceEn ? `<button type="button" class="btn btn-sm" onclick="const ta=document.getElementById('en-coach-user-ta'); if(ta){const chunk=${mode === 'speaking' ? "'Actually, in my daily work, '" : "'Regarding this technical procedure, '"}; ta.value=ta.value?ta.value:chunk; updateCoachKeywordLampsLive(ta.value); ta.focus();}">💡 Gợi ý cụm nối</button>` : ''}
        </div>
      </div>
    </div>
    ${framesHtml}`;
  if (state.appLang === 'en' && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

// ===========================================================================
// CHẾ ĐỘ D (PHÒNG 02): TẠO BÀI ĐỌC HIỂU KỸ THUẬT TỰ ĐỘNG (ĐỌC HIỂU MANUAL AI)
// ===========================================================================
async function generateContextualReading() {
  const count = Number(document.getElementById('en-reading-count')?.value || 7);
  state.enReading.loading = true;
  state.enReading.activeWord = null;
  state.enReading.answers = {};
  state.enReading.synced = false;
  renderEnReadingView();
  try {
    const res = await fetch('/api/english/generate-reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, topic: 'due_today' }),
    });
    if (!res.ok) throw new Error('Không thể tạo bài đọc hiểu');
    state.enReading.data = await res.json();
    state.enReading.loading = false;
    renderEnReadingView();
  } catch (err) {
    state.enReading.loading = false;
    renderEnReadingView();
    showToast(err.message, 'error');
  } finally {
    state.enReading.loading = false;
  }
}

function toggleReadingBilingual() {
  state.enReading.showVi = !state.enReading.showVi;
  const btn = document.getElementById('en-reading-bilingual-btn');
  btn?.classList.toggle('split-on', state.enReading.showVi);
  renderEnReadingView();
}

function speakFullReadingPassage() {
  const paras = state.enReading.data?.paragraphs || [];
  if (!paras.length) {
    showToast(state.appLang === 'en' ? 'Generate a reading passage first' : 'Hãy bấm Tạo bài đọc trước khi phát âm thanh', 'info');
    return;
  }
  const full = paras.map((p) => p.en).join(' ');
  if (typeof speakEnglishText === 'function') speakEnglishText(full, 0.92);
}

function selectReadingHighlightWord(cardId) {
  const cards = state.enReading.data?.target_cards || state.englishCards || [];
  const found = cards.find((c) => c.id === cardId);
  if (found) {
    state.enReading.activeWord = found;
    renderEnReadingView();
  }
}

async function answerReadingMcq(qIdx, optIdx) {
  state.enReading.answers[qIdx] = optIdx;
  renderEnReadingView();
  const d = state.enReading.data;
  const qs = d?.questions || [];
  if (qs.length && !state.enReading.synced && Object.keys(state.enReading.answers).length >= qs.length) {
    state.enReading.synced = true;
    const score = qs.reduce((acc, q, i) => acc + (Number(state.enReading.answers[i]) === Number(q.correct_index) ? 1 : 0), 0);
    const cardIds = (d.target_cards || []).map((c) => c.id).filter(Boolean);
    if (cardIds.length) {
      await fetch('/api/english/reading-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_ids: cardIds, score, total: qs.length }),
      }).then((r) => (r.ok ? r.json() : null)).then((data) => {
        if (data) {
          _applyEnglishCardsResponse(data);
          showToast(
            state.appLang === 'en'
              ? `Reading complete (${score}/${qs.length}) — Active Recall synced ${cardIds.length} SRS cards!`
              : `Hoàn thành đọc hiểu (${score}/${qs.length}) — Active Recall đã cập nhật SM-2 cho ${cardIds.length} từ mục tiêu!`,
            'success'
          );
        }
      }).catch(() => {});
    }
  }
}

function _highlightTargetTermsInHtml(textEn, targetCards) {
  let html = escapeHtml(textEn || '');
  const sorted = [...(targetCards || [])].sort((a, b) => (b.term || '').length - (a.term || '').length);
  const placeholders = [];
  sorted.forEach((c, idx) => {
    const raw = (c.term || '').trim();
    if (!raw || raw.length < 3) return;
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${esc})`, 'gi');
    let hit = false;
    html = html.replace(re, (m) => {
      hit = true;
      const token = `__RHL_${idx}_${placeholders.length}__`;
      placeholders.push({
        token,
        html: `<button type="button" class="reading-hl-word" onclick="selectReadingHighlightWord('${escapeHtml(c.id)}')" title="${escapeHtml(c.meaning_vi)}">${m}</button>`,
      });
      return token;
    });
  });
  placeholders.forEach((p) => { html = html.split(p.token).join(p.html); });
  return html;
}

function _renderReadingParagraphSentencesHtml(textEn, targetCards) {
  const raw = String(textEn || '').trim();
  if (!raw) return '';
  const sentences = raw.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [raw];
  return sentences.map((sent) => {
    const cleanSent = sent.trim();
    if (!cleanSent) return '';
    return `<span class="reading-sent-row">${_highlightTargetTermsInHtml(cleanSent, targetCards)} <button type="button" class="btn btn-sm" style="padding:1px 6px;font-size:11px;vertical-align:middle;" data-speak="${escapeHtml(cleanSent)}" title="Nghe đọc câu này">🔊</button></span> `;
  }).join('');
}

function renderEnReadingView(targetContainer = null) {
  _syncAiKeyButtons();
  const container = targetContainer
    || document.getElementById('en-coach-container')
    || document.getElementById('en-reading-container');
  if (!container) return;
  const isEn = state.appLang === 'en';

  if (state.enReading.loading) {
    container.innerHTML = `<div class="empty-box" style="padding:36px;">⏳ Đang ghép ${document.getElementById('en-reading-count')?.value || 7} từ vựng SRS vào báo cáo kỹ thuật thực tế...</div>`;
    return;
  }

  const d = state.enReading.data;
  if (!d) {
    const dueCards = (state.englishCards || []).filter((c) => c.is_due).slice(0, 7);
    container.innerHTML = `
      <div class="reading-card">
        <div style="font-size:15px;font-weight:800;margin-bottom:6px;">📖 TẠO BÀI ĐỌC HIỂU TỪ VỰNG SRS NGỮ CẢNH THỰC TẾ</div>
        <div style="font-size:12.5px;color:var(--muted);line-height:1.6;margin-bottom:12px;">
          Hệ thống sẽ tự động lấy <b>5–10 từ Cần ôn hôm nay / Từ mới</b> ghép thành một bản tin Service Bulletin hoặc hội thoại kỹ thuật liền mạch, hiển thị từng thẻ từ khóa ngay phía trên, bấm đọc từng câu &amp; làm 3 câu hỏi đọc hiểu (tự đồng bộ SM-2).
        </div>
        ${dueCards.length ? `
          <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px;">TỪ MỤC TIÊU SẼ ĐƯA VÀO BÀI ĐỌC (${dueCards.length}):</div>
          <div class="reading-tag-strip">${dueCards.map((c) => `<button type="button" class="reading-tag-pill" data-speak="${escapeHtml(c.term)}" title="${escapeHtml(c.meaning_vi || '')}">${escapeHtml(c.term)} <span>🔊</span></button>`).join('')}</div>` : ''}
        <button type="button" class="btn btn-indigo" onclick="generateContextualReading()">📖 Tạo bài đọc ngay từ ${dueCards.length || 7} từ SRS hôm nay</button>
      </div>`;
    if (isEn && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
    return;
  }

  const targetCards = d.target_cards || [];
  const targetTagsHtml = targetCards.length ? `
    <div style="margin-bottom:8px;">
      <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px;">🎯 TỪ VỰNG MỤC TIÊU TRONG BÀI (${targetCards.length} — bấm để nghe &amp; xem nghĩa):</div>
      <div class="reading-tag-strip">
        ${targetCards.map((c) => `<button type="button" class="reading-tag-pill" onclick="selectReadingHighlightWord('${escapeHtml(c.id)}')" data-speak="${escapeHtml(c.term)}"><b>${escapeHtml(c.term)}</b>${c.ipa ? `<small>${escapeHtml(c.ipa)}</small>` : ''}<span>🔊</span></button>`).join('')}
      </div>
    </div>` : '';

  const aw = state.enReading.activeWord;
  const wordPopHtml = aw ? `
    <div class="reading-word-pop">
      <div>
        <b style="font-size:14px;">${escapeHtml(aw.term)}</b>
        <span class="vb-ipa">${escapeHtml(aw.ipa || '')}</span>
        ${aw.word_class ? `<span class="badge">${escapeHtml(aw.word_class)}</span>` : ''}
        <div style="font-size:12.5px;color:var(--green);margin-top:2px;">→ ${escapeHtml(aw.meaning_vi)}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button type="button" class="btn btn-sm" data-speak="${escapeHtml(aw.term)}">🔊 Nghe từ</button>
        <button type="button" class="btn btn-sm btn-indigo" onclick="gradeSrsCard('${escapeHtml(aw.id)}', 3)">✓ Đánh dấu Đã ôn (+1)</button>
      </div>
    </div>` : '';

  const parasHtml = (d.paragraphs || []).map((p, pi) => `
    <div class="reading-para">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
        <small class="mono" style="color:var(--muted);">ĐOẠN ${pi + 1}</small>
        <button type="button" class="btn btn-sm" data-speak="${escapeHtml(p.en)}">🔊 Nghe cả đoạn ${pi + 1}</button>
      </div>
      <div class="reading-para-en">${_renderReadingParagraphSentencesHtml(p.en, targetCards)}</div>
      ${state.enReading.showVi ? `<div class="reading-para-vi">🇻🇳 ${escapeHtml(p.vi || '')}</div>` : ''}
    </div>`).join('');

  const mcqsHtml = (d.questions || []).map((q, qi) => {
    const picked = state.enReading.answers[qi];
    const done = picked !== undefined;
    return `
      <div class="reading-mcq-item">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;">Câu ${qi + 1}: ${escapeHtml(q.question)}</div>
        <div class="oq-options">
          ${(q.options || []).map((opt, oi) => {
            const cls = ['oq-opt'];
            if (done) {
              cls.push('locked');
              if (oi === Number(q.correct_index)) cls.push('correct');
              else if (oi === Number(picked)) cls.push('wrong');
            }
            return `<button type="button" class="${cls.join(' ')}" onclick="answerReadingMcq(${qi}, ${oi})">
              <span class="oq-opt-idx">${String.fromCharCode(65 + oi)}</span><span>${escapeHtml(opt)}</span>
            </button>`;
          }).join('')}
        </div>
        ${done ? `<div style="margin-top:8px;font-size:12px;color:${Number(picked) === Number(q.correct_index) ? 'var(--green)' : 'var(--amber)'};">💡 ${escapeHtml(q.explanation_vi || '')}</div>` : ''}
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="reading-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
        <div>
          <span class="badge">${d.engine === 'gemini' ? 'GEMINI AI READING' : 'OFFLINE SERVICE BULLETIN'} · ${targetCards.length} từ mục tiêu</span>
          <h3 style="margin:6px 0 2px;font-size:16px;">${escapeHtml(d.title_en || '')}</h3>
          <div style="font-size:12px;color:var(--muted);">${escapeHtml(d.title_vi || '')}</div>
        </div>
        <button type="button" class="btn btn-sm btn-indigo" onclick="generateContextualReading()">🔄 Tạo bài khác</button>
      </div>
      ${targetTagsHtml}
      ${wordPopHtml}
      ${parasHtml}
    </div>
    <div class="reading-card">
      <div style="font-size:13px;font-weight:800;color:#818CF8;margin-bottom:10px;">✅ KIỂM TRA ĐỌC HIỂU (3 CÂU HỎI NGỮ CẢNH)</div>
      ${mcqsHtml}
    </div>`;
  if (isEn && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

// ===========================================================================
// TAB 04: KHO TỪ VỰNG & CỤM TỪ NỐI (LEXICAL CHUNKS + SM-2 TELEMETRY)
// ===========================================================================
function getFilteredEnVocab() {
  const { category, status, q } = state.enBankFilters;
  const query = (q || '').trim().toLowerCase();
  const cards = state.englishCards && state.englishCards.length ? state.englishCards : state.englishVocab || [];
  return cards.filter((v) => {
    if (category && category !== 'ALL' && v.category !== category) return false;
    if (status && status !== 'ALL') {
      const st = String(v.srs_stage || v.status_code || 'new').toLowerCase();
      if (status === 'due_now') { if (!v.is_due) return false; }
      else if (st !== status) return false;
    }
    if (query) {
      const hay = `${v.id || ''} ${v.term || v.term_or_chunk || ''} ${v.ipa || ''} ${v.word_class || ''} ${v.collocations || ''} ${v.meaning_vi || ''} ${v.example_en || ''} ${v.linked_record_id || ''}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

function setEnBankCategory(cat) {
  state.enBankFilters.category = cat;
  if (state.activeWorkspace === 'english' && state.activeTab !== 'en-vocab-bank') {
    switchTab('en-vocab-bank');
  } else {
    renderEnVocabBankView();
    if (state.activeWorkspace === 'english') renderSidebarForWorkspace();
  }
}

function onEnBankFilterChange() {
  state.enBankFilters.status = document.getElementById('en-bank-status-filter')?.value || 'ALL';
  state.enBankFilters.q = document.getElementById('en-bank-search-input')?.value || '';
  renderEnVocabBankView();
}

function clearEnBankSearch() {
  state.enBankFilters.q = '';
  const inp = document.getElementById('en-bank-search-input');
  if (inp) inp.value = '';
  renderEnVocabBankView();
}

function selectEnBankItem(cardId) {
  state.selectedEnglishVocabId = cardId;
  renderEnVocabBankView();
}

function navigateAdjacentEnVocab(delta) {
  const items = getFilteredEnVocab();
  if (!items.length) return;
  const curIdx = items.findIndex((x) => String(x.id) === String(state.selectedEnglishVocabId));
  const nextIdx = curIdx < 0 ? 0 : (curIdx + delta + items.length) % items.length;
  state.selectedEnglishVocabId = items[nextIdx].id;
  renderEnVocabBankView();
}

function toggleVocabIngestDrawer(openFlag) {
  state.enIngest.drawerOpen = Boolean(openFlag);
  renderEnVocabBankView();
}

function renderEnVocabBankView() {
  const pillsEl = document.getElementById('en-bank-category-pills');
  const statusEl = document.getElementById('en-bank-status-filter');
  const searchEl = document.getElementById('en-bank-search-input');
  const clrEl = document.getElementById('en-bank-search-clear');
  const countEl = document.getElementById('en-bank-list-count');
  const listEl = document.getElementById('en-bank-list');
  const detailEl = document.getElementById('en-bank-detail');
  if (!listEl || !detailEl) return;

  const drawerEl = document.getElementById('en-vocab-ingest-drawer');
  const closeBtn = document.getElementById('en-ingest-close-btn');
  if (drawerEl) drawerEl.classList.toggle('hidden', !state.enIngest.drawerOpen);
  if (closeBtn) closeBtn.classList.toggle('hidden', !state.enIngest.drawerOpen);
  renderEnIngestView();

  if (statusEl) statusEl.value = state.enBankFilters.status || 'ALL';
  if (searchEl && searchEl.value !== (state.enBankFilters.q || '')) searchEl.value = state.enBankFilters.q || '';
  clrEl?.classList.toggle('hidden', !(state.enBankFilters.q || '').trim());

  if (pillsEl) {
    const cards = state.englishCards && state.englishCards.length ? state.englishCards : state.englishVocab || [];
    const cats = ENGLISH_CATEGORIES.map((c) => {
      const cnt = c.key === 'ALL' ? cards.length : cards.filter((v) => v.category === c.key).length;
      const on = state.enBankFilters.category === c.key;
      return `<button type="button" class="chip ${on ? 'active' : ''}" data-ctx-scope="english" data-ctx-key="${escapeHtml(c.key)}" onclick="setEnBankCategory('${escapeHtml(c.key)}')">${escapeHtml(chipDisplayLabel(c))} <span class="cnt">${cnt}</span></button>`;
    });
    pillsEl.innerHTML = cats.join('') +
      `<button type="button" class="chip chip-manage" onclick="openCategoryManager('english')" title="Tùy chỉnh các nhóm phân loại">⚙</button>`;
  }

  const filtered = getFilteredEnVocab();
  if (countEl) countEl.textContent = String(filtered.length);
  if (!filtered.length) {
    state.selectedEnglishVocabId = null;
    listEl.innerHTML = '<div class="empty-box" style="margin:14px;">Không có thuật ngữ / chunk nào khớp bộ lọc.</div>';
    detailEl.innerHTML = '<div class="empty-box">Hãy thử xóa bộ lọc hoặc thêm mới bằng Magic Fill (+ Thêm Từ / Chunk).</div>';
    return;
  }

  if (!filtered.some((x) => String(x.id) === String(state.selectedEnglishVocabId))) {
    state.selectedEnglishVocabId = filtered[0].id;
  }

  listEl.innerHTML = filtered.map((v) => {
    const term = v.term || v.term_or_chunk || '';
    const on = String(v.id) === String(state.selectedEnglishVocabId);
    const stCls = v.srs_stage === 'mastered' ? 'mastered' : (v.is_due ? 'researching' : 'review');
    return `
      <div class="list-row ${on ? 'active' : ''}" onclick="selectEnBankItem('${escapeHtml(String(v.id))}')">
        <div class="row-top">
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="dot dot-${stCls}"></span>
            <span class="row-id">${escapeHtml(String(v.id))}</span>
            ${v.is_due ? `<span class="badge" style="color:#F59E0B;border-color:rgba(245,158,11,.4);">DUE</span>` : ''}
          </div>
          <span class="row-badge">${escapeHtml(_srsStageLabel(v.srs_stage || v.status_code))} · ${Number(v.interval_days || 0)}d</span>
        </div>
        <div class="row-title">${escapeHtml(term)}</div>
        <div class="row-sub">${escapeHtml(v.meaning_vi || '')}</div>
      </div>`;
  }).join('');

  const cur = filtered.find((x) => String(x.id) === String(state.selectedEnglishVocabId)) || filtered[0];
  const curIdx = filtered.indexOf(cur);
  const term = cur.term || cur.term_or_chunk || '';
  const isEn = state.appLang === 'en';

  detailEl.innerHTML = `
    <div class="d-toolbar">
      <div style="display:flex;gap:6px;align-items:center;">
        <button type="button" class="btn btn-sm" onclick="navigateAdjacentEnVocab(-1)">← Trước</button>
        <span class="mono" style="font-size:11px;color:var(--muted);">${curIdx + 1} / ${filtered.length}</span>
        <button type="button" class="btn btn-sm" onclick="navigateAdjacentEnVocab(1)">Sau →</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button type="button" class="btn btn-sm btn-indigo" onclick="practiceVocabInCoach('${escapeHtml(String(cur.id))}')">🎤 Thực chiến 1-1</button>
        <button type="button" class="btn btn-sm" onclick="resetSrsCardFromBank('${escapeHtml(String(cur.id))}')">↺ Reset SRS</button>
        <button type="button" class="btn btn-sm" onclick="openEnVocabEditorModal('${escapeHtml(String(cur.id))}')">✎ Sửa</button>
        <button type="button" class="btn btn-sm btn-danger" onclick="deleteEnVocabBankItem('${escapeHtml(String(cur.id))}')">✕ Xóa</button>
      </div>
    </div>

    <div class="d-head">
      <div class="d-meta">
        <span class="mono">${escapeHtml(String(cur.id))}</span>
        <span>·</span>
        <span class="badge">${escapeHtml(cur.category || '')}</span>
        ${cur.word_class ? `<span class="badge">${escapeHtml(cur.word_class)}</span>` : ''}
        ${cur.linked_record_id ? `<span class="badge mono">Liên kết: ${escapeHtml(cur.linked_record_id)}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%;">
        <h2 class="d-title" style="margin:0;">${escapeHtml(term)}</h2>
        ${cur.ipa ? `<span class="vb-ipa">${escapeHtml(cur.ipa)}</span>` : ''}
        <button type="button" class="btn btn-sm" data-speak="${escapeHtml(term)}">🔊 Nghe phát âm</button>
      </div>
    </div>

    <div class="d-sections" style="margin-top:12px;">
      <section class="note-block">
        <div class="nb-head"><span class="nb-title">NGHĨA CHUYÊN NGÀNH &amp; COLLOCATIONS</span></div>
        <div class="nb-body">
          <div style="font-size:15px;font-weight:700;color:var(--green);margin-bottom:6px;">${escapeHtml(cur.meaning_vi || '')}</div>
          ${cur.collocations ? `<div style="font-size:12.5px;"><b>${isEn ? 'Collocations:' : 'Cụm từ hay đi kèm:'}</b> <span class="mono" style="color:#818CF8;">${escapeHtml(cur.collocations)}</span></div>` : ''}
        </div>
      </section>

      <section class="note-block">
        <div class="nb-head">
          <span class="nb-title">NGỮ CẢNH THỰC TẾ (SONG NGỮ EN ⇄ VI)</span>
          ${cur.example_en ? `<button type="button" class="btn btn-sm" data-speak="${escapeHtml(cur.example_en)}">🔊 Đọc câu ví dụ</button>` : ''}
        </div>
        <div class="nb-body">
          <div class="vb-ex-en" style="margin-bottom:6px;">${escapeHtml(cur.example_en || '— Chưa có câu ví dụ Tiếng Anh —')}</div>
          <div style="color:var(--muted);">${escapeHtml(cur.example_vi || '— Chưa có bản dịch Tiếng Việt —')}</div>
        </div>
      </section>

      <section class="note-block">
        <div class="nb-head">
          <span class="nb-title">THÔNG SỐ THUẬT TOÁN LẶP LẠI NGẮT QUÃNG (SM-2 SRS)</span>
          <button type="button" class="btn btn-sm" onclick="enterWorkspace('english', 'en-quiz')">🧠 Ôn thẻ này ở Phòng 01</button>
        </div>
        <div class="nb-body">
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;">
            <span><span>${isEn ? 'Stage:' : 'Trạng thái:'}</span> <b>${escapeHtml(_srsStageLabel(cur.srs_stage))}</b></span>
            <span><span>${isEn ? 'Interval:' : 'Khoảng cách ôn:'}</span> <b class="mono">${Number(cur.interval_days || 0)} ${isEn ? 'days' : 'ngày'}</b></span>
            <span><span>Ease Factor:</span> <b class="mono">${Number(cur.ease_factor || 2.5).toFixed(2)}</b></span>
            <span><span>${isEn ? 'Repetitions:' : 'Số lần đúng:'}</span> <b class="mono">${Number(cur.repetitions || 0)}</b></span>
            <span><span>${isEn ? 'Next review:' : 'Đến hạn tới:'}</span> <b class="mono">${escapeHtml(cur.next_review_at || (isEn ? 'Due today' : 'Ngay hôm nay'))}</b></span>
          </div>
        </div>
      </section>
    </div>`;
  if (state.appLang === 'en' && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

function practiceVocabInCoach(cardId) {
  const cur = (state.englishCards || []).find((x) => String(x.id) === String(cardId));
  if (!cur) return;
  state.enCoach.customMode = false;
  state.enCoach.drillId = '';
  state.enCoach.mode = 'interview';
  state.enCoach.viPrompt = cur.example_vi
    ? `Hãy diễn đạt/trình bày lại tình huống sau bằng Tiếng Anh và BẮT BUỘC dùng "${cur.term}": ${cur.example_vi}`
    : `Giải thích khái niệm kỹ thuật "${cur.term}" (${cur.meaning_vi}) cho đồng nghiệp hoặc nhà tuyển dụng.`;
  state.enCoach.referenceEn = cur.example_en || `In industrial diagnostics, ${cur.term} plays a critical role in system reliability.`;
  state.enCoach.sourceRef = cur.linked_record_id || cur.id;
  state.enCoach.targetKeywords = [cur.term];
  state.enCoach.userEn = '';
  state.enCoach.result = null;
  switchTab('en-coach');
}

async function resetSrsCardFromBank(cardId) {
  try {
    const res = await fetch(`/api/english/cards/${encodeURIComponent(cardId)}/reset`, { method: 'POST' });
    if (!res.ok) throw new Error('Không thể Reset SRS');
    const data = await res.json();
    _applyEnglishCardsResponse(data);
    renderEnVocabBankView();
    showToast('Đã đưa thẻ về trạng thái Từ mới (New)', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteEnVocabBankItem(cardId) {
  if (!confirm(state.appLang === 'en' ? 'Delete this card permanently?' : 'Xóa vĩnh viễn thẻ từ vựng này khỏi kho SRS?')) return;
  try {
    const res = await fetch(`/api/english/cards/${encodeURIComponent(cardId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Không thể xóa thẻ');
    const data = await res.json();
    _applyEnglishCardsResponse(data);
    renderEnVocabBankView();
    showToast('Đã xóa thẻ khỏi Kho SRS', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---- Modal Thêm / Sửa Thẻ SRS + Magic Fill ----
function openEnVocabEditorModal(cardId = null) {
  const modal = document.getElementById('en-vocab-edit-modal');
  if (!modal) return;
  const cur = cardId ? (state.englishCards || []).find((x) => String(x.id) === String(cardId)) : null;
  document.getElementById('ev-form-id').value = cur ? String(cur.id) : '';
  document.getElementById('ev-form-term').value = cur ? (cur.term || '') : '';
  document.getElementById('ev-form-ipa').value = cur ? (cur.ipa || '') : '';
  const wcEl = document.getElementById('ev-form-word-class');
  if (wcEl) wcEl.value = cur ? (cur.word_class || 'Noun') : 'Noun';
  const catEl = document.getElementById('ev-form-category');
  if (catEl) {
    const fallbackCat = state.enBankFilters.category !== 'ALL' ? state.enBankFilters.category : 'PLC & Tự động hóa';
    catEl.value = cur ? cur.category : fallbackCat;
  }
  const stEl = document.getElementById('ev-form-status');
  if (stEl) stEl.value = cur ? (cur.srs_stage || 'new') : 'new';
  const colEl = document.getElementById('ev-form-collocations');
  if (colEl) colEl.value = cur ? (cur.collocations || '') : '';
  document.getElementById('ev-form-source').value = cur ? (cur.linked_record_id || '') : '';
  document.getElementById('ev-form-meaning').value = cur ? (cur.meaning_vi || '') : '';
  document.getElementById('ev-form-ex-en').value = cur ? (cur.example_en || '') : '';
  document.getElementById('ev-form-ex-vi').value = cur ? (cur.example_vi || '') : '';

  const titleEl = document.getElementById('en-vocab-edit-modal-title');
  if (titleEl) {
    const span = titleEl.querySelector('span');
    if (span) span.textContent = cur ? `CHỈNH SỬA THẺ ${cur.id}` : 'THÊM TỪ VỰNG / CỤM TỪ MỚI (SM-2)';
  }
  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('ev-form-term')?.focus(), 40);
}

function closeEnVocabEditorModal() {
  document.getElementById('en-vocab-edit-modal')?.classList.add('hidden');
}

async function magicFillVocabModal() {
  const term = (document.getElementById('ev-form-term')?.value || '').trim();
  if (!term) {
    showToast('Vui lòng gõ 1 từ hoặc cụm từ tiếng Anh trước khi bấm Magic Fill', 'info');
    return;
  }
  try {
    const res = await fetch('/api/english/magic-fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term, category_hint: document.getElementById('ev-form-category')?.value || '' }),
    });
    if (!res.ok) throw new Error('Magic Fill thất bại');
    const d = await res.json();
    document.getElementById('ev-form-term').value = d.term || term;
    document.getElementById('ev-form-ipa').value = d.ipa || '';
    if (document.getElementById('ev-form-word-class') && d.word_class) document.getElementById('ev-form-word-class').value = d.word_class;
    if (document.getElementById('ev-form-category') && d.category) document.getElementById('ev-form-category').value = d.category;
    if (document.getElementById('ev-form-collocations')) document.getElementById('ev-form-collocations').value = d.collocations || '';
    document.getElementById('ev-form-meaning').value = d.meaning_vi || '';
    document.getElementById('ev-form-ex-en').value = d.example_en || '';
    document.getElementById('ev-form-ex-vi').value = d.example_vi || '';
    showToast(`✨ Magic Fill đã điền đầy đủ thông số cho "${d.term || term}"!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitEnVocabEditorForm(ev) {
  ev.preventDefault();
  const cardId = (document.getElementById('ev-form-id')?.value || '').trim();
  const payload = {
    term: (document.getElementById('ev-form-term')?.value || '').trim(),
    ipa: (document.getElementById('ev-form-ipa')?.value || '').trim(),
    word_class: document.getElementById('ev-form-word-class')?.value || 'Noun',
    category: document.getElementById('ev-form-category')?.value || 'PLC & Tự động hóa',
    srs_stage: document.getElementById('ev-form-status')?.value || 'new',
    collocations: (document.getElementById('ev-form-collocations')?.value || '').trim(),
    linked_record_id: (document.getElementById('ev-form-source')?.value || '').trim(),
    meaning_vi: (document.getElementById('ev-form-meaning')?.value || '').trim(),
    example_en: (document.getElementById('ev-form-ex-en')?.value || '').trim(),
    example_vi: (document.getElementById('ev-form-ex-vi')?.value || '').trim(),
  };
  try {
    const url = cardId ? `/api/english/cards/${encodeURIComponent(cardId)}` : '/api/english/cards';
    const res = await fetch(url, {
      method: cardId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Không thể lưu thẻ từ vựng');
    const data = await res.json();
    _applyEnglishCardsResponse(data);
    if (data.item?.id) state.selectedEnglishVocabId = data.item.id;
    closeEnVocabEditorModal();
    if (state.activeWorkspace === 'english' && state.activeTab === 'en-vocab-bank') renderEnVocabBankView();
    showToast(cardId ? 'Đã cập nhật thẻ từ vựng' : 'Đã thêm thẻ mới vào Kho SRS', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===========================================================================
// TAB 03 (DRAWER): PHỄU NẠP DỮ LIỆU NHANH (MAGIC FILL / QUÉT 83 CA MRL / MANUAL)
// ===========================================================================
function setEnIngestSubTab(subTab) {
  if (state.enIngest.drawerOpen && state.enIngest.subTab === subTab) {
    state.enIngest.drawerOpen = false;
  } else {
    state.enIngest.subTab = subTab;
    state.enIngest.drawerOpen = true;
  }
  renderEnVocabBankView();
}

async function runIngestMagicFill() {
  const term = (document.getElementById('ing-magic-term')?.value || state.enIngest.magicTerm || '').trim();
  if (!term) {
    showToast('Vui lòng nhập 1 từ hoặc cụm từ tiếng Anh (VD: bootstrap capacitor)', 'info');
    return;
  }
  state.enIngest.magicTerm = term;
  state.enIngest.loading = true;
  renderEnIngestView();
  try {
    const res = await fetch('/api/english/magic-fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term }),
    });
    if (!res.ok) throw new Error('Magic Fill thất bại');
    state.enIngest.magicResult = await res.json();
    state.enIngest.loading = false;
    renderEnIngestView();
  } catch (err) {
    state.enIngest.loading = false;
    renderEnIngestView();
    showToast(err.message, 'error');
  } finally {
    state.enIngest.loading = false;
  }
}

async function saveIngestMagicResult() {
  const payload = {
    term: (document.getElementById('ing-mf-term')?.value || '').trim(),
    ipa: (document.getElementById('ing-mf-ipa')?.value || '').trim(),
    word_class: document.getElementById('ing-mf-wc')?.value || 'Noun',
    category: document.getElementById('ing-mf-cat')?.value || 'PLC & Tự động hóa',
    meaning_vi: (document.getElementById('ing-mf-vi')?.value || '').trim(),
    collocations: (document.getElementById('ing-mf-col')?.value || '').trim(),
    example_en: (document.getElementById('ing-mf-exen')?.value || '').trim(),
    example_vi: (document.getElementById('ing-mf-exvi')?.value || '').trim(),
    srs_stage: 'new',
  };
  if (!payload.term || !payload.meaning_vi) {
    showToast('Cần nhập đủ Thuật ngữ và Nghĩa Tiếng Việt', 'error');
    return;
  }
  try {
    const res = await fetch('/api/english/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Không thể lưu thẻ mới');
    const data = await res.json();
    _applyEnglishCardsResponse(data);
    renderEnVocabBankView();
    showToast(`✓ Đã lưu "${payload.term}" vào Kho SRS!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function runScanMrlRecords() {
  state.enIngest.loading = true;
  renderEnIngestView();
  try {
    const res = await fetch('/api/english/scan-mrl-records');
    if (!res.ok) throw new Error('Không thể quét bản ghi MRL');
    const data = await res.json();
    state.enIngest.scanData = data;
    state.enIngest.selectedScanCards = {};
    state.enIngest.selectedScanDrills = {};
    (data.candidate_cards || []).slice(0, 6).forEach((_, i) => { state.enIngest.selectedScanCards[i] = true; });
    (data.candidate_drills || []).slice(0, 4).forEach((_, i) => { state.enIngest.selectedScanDrills[i] = true; });
    state.enIngest.loading = false;
    renderEnIngestView();
    showToast(`Đã quét ${data.scanned_records} bản ghi kỹ thuật — tìm thấy ${(data.candidate_cards || []).length} từ mới & ${(data.candidate_drills || []).length} tình huống thực chiến!`, 'success');
  } catch (err) {
    state.enIngest.loading = false;
    renderEnIngestView();
    showToast(err.message, 'error');
  } finally {
    state.enIngest.loading = false;
  }
}

async function commitScanMrlBulkIngest() {
  const sc = state.enIngest.scanData;
  if (!sc) return;
  const cards = (sc.candidate_cards || []).filter((_, i) => Boolean(state.enIngest.selectedScanCards[i]));
  const drills = (sc.candidate_drills || []).filter((_, i) => Boolean(state.enIngest.selectedScanDrills[i]));
  if (!cards.length && !drills.length) {
    showToast('Vui lòng tick chọn ít nhất 1 thẻ từ hoặc tình huống thực chiến để nạp', 'info');
    return;
  }
  try {
    const res = await fetch('/api/english/bulk-ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards, drills }),
    });
    if (!res.ok) throw new Error('Lỗi khi nạp hàng loạt');
    const data = await res.json();
    _applyEnglishCardsResponse(data);
    renderEnVocabBankView();
    showToast(`📥 Đã nạp ${data.inserted_cards} thẻ SRS & ${data.inserted_drills} tình huống thực chiến mới!`, 'success');
    await runScanMrlRecords();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function runExtractManualText() {
  const text = (document.getElementById('ing-manual-ta')?.value || state.enIngest.manualText || '').trim();
  if (text.length < 10) {
    showToast('Dán đoạn văn tiếng Anh ít nhất 10 ký tự', 'info');
    return;
  }
  state.enIngest.manualText = text;
  state.enIngest.loading = true;
  renderEnIngestView();
  try {
    const res = await fetch('/api/english/extract-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manual_text: text }),
    });
    if (!res.ok) throw new Error('Lỗi bóc tách đoạn văn Manual');
    const data = await res.json();
    state.enIngest.extractData = data;
    state.enIngest.selectedExtractTerms = {};
    (data.terms || []).forEach((t, i) => {
      if (!t.already_in_bank) state.enIngest.selectedExtractTerms[i] = true;
    });
    state.enIngest.loading = false;
    renderEnIngestView();
  } catch (err) {
    state.enIngest.loading = false;
    renderEnIngestView();
    showToast(err.message, 'error');
  } finally {
    state.enIngest.loading = false;
  }
}

async function commitExtractManualBulkIngest() {
  const ex = state.enIngest.extractData;
  if (!ex) return;
  const cards = (ex.terms || []).filter((_, i) => Boolean(state.enIngest.selectedExtractTerms[i]));
  if (!cards.length) {
    showToast('Vui lòng tick chọn ít nhất 1 từ vựng chưa có trong kho', 'info');
    return;
  }
  try {
    const res = await fetch('/api/english/bulk-ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards, drills: [] }),
    });
    if (!res.ok) throw new Error('Lỗi lưu hàng loạt từ Manual');
    const data = await res.json();
    _applyEnglishCardsResponse(data);
    renderEnVocabBankView();
    showToast(`📥 Đã thêm ${data.inserted_cards} thẻ mới từ Manual vào Kho SRS!`, 'success');
    await runExtractManualText();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderEnIngestView() {
  _syncAiKeyButtons();
  const modePills = document.getElementById('en-ingest-mode-pills');
  const drawerEl = document.getElementById('en-vocab-ingest-drawer');
  const closeBtn = document.getElementById('en-ingest-close-btn');
  const container = document.getElementById('en-ingest-container');
  const isOpen = Boolean(state.enIngest.drawerOpen);

  if (drawerEl) drawerEl.classList.toggle('hidden', !isOpen);
  if (closeBtn) closeBtn.classList.toggle('hidden', !isOpen);

  const sub = state.enIngest.subTab || 'magic';
  if (modePills) {
    modePills.innerHTML = `
      <button type="button" class="chip ${isOpen && sub === 'magic' ? 'active' : ''}" onclick="setEnIngestSubTab('magic')">✨ 1-Click Magic Fill (Gõ 1 từ tự điền trọn bộ)</button>
      <button type="button" class="chip ${isOpen && sub === 'scan' ? 'active' : ''}" onclick="setEnIngestSubTab('scan')">🔄 Quét từ 83 ca MRL/PLC/NET</button>
      <button type="button" class="chip ${isOpen && sub === 'manual' ? 'active' : ''}" onclick="setEnIngestSubTab('manual')">📄 Dán Manual &amp; Bóc tách từ</button>`;
  }
  if (!container) return;
  if (!isOpen) {
    container.innerHTML = '';
    if (state.appLang === 'en' && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
    return;
  }

  if (sub === 'magic') {
    const mf = state.enIngest.magicResult;
    const catOpts = (typeof ENGLISH_CATEGORIES !== 'undefined' && ENGLISH_CATEGORIES.length > 1)
      ? ENGLISH_CATEGORIES.filter((c) => c.key !== 'ALL').map((c) => c.key)
      : ['Giao tiếp & Hội thoại', 'Lexical Chunks (Cụm từ nối)', 'Biến tần & Phần cứng', 'PLC & Tự động hóa', 'Mạng truyền thông', 'Giao tiếp Phỏng vấn'];
    container.innerHTML = `
      <div class="ingest-panel">
        <div style="font-size:14px;font-weight:800;color:#818CF8;margin-bottom:6px;">✨ 1-CLICK MAGIC FILL (NHẬP 1 TỪ → TỰ ĐIỀN TOÀN BỘ THẺ SRS)</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:10px;">Gõ bất kỳ thuật ngữ điện tử / PLC / mạng hoặc Lexical Chunk nào — hệ thống tự tạo IPA, Loại từ, Nghĩa chuyên ngành, Collocations &amp; Câu ví dụ thực tế.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          <input id="ing-magic-term" class="inp mono" style="flex:1;min-width:240px;" type="text"
            placeholder="VD: bootstrap capacitor, optocoupler, galvanic isolation, flyback diode..."
            value="${escapeHtml(state.enIngest.magicTerm || '')}"
            onkeydown="if(event.key==='Enter'){event.preventDefault();runIngestMagicFill();}" />
          <button type="button" class="btn btn-indigo" onclick="runIngestMagicFill()" ${state.enIngest.loading ? 'disabled' : ''}>✨ Tự động điền</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          ${['bootstrap capacitor', 'optocoupler', 'flyback diode', 'galvanic isolation', 'snubber circuit'].map((s) =>
            `<button type="button" class="chip" onclick="state.enIngest.magicTerm='${s}'; runIngestMagicFill();">${s}</button>`
          ).join('')}
        </div>
        ${mf ? `
          <div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--line);">
            <div class="fgrid c2">
              <div><label class="lbl">Thuật ngữ</label><input id="ing-mf-term" class="inp mono" value="${escapeHtml(mf.term || '')}" /></div>
              <div><label class="lbl">IPA</label><input id="ing-mf-ipa" class="inp mono" value="${escapeHtml(mf.ipa || '')}" /></div>
            </div>
            <div class="fgrid c2">
              <div><label class="lbl">Loại từ (Word Class)</label><input id="ing-mf-wc" class="inp" value="${escapeHtml(mf.word_class || 'Noun')}" /></div>
              <div><label class="lbl">Chuyên mục</label>
                <select id="ing-mf-cat" class="sel">
                  ${catOpts.map((c) =>
                    `<option value="${escapeHtml(c)}" ${mf.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`
                  ).join('')}
                </select>
              </div>
            </div>
            <div><label class="lbl">Nghĩa chuyên ngành</label><input id="ing-mf-vi" class="inp" value="${escapeHtml(mf.meaning_vi || '')}" /></div>
            <div><label class="lbl">Collocations (Cụm từ đi kèm)</label><input id="ing-mf-col" class="inp mono" value="${escapeHtml(mf.collocations || '')}" /></div>
            <div class="fgrid c2">
              <div><label class="lbl">Ví dụ Tiếng Anh</label><textarea id="ing-mf-exen" class="inp" rows="2">${escapeHtml(mf.example_en || '')}</textarea></div>
              <div><label class="lbl">Dịch Tiếng Việt</label><textarea id="ing-mf-exvi" class="inp" rows="2">${escapeHtml(mf.example_vi || '')}</textarea></div>
            </div>
            <div style="margin-top:10px;display:flex;gap:8px;">
              <button type="button" class="btn btn-indigo" onclick="saveIngestMagicResult()">💾 Lưu vào Kho SRS</button>
              <button type="button" class="btn" data-speak="${escapeHtml(mf.example_en || mf.term || '')}">🔊 Nghe ví dụ</button>
            </div>
          </div>` : ''}
      </div>`;
  } else if (sub === 'scan') {
    const sc = state.enIngest.scanData;
    container.innerHTML = `
      <div class="ingest-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
          <div>
            <div style="font-size:14px;font-weight:800;color:#818CF8;">🔄 QUÉT 83 BẢN GHI MRL / PLC / NETWORK ĐỂ TRÍCH XUẤT TỪ &amp; TÌNH HUỐNG MỚI</div>
            <div style="font-size:12px;color:var(--muted);">Tự động lọc thuật ngữ kỹ thuật chưa có trong Kho SRS và biến ca sửa chữa / PLC / Network thực tế thành câu luyện dịch 1-1.</div>
          </div>
          <button type="button" class="btn btn-indigo" onclick="runScanMrlRecords()" ${state.enIngest.loading ? 'disabled' : ''}>${state.enIngest.loading ? '⏳ Đang quét 83 bản ghi...' : '🔄 Quét kho MRL ngay'}</button>
        </div>
        ${sc ? `
          <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <span class="badge">Đã quét ${sc.scanned_records} bản ghi · ${(sc.candidate_cards || []).length} từ mới · ${(sc.candidate_drills || []).length} câu thực chiến</span>
            <button type="button" class="btn btn-sm btn-indigo" onclick="commitScanMrlBulkIngest()">📥 Nạp các mục đã chọn vào SRS</button>
          </div>
          <div class="scan-extract-list">
            ${(sc.candidate_cards || []).map((c, i) => `
              <label class="scan-row">
                <input type="checkbox" ${state.enIngest.selectedScanCards[i] ? 'checked' : ''} onchange="state.enIngest.selectedScanCards[${i}] = this.checked" />
                <div>
                  <b>${escapeHtml(c.term)}</b> <span class="vb-ipa">${escapeHtml(c.ipa || '')}</span> <span class="badge">${escapeHtml(c.word_class || 'Noun')}</span>
                  <div style="font-size:12px;color:var(--green);">${escapeHtml(c.meaning_vi)}</div>
                </div>
                <span class="badge mono">${escapeHtml(c.linked_record_id || '')}</span>
              </label>`).join('')}
            ${(sc.candidate_drills || []).map((d, i) => `
              <label class="scan-row">
                <input type="checkbox" ${state.enIngest.selectedScanDrills[i] ? 'checked' : ''} onchange="state.enIngest.selectedScanDrills[${i}] = this.checked" />
                <div>
                  <b style="color:#FBBF24;">[Bài dịch thực chiến] ${escapeHtml(d.title || d.linked_record_id)}</b>
                  <div style="font-size:12px;color:var(--text);">${escapeHtml(d.source_vi)}</div>
                </div>
                <span class="badge mono">${escapeHtml(d.linked_record_id || '')}</span>
              </label>`).join('')}
          </div>` : ''}
      </div>`;
  } else {
    const ex = state.enIngest.extractData;
    container.innerHTML = `
      <div class="ingest-panel">
        <div style="font-size:14px;font-weight:800;color:#818CF8;margin-bottom:6px;">📄 DÁN ĐOẠN VĂN MANUAL TIẾNG ANH → BÓC TÁCH THUẬT NGỮ HÀNG LOẠT</div>
        <textarea id="ing-manual-ta" class="oq-manual-ta" spellcheck="false"
          placeholder="Dán đoạn tài liệu kỹ thuật Manual Yaskawa, Siemens, Allen-Bradley, Modbus/PROFINET vào đây..."
          oninput="state.enIngest.manualText = this.value">${escapeHtml(state.enIngest.manualText || '')}</textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <button type="button" class="btn btn-sm" onclick="state.enIngest.manualText=SAMPLE_MANUAL_EXCERPTS.yaskawa; renderEnIngestView();">📋 Nạp mẫu Manual VFD</button>
          <button type="button" class="btn btn-sm" onclick="state.enIngest.manualText=SAMPLE_MANUAL_EXCERPTS.siemens; renderEnIngestView();">📋 Nạp mẫu Siemens PROFINET</button>
          <button type="button" class="btn btn-sm btn-indigo" onclick="runExtractManualText()" ${state.enIngest.loading ? 'disabled' : ''}>⚡ Bóc tách thuật ngữ &amp; Chunks</button>
          ${ex ? `<button type="button" class="btn btn-sm btn-green" onclick="commitExtractManualBulkIngest()">📥 Lưu mục đã tick vào Kho SRS</button>` : ''}
        </div>
        ${ex ? `
          <div style="margin-top:10px;font-size:12px;color:var(--muted);">${escapeHtml(ex.summary_vi || '')}</div>
          <div class="scan-extract-list">
            ${(ex.terms || []).map((t, i) => `
              <label class="scan-row">
                <input type="checkbox" ${t.already_in_bank ? 'disabled' : ''} ${state.enIngest.selectedExtractTerms[i] ? 'checked' : ''} onchange="state.enIngest.selectedExtractTerms[${i}] = this.checked" />
                <div>
                  <b>${escapeHtml(t.term)}</b> <span class="vb-ipa">${escapeHtml(t.ipa || '')}</span>
                  ${t.already_in_bank ? '<span class="badge">Đã có trong SRS</span>' : '<span class="badge" style="color:var(--green);">Mới</span>'}
                  <div style="font-size:12px;color:var(--text);">${escapeHtml(t.meaning_vi)}</div>
                  ${t.example_en ? `<div style="font-size:11px;color:var(--muted);">${escapeHtml(t.example_en)}</div>` : ''}
                </div>
                <span class="badge">${escapeHtml(t.category || '')}</span>
              </label>`).join('')}
          </div>` : ''}
      </div>`;
  }
  if (state.appLang === 'en' && typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

// ===========================================================================
// MODAL GEMINI AI CONFIG & VỞ NHÁP HELPERS (GIỮ NGUYÊN TƯƠNG THÍCH)
// ===========================================================================
async function openAiConfigModal() {
  const modal = document.getElementById('en-ai-config-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
  const statusEl = document.getElementById('ai-cfg-status-banner');
  const keyInp = document.getElementById('ai-cfg-key-input');
  const modelSel = document.getElementById('ai-cfg-model-select');
  if (keyInp) keyInp.value = '';
  const isEn = state.appLang === 'en';
  try {
    const res = await fetch('/api/english/ai-config');
    if (res.ok) {
      const cfg = await res.json();
      state.hasGeminiKey = Boolean(cfg.has_key);
      state.geminiModel = cfg.model || 'gemini-2.0-flash';
      if (modelSel) modelSel.value = state.geminiModel;
      if (statusEl) {
        statusEl.innerHTML = cfg.has_key
          ? (isEn
            ? `<span style="color:var(--green);">● GEMINI API KEY CONNECTED: <b>${escapeHtml(cfg.masked_key)}</b> · Model: ${escapeHtml(cfg.model)}</span>`
            : `<span style="color:var(--green);">● ĐÃ KẾT NỐI GEMINI API KEY: <b>${escapeHtml(cfg.masked_key)}</b> · Model: ${escapeHtml(cfg.model)}</span>`)
          : (isEn
            ? `<span style="color:var(--amber);">● NO API KEY SET — Running 100% Free Offline Rule-based Engine</span>`
            : `<span style="color:var(--amber);">● CHƯA CÀI API KEY — Đang sử dụng bộ Offline Engine thông minh (Miễn phí 100%)</span>`);
      }
      _syncAiKeyButtons();
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = isEn ? 'Could not check AI config status' : 'Không kiểm tra được trạng thái AI config';
  }
}

function closeAiConfigModal() {
  document.getElementById('en-ai-config-modal')?.classList.add('hidden');
}

async function submitAiConfigForm(ev) {
  ev.preventDefault();
  const isEn = state.appLang === 'en';
  const key = (document.getElementById('ai-cfg-key-input')?.value || '').trim();
  const model = document.getElementById('ai-cfg-model-select')?.value || 'gemini-2.0-flash';
  try {
    const res = await fetch('/api/english/ai-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gemini_api_key: key || (state.hasGeminiKey ? '__KEEP__' : ''), gemini_model: model }),
    });
    if (!res.ok) throw new Error(isEn ? 'Failed to save AI configuration' : 'Lưu cấu hình AI thất bại');
    const data = await res.json();
    state.hasGeminiKey = Boolean(data.has_key);
    state.geminiModel = data.model || model;
    _syncAiKeyButtons();
    if (state.activeWorkspace === 'english') renderSidebarForWorkspace();
    if (state.activeTab === 'en-quiz') renderEnQuizView();
    closeAiConfigModal();
    showToast(state.hasGeminiKey ? '🔑 Đã lưu Gemini API Key!' : 'Đã lưu cấu hình Offline Engine', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function clearGeminiApiKey() {
  try {
    await fetch('/api/english/ai-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gemini_api_key: '', gemini_model: state.geminiModel || 'gemini-2.0-flash' }),
    });
    state.hasGeminiKey = false;
    _syncAiKeyButtons();
    if (state.activeWorkspace === 'english') renderSidebarForWorkspace();
    closeAiConfigModal();
    showToast('Đã xóa Gemini API Key — Chuyển về chế độ Offline 100%', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function insertSampleManualToScratchpad() {
  const ta = document.getElementById('scratchpad-textarea');
  if (!ta) return;
  const sample = `${SAMPLE_MANUAL_EXCERPTS.yaskawa}\n\n${SAMPLE_MANUAL_EXCERPTS.siemens}`;
  ta.value = ta.value.trim() ? `${ta.value.trim()}\n\n${sample}` : sample;
  if (!state.scratchpads.english) {
    state.scratchpads.english = { workspace: 'english', content: '', images_json: [], font_mode: 'sans' };
  }
  state.scratchpads.english.content = ta.value;
  if (typeof saveScratchpadNow === 'function') saveScratchpadNow(false);
  showToast('Đã nạp mẫu Manual Siemens & Yaskawa — bôi đen bất kỳ cụm từ nào để dịch & lưu!', 'success');
}

function sendScratchpadTextToOpenQuiz() {
  const ta = document.getElementById('scratchpad-textarea');
  const txt = (ta?.value || state.scratchpads?.english?.content || '').trim();
  if (txt.length < 15) {
    showToast('Vở nháp đang trống — hãy dán văn bản Manual tiếng Anh hoặc bấm "Nạp mẫu Manual"', 'info');
    return;
  }
  state.enIngest.subTab = 'manual';
  state.enIngest.manualText = txt;
  switchTab('en-ingest');
  setTimeout(() => runExtractManualText(), 80);
}
