// ---------------------------------------------------------------------------
// 06 Ôn tập Sâu (Deep Active Recall + Trắc nghiệm + Tự gõ đối chiếu)
// ---------------------------------------------------------------------------
function _hashKey(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function _wsForItemKind(kind) {
  if (kind === 'plc') return 'plc';
  if (kind === 'network') return 'network';
  return 'mrl';
}

function _findRecordByKindId(kind, id) {
  if (kind === 'plc') return state.plcNotes.find((x) => x.id === id) || null;
  if (kind === 'network') return state.networkNotes.find((x) => x.id === id) || null;
  if (kind === 'knowledge') return state.knowledgeItems.find((x) => x.id === id) || null;
  if (kind === 'repair') return state.repairCases.find((x) => x.id === id) || null;
  return null;
}

function _getItemTitle(kind, item) {
  if (!item) return '';
  if (kind === 'plc') return item.title || '';
  if (kind === 'network') return item.target_device || '';
  if (kind === 'knowledge') return item.topic_model || '';
  if (kind === 'repair') return item.brand_model || '';
  return '';
}

function _getItemTags(kind, item) {
  if (!item) return [];
  if (kind === 'plc' || kind === 'network') return item.tags || [];
  return item.component_tags || [];
}

function _getItemSections(kind, item) {
  if (!item) return [];
  if (item.custom_sections_json && item.custom_sections_json.length) return item.custom_sections_json;
  if (kind === 'plc') {
    return [
      ...(item.core_summary ? [{ title: 'BẢN CHẤT & NGUYÊN LÝ HOẠT ĐỘNG', style: 'warn', content: item.core_summary, images: [] }] : []),
      ...(item.code_snippet ? [{ title: 'CODE MẪU (SCL / LOGIC LAD)', style: 'code', content: item.code_snippet, images: [] }] : []),
      ...(item.common_pitfalls ? [{ title: 'LỖI CẤU HÌNH HAY QUÊN / BẪY THƯỜNG GẶP', style: 'pitfall', content: item.common_pitfalls, images: [] }] : []),
      ...(item.interview_qa ? [{ title: 'CÂU HỎI PHẢN BIỆN (WHY?) & TRẢ LỜI', style: 'qa', content: item.interview_qa, images: [] }] : []),
    ];
  }
  if (kind === 'network') {
    return [
      ...(item.physical_wiring ? [{ title: 'ĐẤU NỐI VẬT LÝ · CHÂN CÁP · ĐIỆN TRỞ 120Ω', style: 'warn', content: item.physical_wiring, images: [] }] : []),
      ...(item.comm_settings ? [{ title: 'THÔNG SỐ TRUYỀN THÔNG & PARAMETER BIẾN TẦN', style: 'info', content: item.comm_settings, images: [] }] : []),
      ...(item.test_script_code ? [{ title: 'SCRIPT TEST NHANH (PYTHON / PLC CONFIG)', style: 'code', content: item.test_script_code, images: [] }] : []),
      ...(item.troubleshooting_tips ? [{ title: 'KINH NGHIỆM BẮT LỖI MẤT KẾT NỐI · NHIỄU · TIMEOUT', style: 'pitfall', content: item.troubleshooting_tips, images: [] }] : []),
    ];
  }
  return [];
}

function _extractBulletItems(content) {
  const raw = String(content || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return [];
  const lines = raw.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
  const markerRe = /^\s*(?:\d+[\.\)]\s+|[•\-*]\s+|NOTE\s*:)/i;
  const markedCount = lines.filter((l) => markerRe.test(l)).length;
  if (markedCount >= 2) {
    const grouped = [];
    for (const ln of lines) {
      if (markerRe.test(ln) || grouped.length === 0) grouped.push(ln.trim());
      else grouped[grouped.length - 1] += '\n' + ln.trim();
    }
    return grouped.filter((g) => g.length > 4);
  }
  const paras = raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length >= 2) return paras;
  return [raw];
}

function _maskTechnicalTerms(text) {
  let maskedCount = 0;
  const masked = String(text || '').replace(
    /(\[[A-Za-z0-9_.\-]+\]|#[A-Za-z0-9_]+|\b0x[0-9A-Fa-f]+\b|\b[A-Z][A-Z0-9_]{2,}\b|\b\d+(?:\.\d+)?\s*(?:ms|Hz|mA|VDC|VAC|Ω|ohm|kbps|bps|Bar)\b)/g,
    (m) => {
      if (maskedCount >= 4) return m;
      maskedCount += 1;
      return '[___]';
    }
  );
  return { masked, maskedCount };
}

function _parseTermSplit(rawLine) {
  const clean = String(rawLine || '').replace(/^\s*(?:\d+[\.\)]\s+|[•\-*]\s+)/, '').trim();
  const colonM = clean.match(/^([^:\n]{2,64}?)\s*:\s+([\s\S]+)$/);
  if (colonM && !/^https?$/i.test(colonM[1].trim())) {
    return { clean, term: colonM[1].trim(), rest: colonM[2].trim(), kind: 'colon' };
  }
  const verbM = clean.match(/^(.{3,52}?)\s+(?:chỉ dùng|đây là|là để|dùng để|giúp|gồm|cho phép|là)\s+([\s\S]+)$/i);
  if (verbM) {
    return { clean, term: verbM[1].trim(), rest: clean, kind: 'verb' };
  }
  return { clean, term: '', rest: clean, kind: 'plain' };
}

function _buildQuestionForSectionLine(secTitle, rawLine, topicTitle, termCounts, idx, totalLines) {
  const parsed = _parseTermSplit(rawLine);
  if (parsed.kind === 'colon') {
    const tLow = parsed.term.toLowerCase();
    const repeated = (termCounts[tLow] || 0) > 1 || parsed.term.length <= 4;
    if (/^note$/i.test(parsed.term)) {
      return {
        q: `Trong "${secTitle}" (${topicTitle}):\nLưu ý cốt lõi (NOTE) bắt buộc phải nhớ là gì?`,
        hint: parsed.rest.slice(0, 42) + (parsed.rest.length > 42 ? '...' : ''),
      };
    }
    if (!repeated) {
      return {
        q: `Trong "${secTitle}" (${topicTitle}):\n[${parsed.term}] hoạt động thế nào, dùng khi nào và cần lưu ý gì?`,
        hint: `Gồm ${parsed.rest.split(/[.;]/).filter((x) => x.trim()).length} ý chính`,
      };
    }
    const { masked, maskedCount } = _maskTechnicalTerms(parsed.rest);
    if (maskedCount > 0) {
      return {
        q: `Trong "${secTitle}" (${topicTitle}) · [${parsed.term}]:\nĐiền & giải thích phần ẩn: "${masked}"`,
        hint: `Từ khóa liên quan tới ${parsed.term}`,
      };
    }
  }
  if (parsed.kind === 'verb' && parsed.term) {
    return {
      q: `Trong "${secTitle}" (${topicTitle}):\n[${parsed.term}] là gì / dùng để làm gì và có lưu ý nào?`,
      hint: '',
    };
  }
  const { masked, maskedCount } = _maskTechnicalTerms(parsed.clean);
  if (maskedCount > 0) {
    return {
      q: `Trong "${secTitle}" (${topicTitle}) [Ý ${idx + 1}/${totalLines}]:\nHoàn thiện thông số/khái niệm còn thiếu:\n"${masked}"`,
      hint: '',
    };
  }
  const words = parsed.clean.split(/\s+/);
  const head = words.slice(0, Math.min(6, Math.max(3, Math.floor(words.length / 3)))).join(' ');
  return {
    q: `Trong "${secTitle}" (${topicTitle}) [Ý ${idx + 1}/${totalLines}]:\nTrình bày đầy đủ nội dung bắt đầu bằng: "${head} ..."`,
    hint: '',
  };
}

function _buildDeepCardsForItem(kind, item) {
  if (!item) return [];
  const cards = [];
  const seenKeys = {};
  const ws = _wsForItemKind(kind);
  const id = item.id || 'NEW';
  const title = _getItemTitle(kind, item);
  const tags = _getItemTags(kind, item);
  const fmt = (txt) => (tags.length ? highlightTagsHtml(txt || '', tags, item.fault_codes || []) : escapeHtml(txt || ''));

  const pushCard = (slot, spec) => {
    const rawKey = `${kind}:${id}:${slot}`;
    seenKeys[rawKey] = (seenKeys[rawKey] || 0) + 1;
    const cardKey = seenKeys[rawKey] > 1 ? `${rawKey}#${seenKeys[rawKey]}` : rawKey;
    cards.push({
      cardKey,
      kind,
      id,
      item,
      ws,
      title,
      badge: spec.badge || 'CÂU HỎI SÂU',
      subBadge: spec.subBadge || '',
      question: spec.question,
      hint: spec.hint || '',
      answerText: spec.answerText || '',
      answerHtml: spec.answerHtml || `<div class="nb-body">${fmt(spec.answerText || '')}</div>`,
      codeRaw: spec.codeRaw || '',
      contextTitle: spec.contextTitle || '',
      contextHtml: spec.contextHtml || '',
      images: spec.images || [],
      quiz: null,
    });
  };

  // 1. Câu hỏi ôn tập riêng (Hỏi xoáy - Đáp gọn)
  (item.drill_qa_json || []).forEach((qa, idx) => {
    if (!qa.q && !qa.a) return;
    pushCard(`qa:${_hashKey((qa.id || '') + '|' + qa.q)}`, {
      badge: 'CÂU HỎI TỦ',
      subBadge: `CÂU ${pad2(idx + 1)}`,
      question: qa.q || `Câu hỏi ôn tập #${idx + 1} (${title})`,
      hint: qa.hint || '',
      answerText: qa.a || '',
      answerHtml: `<div class="note-block ans"><div class="nb-title">ĐÁP ÁN CỐT LÕI</div><div class="nb-body">${fmt(qa.a || '')}</div></div>`,
    });
  });

  // 2. Nội dung đặc thù theo từng loại bản ghi
  if (kind === 'repair') {
    const steps = item.steps && item.steps.length
      ? item.steps
      : [{ step_order: 1, symptom: item.fault_symptom_raw, root_cause: item.root_cause_raw, solution: item.solution_raw }];
    steps.forEach((st, idx) => {
      const sym = (st.symptom || '').trim();
      const cause = (st.root_cause || '').trim();
      const sol = (st.solution || '').trim();
      if (!sym && !cause && !sol) return;
      pushCard(`step:${st.step_order || idx + 1}:${_hashKey(sym + cause)}`, {
        badge: `CA SỬA · BƯỚC ${pad2(st.step_order || idx + 1)}`,
        subBadge: categoryLabel(item.device_category),
        question: `Thiết bị ${title} xuất hiện hiện tượng:\n"${sym || item.fault_symptom_raw || 'Kiểm tra theo bước'}"\n→ Nguyên nhân gốc rễ và cách xử lý / linh kiện cần kiểm tra là gì?`,
        hint: (item.fault_codes || []).length ? `Mã lỗi liên quan: ${(item.fault_codes || []).join(', ')}` : '',
        answerText: [cause ? `Nguyên nhân: ${cause}` : '', sol ? `Xử lý: ${sol}` : ''].filter(Boolean).join('\n'),
        answerHtml: `<div class="trace"><div class="step"><div class="step-head">BƯỚC ${pad2(st.step_order || idx + 1)}</div><div class="spec">
          ${specRow('cause', 'Nguyên nhân gốc rễ', cause, item)}${specRow('sol', 'Cách xử lý & Linh kiện', sol, item)}</div></div></div>`,
      });
    });
    if ((item.note || '').trim().length > 10) {
      pushCard('note', {
        badge: 'LƯU Ý CẤP NGUỒN TEST',
        subBadge: categoryLabel(item.device_category),
        question: `Khi kiểm tra / cấp nguồn test cho ${title}, cần lưu ý điều gì về điện áp, chân jump hoặc cấu hình?`,
        answerText: item.note,
        answerHtml: `<div class="warn"><div class="warn-title"><span>LƯU Ý CẤP NGUỒN &amp; CẤU HÌNH</span></div><div class="warn-body">${highlightTagsHtml(item.note, item.component_tags, item.fault_codes)}</div></div>`,
      });
    }
    return cards;
  }

  if (kind === 'knowledge') {
    if ((item.why_question || '').trim() || (item.actionable_application || '').trim()) {
      pushCard('why', {
        badge: 'PHẢN BIỆN WHY?',
        subBadge: groupLabel(item.source_group),
        question: (item.why_question || '').trim() || `Ứng dụng thực chiến & giải pháp của chủ đề "${title}" là gì?`,
        hint: (item.key_takeaway || '').trim(),
        answerText: [item.key_takeaway, item.actionable_application].filter(Boolean).join('\n'),
        answerHtml: `<div class="stack">
          ${item.key_takeaway ? `<div class="note-block accent"><div class="nb-title">TỪ KHÓA LÕI</div><div class="nb-body">${fmt(item.key_takeaway)}</div></div>` : ''}
          ${item.actionable_application ? `<div class="note-block ans"><div class="nb-title">TRẢ LỜI THỰC CHIẾN &amp; GIẢI PHÁP</div><div class="nb-body">${fmt(item.actionable_application)}</div></div>` : ''}</div>`,
      });
    }
    if ((item.core_concept_workflow || '').trim()) {
      const bullets = _extractBulletItems(item.core_concept_workflow);
      const sopMode = isSopCategory(item.category);
      if (bullets.length >= 2) {
        bullets.forEach((b, idx) => {
          const parsed = _parseTermSplit(b);
          const { masked, maskedCount } = _maskTechnicalTerms(parsed.clean);
          let qText = sopMode
            ? `Trong quy trình SOP "${title}" — Bước ${pad2(idx + 1)} cần đo kiểm / thao tác gì?`
            : `Trong nguyên lý "${title}" [Ý ${idx + 1}/${bullets.length}]: trình bày rõ nội dung liên quan?`;
          if (parsed.kind === 'colon') {
            qText = `Trong "${title}": [${parsed.term}] có bản chất / thao tác gì?`;
          } else if (maskedCount > 0) {
            qText = `Trong "${title}" [Ý ${idx + 1}/${bullets.length}]: hoàn thiện chi tiết:\n"${masked}"`;
          } else if (sopMode && idx > 0) {
            const prevClean = bullets[idx - 1].replace(/^\s*\d+[\.\)]\s*/, '').slice(0, 48);
            qText = `Trong SOP "${title}": ngay sau "${prevClean}...", bước tiếp theo (${pad2(idx + 1)}) làm gì?`;
          }
          pushCard(`core:${idx}:${_hashKey(b)}`, {
            badge: sopMode ? `SOP BƯỚC ${pad2(idx + 1)}` : `NGUYÊN LÝ ${pad2(idx + 1)}`,
            subBadge: stripEmoji(item.category || '') || groupLabel(item.source_group),
            question: qText,
            answerText: b,
            answerHtml: `<div class="note-block"><div class="nb-title">${sopMode ? `BƯỚC ${pad2(idx + 1)}` : 'NỘI DUNG CHI TIẾT'}</div><div class="nb-body">${fmt(b)}</div></div>`,
            contextTitle: 'TOÀN BỘ NGUYÊN LÝ / QUY TRÌNH SOP',
            contextHtml: `<div class="nb-body">${fmt(item.core_concept_workflow)}</div>`,
          });
        });
      } else {
        pushCard('core:single', {
          badge: 'BẢN CHẤT NGUYÊN LÝ',
          subBadge: stripEmoji(item.category || '') || groupLabel(item.source_group),
          question: `Trình bày bản chất nguyên lý / quy trình của "${title}"?`,
          hint: item.key_takeaway || '',
          answerText: item.core_concept_workflow,
          answerHtml: `<div class="note-block"><div class="nb-title">BẢN CHẤT NGUYÊN LÝ / SOP</div><div class="nb-body">${fmt(item.core_concept_workflow)}</div></div>`,
        });
      }
    }
    if ((item.note || '').trim().length > 6) {
      pushCard('safety', {
        badge: 'LƯU Ý AN TOÀN',
        subBadge: groupLabel(item.source_group),
        question: `Khi thực hành "${title}", lưu ý an toàn & điểm dễ sai sót là gì?`,
        answerText: item.note,
        answerHtml: `<div class="warn safety"><div class="warn-title"><span>LƯU Ý AN TOÀN</span></div><div class="warn-body">${fmt(item.note)}</div></div>`,
      });
    }
  }

  // 3. Các Mục tùy chỉnh (áp dụng cho PLC, NET, Knowledge mở rộng)
  const sections = _getItemSections(kind, item);
  sections.forEach((sec, sIdx) => {
    const secTitle = (sec.title || `MỤC ${pad2(sIdx + 1)}`).trim();
    const content = (sec.content || '').trim();
    const imgs = sec.images || [];
    if (!content && !imgs.length) return;

    if (sec.style === 'code') {
      const codeLines = content.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('//') || l.startsWith('#'));
      pushCard(`sec:${sIdx}:code:${_hashKey(secTitle)}`, {
        badge: 'CODE & LOGIC',
        subBadge: secTitle,
        question: `Viết lại / trình bày cấu trúc lệnh chính trong mục "${secTitle}" của "${title}"?`,
        hint: codeLines.slice(0, 2).join(' | '),
        answerText: content,
        codeRaw: content,
        images: imgs,
        answerHtml: renderCustomSectionsHtml([sec], `fcd-${kind}-${id}-${sIdx}`, tags),
      });
      return;
    }

    const bullets = _extractBulletItems(content);
    if (bullets.length >= 2) {
      const termCounts = {};
      bullets.forEach((ln) => {
        const p = _parseTermSplit(ln);
        if (p.term) {
          const k = p.term.toLowerCase();
          termCounts[k] = (termCounts[k] || 0) + 1;
        }
      });
      bullets.forEach((b, bIdx) => {
        const { q, hint } = _buildQuestionForSectionLine(secTitle, b, title, termCounts, bIdx, bullets.length);
        pushCard(`sec:${sIdx}:b:${_hashKey(b)}`, {
          badge: secTitle.length > 30 ? `${secTitle.slice(0, 30)}...` : secTitle,
          subBadge: `Ý ${pad2(bIdx + 1)} / ${pad2(bullets.length)}`,
          question: q,
          hint,
          answerText: b,
          images: imgs,
          answerHtml: `<div class="note-block ${sec.style === 'pitfall' ? 'why' : (sec.style === 'qa' ? 'ans' : 'accent')}"><div class="nb-title">${escapeHtml(secTitle)}</div><div class="nb-body">${fmt(b)}</div></div>`,
          contextTitle: `NGỮ CẢNH ĐẦY ĐỦ: ${secTitle}`,
          contextHtml: renderCustomSectionsHtml([sec], `fcc-${kind}-${id}-${sIdx}`, tags),
        });
      });
    } else {
      const stylePrompt = sec.style === 'pitfall'
        ? `Những lỗi cấu hình hay quên / bẫy thường gặp trong "${secTitle}" (${title}) là gì?`
        : (sec.style === 'qa'
          ? `Giải đáp phản biện "${secTitle}" của "${title}":`
          : `Trình bày nội dung mục "${secTitle}" của "${title}":`);
      pushCard(`sec:${sIdx}:one:${_hashKey(secTitle)}`, {
        badge: secTitle.length > 30 ? `${secTitle.slice(0, 30)}...` : secTitle,
        subBadge: 'NGUYÊN LÝ / CẤU HÌNH',
        question: stylePrompt,
        answerText: content,
        images: imgs,
        answerHtml: renderCustomSectionsHtml([sec], `fcd-${kind}-${id}-${sIdx}`, tags),
      });
    }
  });

  // 4. Bảng chân khối hàm PLC (pinout_json)
  if (kind === 'plc' && Array.isArray(item.pinout_json)) {
    item.pinout_json.forEach((r, idx) => {
      if (!r.pin && !r.desc) return;
      pushCard(`pin:${_hashKey((r.pin || '') + '|' + (r.dtype || ''))}`, {
        badge: 'CHÂN KHỐI HÀM',
        subBadge: r.pin || `PIN ${idx + 1}`,
        question: `Trong khối hàm "${title}":\nChân / tham số [${r.pin || '---'}] thuộc chiều nào (IN/OUT), kiểu dữ liệu gì và có tác dụng gì?`,
        hint: r.dir ? `Chiều: ${r.dir}` : '',
        answerText: `${r.pin} (${r.dir || '-'}, ${r.dtype || '-'}): ${r.desc || ''}`,
        answerHtml: `<div class="tech-table-wrap"><table class="tech-table">
          <thead><tr><th>CHÂN</th><th>CHIỀU</th><th>KIỂU</th><th>MÔ TẢ CHỨC NĂNG</th></tr></thead>
          <tbody><tr><td class="pin-cell">${escapeHtml(r.pin)}</td><td><span class="dir-badge">${escapeHtml(r.dir || '—')}</span></td><td class="dtype-cell">${escapeHtml(r.dtype || '—')}</td><td>${escapeHtml(r.desc || '')}</td></tr></tbody>
        </table></div>`,
      });
    });
  }

  // 5. Bản đồ thanh ghi mạng truyền thông (register_map_json)
  if (kind === 'network' && Array.isArray(item.register_map_json)) {
    item.register_map_json.forEach((r, idx) => {
      if (!r.name && !r.address_hex && !r.value_desc) return;
      const addrStr = [r.address_hex, r.address_dec].filter(Boolean).join(' / ');
      pushCard(`reg:${_hashKey((r.name || '') + '|' + addrStr)}`, {
        badge: 'THANH GHI / TELEGRAM',
        subBadge: addrStr || `REG ${idx + 1}`,
        question: `Trong "${title}" (${item.protocol}):\nThanh ghi [${r.name || '---'}] có địa chỉ Hex/Dec là bao nhiêu và dùng để điều khiển / đọc giá trị nào?`,
        hint: r.address_hex ? `Hex: ${r.address_hex}` : '',
        answerText: `${r.name} [${addrStr}]: ${r.value_desc || ''}`,
        answerHtml: `<div class="tech-table-wrap"><table class="tech-table">
          <thead><tr><th>THANH GHI</th><th>HEX</th><th>DEC</th><th>Ý NGHĨA &amp; GIÁ TRỊ</th></tr></thead>
          <tbody><tr><td class="pin-cell">${escapeHtml(r.name)}</td><td class="hex-cell">${escapeHtml(r.address_hex || '—')}</td><td class="dtype-cell">${escapeHtml(r.address_dec || '—')}</td><td>${escapeHtml(r.value_desc || '')}</td></tr></tbody>
        </table></div>`,
      });
    });
  }

  return cards;
}

function _shuffledCopy(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function _buildQuizCardsForTargets(targets) {
  const ws = state.activeWorkspace || 'mrl';
  const cards = [];

  // Pool toàn phân hệ để lấy đáp án nhiễu hợp lý ngay cả khi đang ôn riêng 1 bài
  const allPlcPins = [];
  state.plcNotes.forEach((p) => (p.pinout_json || []).forEach((r) => {
    if (r.pin && r.desc) allPlcPins.push({ parent: p.title, pin: r.pin, dir: r.dir || '—', dtype: r.dtype || '—', desc: r.desc });
  }));
  const allNetRegs = [];
  state.networkNotes.forEach((n) => (n.register_map_json || []).forEach((r) => {
    if (r.name && (r.address_hex || r.address_dec || r.value_desc)) {
      allNetRegs.push({ parent: n.target_device, name: r.name, hex: r.address_hex || '—', dec: r.address_dec || '—', desc: r.value_desc || '' });
    }
  }));
  const allNamedTerms = [];
  targets.forEach(({ kind, item }) => {
    _getItemSections(kind, item).forEach((sec) => {
      if (sec.style === 'code') return;
      _extractBulletItems(sec.content || '').forEach((b) => {
        const p = _parseTermSplit(b);
        if (p.kind === 'colon' && p.term.length >= 3 && p.term.length <= 42 && !/^note$/i.test(p.term) && p.rest.length >= 12) {
          allNamedTerms.push({ id: item.id, secTitle: sec.title || '', term: p.term, rest: p.rest });
        }
      });
    });
  });

  const allRepairChoices = [];
  state.repairCases.forEach((rc) => {
    const cause = (rc.root_cause_raw || rc.steps?.[0]?.root_cause || '').trim();
    const sol = (rc.solution_raw || rc.steps?.[0]?.solution || '').trim();
    const ans = [cause ? `Nguyên nhân: ${cause}` : '', sol ? `Xử lý: ${sol}` : ''].filter(Boolean).join(' · ').trim();
    if (ans) allRepairChoices.push({ id: rc.id, text: ans.length > 180 ? `${ans.slice(0, 177)}...` : ans });
  });

  const allKnowledgeChoices = [];
  state.knowledgeItems.forEach((kn) => {
    const ans = (kn.key_takeaway || kn.actionable_application || kn.core_concept_workflow || '').trim();
    if (ans) allKnowledgeChoices.push({ id: kn.id, text: ans.length > 180 ? `${ans.slice(0, 177)}...` : ans });
  });

  const pickDistractors = (pool, correctLabel, labelFn, count = 3) => {
    const candidates = _shuffledCopy(pool.map(labelFn).filter((x) => x && x !== correctLabel));
    const unique = [];
    for (const c of candidates) {
      if (!unique.includes(c)) unique.push(c);
      if (unique.length >= count) break;
    }
    return unique;
  };

  targets.forEach(({ kind, item }) => {
    const title = _getItemTitle(kind, item);
    if (kind === 'repair' && allRepairChoices.length >= 3) {
      const sym = (item.fault_symptom_raw || item.steps?.[0]?.symptom || '').trim();
      const cause = (item.root_cause_raw || item.steps?.[0]?.root_cause || '').trim();
      const sol = (item.solution_raw || item.steps?.[0]?.solution || '').trim();
      const fullAns = [cause ? `Nguyên nhân: ${cause}` : '', sol ? `Xử lý: ${sol}` : ''].filter(Boolean).join(' · ').trim();
      if (sym && fullAns) {
        const correct = fullAns.length > 180 ? `${fullAns.slice(0, 177)}...` : fullAns;
        const distractors = pickDistractors(allRepairChoices.filter((x) => x.id !== item.id), correct, (x) => x.text);
        if (distractors.length >= 2) {
          const opts = _shuffledCopy([{ text: correct, ok: true }, ...distractors.map((d) => ({ text: d, ok: false }))]);
          cards.push({
            cardKey: `quiz:repair:${item.id}`,
            kind, id: item.id, item, ws, title,
            badge: 'TRẮC NGHIỆM CA SỬA', subBadge: categoryLabel(item.device_category),
            question: `Thiết bị "${title}" xuất hiện lỗi:\n"${sym}"\n→ Nguyên nhân gốc rễ & cách xử lý đúng là gì?`,
            answerText: fullAns,
            answerHtml: `<div class="note-block ans"><div class="nb-title">ĐÁP ÁN ĐÚNG · ${escapeHtml(item.id)}</div><div class="nb-body">${highlightTagsHtml(fullAns, item.component_tags, item.fault_codes)}</div></div>`,
            quiz: { options: opts.map((o) => o.text), correctIdx: opts.findIndex((o) => o.ok) },
          });
        }
      }
    }
    if (kind === 'knowledge' && allKnowledgeChoices.length >= 3) {
      const fullAns = (item.key_takeaway || item.actionable_application || item.core_concept_workflow || '').trim();
      if (fullAns) {
        const correct = fullAns.length > 180 ? `${fullAns.slice(0, 177)}...` : fullAns;
        const distractors = pickDistractors(allKnowledgeChoices.filter((x) => x.id !== item.id), correct, (x) => x.text);
        if (distractors.length >= 2) {
          const opts = _shuffledCopy([{ text: correct, ok: true }, ...distractors.map((d) => ({ text: d, ok: false }))]);
          const qPrompt = (item.why_question || '').trim()
            ? `Trong "${title}":\n${item.why_question.trim()}`
            : `Kiến thức cốt lõi / giải pháp thực chiến của chủ đề "${title}" là gì?`;
          cards.push({
            cardKey: `quiz:knw:${item.id}`,
            kind, id: item.id, item, ws, title,
            badge: 'TRẮC NGHIỆM KIẾN THỨC', subBadge: groupLabel(item.source_group),
            question: qPrompt,
            answerText: fullAns,
            answerHtml: `<div class="note-block ans"><div class="nb-title">ĐÁP ÁN ĐÚNG · ${escapeHtml(item.id)}</div><div class="nb-body">${highlightTagsHtml(fullAns, item.component_tags)}</div></div>`,
            quiz: { options: opts.map((o) => o.text), correctIdx: opts.findIndex((o) => o.ok) },
          });
        }
      }
    }
    if (kind === 'plc' && Array.isArray(item.pinout_json)) {
      item.pinout_json.forEach((r, idx) => {
        if (!r.pin || !r.desc) return;
        const correct = `${r.dir || '—'} · ${r.dtype || '—'} — ${r.desc}`;
        const distractors = pickDistractors(allPlcPins, correct, (x) => `${x.dir} · ${x.dtype} — ${x.desc}`);
        if (distractors.length < 2) return;
        const opts = _shuffledCopy([{ text: correct, ok: true }, ...distractors.map((d) => ({ text: d, ok: false }))]);
        cards.push({
          cardKey: `quiz:plc:${item.id}:pin:${_hashKey(r.pin + r.dtype)}`,
          kind, id: item.id, item, ws, title,
          badge: 'TRẮC NGHIỆM CHÂN PLC', subBadge: r.pin,
          question: `Trong "${title}", chân [${r.pin}] có đặc tính & chức năng nào sau đây?`,
          answerText: `${r.pin}: ${correct}`,
          answerHtml: `<div class="note-block ans"><div class="nb-title">ĐÁP ÁN ĐÚNG · ${escapeHtml(r.pin)}</div><div class="nb-body">${escapeHtml(correct)}</div></div>`,
          quiz: { options: opts.map((o) => o.text), correctIdx: opts.findIndex((o) => o.ok) },
        });
      });
    }
    if (kind === 'network' && Array.isArray(item.register_map_json)) {
      item.register_map_json.forEach((r, idx) => {
        if (!r.name || !(r.address_hex || r.address_dec || r.value_desc)) return;
        const addr = [r.address_hex, r.address_dec].filter(Boolean).join(' / ');
        const correct = `${addr ? `[${addr}] ` : ''}${r.value_desc || ''}`.trim();
        const distractors = pickDistractors(allNetRegs, correct, (x) => `${[x.hex, x.dec].filter((v) => v && v !== '—').length ? `[${[x.hex, x.dec].filter((v) => v && v !== '—').join(' / ')}] ` : ''}${x.desc}`.trim());
        if (distractors.length < 2) return;
        const opts = _shuffledCopy([{ text: correct, ok: true }, ...distractors.map((d) => ({ text: d, ok: false }))]);
        cards.push({
          cardKey: `quiz:net:${item.id}:reg:${_hashKey(r.name + addr)}`,
          kind, id: item.id, item, ws, title,
          badge: 'TRẮC NGHIỆM THANH GHI', subBadge: r.name,
          question: `Trong "${title}" (${item.protocol}), thanh ghi [${r.name}] tương ứng địa chỉ & ý nghĩa nào?`,
          answerText: `${r.name}: ${correct}`,
          answerHtml: `<div class="note-block ans"><div class="nb-title">ĐÁP ÁN ĐÚNG · ${escapeHtml(r.name)}</div><div class="nb-body">${escapeHtml(correct)}</div></div>`,
          quiz: { options: opts.map((o) => o.text), correctIdx: opts.findIndex((o) => o.ok) },
        });
      });
    }
    if (allNamedTerms.length >= 4) {
      _getItemSections(kind, item).forEach((sec, sIdx) => {
        if (sec.style === 'code') return;
        _extractBulletItems(sec.content || '').forEach((b) => {
          const p = _parseTermSplit(b);
          if (p.kind !== 'colon' || p.term.length < 3 || p.term.length > 42 || /^note$/i.test(p.term) || p.rest.length < 12) return;
          const distractors = pickDistractors(allNamedTerms, p.term, (x) => x.term);
          if (distractors.length < 2) return;
          const opts = _shuffledCopy([{ text: p.term, ok: true }, ...distractors.map((d) => ({ text: d, ok: false }))]);
          cards.push({
            cardKey: `quiz:${kind}:${item.id}:term:${_hashKey(sec.title + p.term)}`,
            kind, id: item.id, item, ws, title,
            badge: 'TRẮC NGHIỆM KHÁI NIỆM', subBadge: sec.title || '',
            question: `Trong "${title}", thành phần / khối nào đảm nhiệm vai trò sau?\n"${p.rest}"`,
            answerText: `${p.term}: ${p.rest}`,
            answerHtml: `<div class="note-block ans"><div class="nb-title">ĐÁP ÁN ĐÚNG · ${escapeHtml(p.term)}</div><div class="nb-body">${escapeHtml(p.rest)}</div></div>`,
            quiz: { options: opts.map((o) => o.text), correctIdx: opts.findIndex((o) => o.ok) },
          });
        });
      });
    }
  });
  return cards;
}

function _buildSummaryCard(kind, item) {
  return {
    cardKey: `summary:${kind}:${item.id}`,
    kind,
    id: item.id,
    item,
    ws: _wsForItemKind(kind),
    title: _getItemTitle(kind, item),
    isSummary: true,
    quiz: null,
  };
}

function _getItemDrillStats(kind, itemOrId) {
  if (kind === 'en_vocab') return { total: 0, solid: 0, fuzzy: 0, forgot: 0 };
  const item = typeof itemOrId === 'string' ? _findRecordByKindId(kind, itemOrId) : itemOrId;
  const cards = _buildDeepCardsForItem(kind, item);
  let solid = 0, fuzzy = 0, forgot = 0;
  cards.forEach((c) => {
    const st = state.reviewProgress?.[c.cardKey]?.rating;
    if (st === 'solid') solid += 1;
    else if (st === 'fuzzy') fuzzy += 1;
    else if (st === 'forgot') forgot += 1;
  });
  return { total: cards.length, solid, fuzzy, forgot };
}

function onFlashcardModeChange() {
  const modeSel = document.getElementById('fc-mode-filter');
  state.flashcard.mode = modeSel?.value || 'deep';
  buildFlashcardDeck(false);
}

function toggleFlashcardUnsolidFilter() {
  state.flashcard.unsolidOnly = !state.flashcard.unsolidOnly;
  document.getElementById('fc-unsolid-btn')?.classList.toggle('split-on', state.flashcard.unsolidOnly);
  buildFlashcardDeck(false);
}

function toggleFlashcardDraftBox() {
  state.flashcard.showDraftBox = !state.flashcard.showDraftBox;
  document.getElementById('fc-draft-toggle-btn')?.classList.toggle('split-on', state.flashcard.showDraftBox);
  renderFlashcardStage();
}

function startDrillForItem(kind, id) {
  const ws = _wsForItemKind(kind);
  state.flashcard.focusItem = { kind, id };
  if (state.flashcard.mode === 'summary') state.flashcard.mode = 'deep';
  const modeSel = document.getElementById('fc-mode-filter');
  if (modeSel) modeSel.value = state.flashcard.mode;
  const sf = document.getElementById('fc-status-filter');
  if (sf) sf.value = 'ALL';
  enterWorkspace(ws, 'flashcards', { keepFocusItem: true });
}

function startDrillForCategory(scope, key) {
  const ws = (scope === 'plc' || scope === 'network' || scope === 'english') ? scope : 'mrl';
  state.flashcard.focusItem = null;
  if (ws === 'english') {
    state.flashcard.mode = 'en_vocab';
  } else if (state.flashcard.mode === 'summary') {
    state.flashcard.mode = 'deep';
  }
  const modeSel = document.getElementById('fc-mode-filter');
  if (modeSel) modeSel.value = state.flashcard.mode;
  enterWorkspace(ws, 'flashcards');
  const sf = document.getElementById('fc-status-filter');
  if (sf) sf.value = 'ALL';
  const tf = document.getElementById('fc-type-filter');
  if (tf) {
    let targetVal = 'ALL';
    if (key && key !== 'ALL') {
      if (scope === 'repair') targetVal = `repair_cat:${key}`;
      else if (scope === 'knowledge') targetVal = `knowledge_grp:${key}`;
      else targetVal = key;
    }
    tf.value = Array.from(tf.options).some((o) => o.value === targetVal) ? targetVal : 'ALL';
    tf.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    buildFlashcardDeck(false);
  }
}

function clearFlashcardItemScope() {
  state.flashcard.focusItem = null;
  const sf = document.getElementById('fc-status-filter');
  if (sf && sf.value === 'ALL') sf.value = 'ACTIVE';
  buildFlashcardDeck(false);
}

function buildFlashcardDeck(keepIndex = false) {
  const ws = state.activeWorkspace || 'mrl';
  const sf = document.getElementById('fc-status-filter')?.value || 'ACTIVE';
  const tf = document.getElementById('fc-type-filter')?.value || 'ALL';
  const mode = state.flashcard.mode || document.getElementById('fc-mode-filter')?.value || 'deep';
  state.flashcard.mode = mode;

  const modeSel = document.getElementById('fc-mode-filter');
  if (modeSel && modeSel.value !== mode) modeSel.value = mode;
  document.getElementById('fc-unsolid-btn')?.classList.toggle('split-on', !!state.flashcard.unsolidOnly);
  document.getElementById('fc-draft-toggle-btn')?.classList.toggle('split-on', !!state.flashcard.showDraftBox);

  const scopeBadge = document.getElementById('fc-item-scope-badge');

  if (mode === 'en_vocab' || mode === 'en_quiz') {
    if (scopeBadge) scopeBadge.classList.add('hidden');
    let enDeck = typeof buildEnVocabFlashcards === 'function' ? buildEnVocabFlashcards(mode, ws, tf, sf) : [];
    if (state.flashcard.unsolidOnly) {
      enDeck = enDeck.filter((c) => state.reviewProgress?.[c.cardKey]?.rating !== 'solid');
    }
    state.flashcard.deck = enDeck;
    if (!keepIndex || state.flashcard.index >= enDeck.length) state.flashcard.index = 0;
    state.flashcard.flipped = false;
    state.flashcard.showHint = false;
    state.flashcard.showContext = false;
    renderFlashcardStage();
    return;
  }

  const fi = state.flashcard.focusItem;
  const targets = [];

  if (fi && _wsForItemKind(fi.kind) === ws) {
    const rec = _findRecordByKindId(fi.kind, fi.id);
    if (rec) targets.push({ kind: fi.kind, item: rec });
    if (scopeBadge) {
      scopeBadge.classList.remove('hidden');
      scopeBadge.innerHTML = `ÔN RIÊNG: ${escapeHtml(fi.id)} <button type="button" onclick="clearFlashcardItemScope()" title="Quay lại ôn tất cả bài">×</button>`;
    }
  } else {
    if (scopeBadge) scopeBadge.classList.add('hidden');
    const ok = (code) => {
      if (sf === 'ALL') return true;
      return sf === 'ACTIVE' ? (code === 'review' || code === 'researching') : code === sf;
    };
    if (ws === 'mrl') {
      if (tf.startsWith('repair_cat:')) {
        const catKey = tf.slice(11);
        state.repairCases.forEach((c) => { if (c.device_category === catKey && ok(c.status_code)) targets.push({ kind: 'repair', item: c }); });
      } else if (tf.startsWith('knowledge_grp:')) {
        const grpKey = tf.slice(14);
        state.knowledgeItems.forEach((k) => { if (k.source_group === grpKey && ok(k.status_code)) targets.push({ kind: 'knowledge', item: k }); });
      } else {
        if (tf === 'ALL' || tf === 'repair') state.repairCases.forEach((c) => { if (ok(c.status_code)) targets.push({ kind: 'repair', item: c }); });
        if (tf === 'ALL' || tf === 'knowledge') state.knowledgeItems.forEach((k) => { if (ok(k.status_code)) targets.push({ kind: 'knowledge', item: k }); });
      }
    } else if (ws === 'plc') {
      state.plcNotes.forEach((p) => { if ((tf === 'ALL' || p.category === tf) && ok(p.status_code)) targets.push({ kind: 'plc', item: p }); });
    } else if (ws === 'network') {
      state.networkNotes.forEach((n) => { if ((tf === 'ALL' || n.protocol === tf) && ok(n.status_code)) targets.push({ kind: 'network', item: n }); });
    }
  }

  let deck = [];
  if (mode === 'summary') {
    deck = targets.map(({ kind, item }) => _buildSummaryCard(kind, item));
  } else if (mode === 'quiz') {
    deck = _buildQuizCardsForTargets(targets);
  } else {
    targets.forEach(({ kind, item }) => {
      const subCards = _buildDeepCardsForItem(kind, item);
      if (subCards.length) deck.push(...subCards);
      else deck.push(_buildSummaryCard(kind, item));
    });
  }

  if (state.flashcard.unsolidOnly) {
    deck = deck.filter((c) => state.reviewProgress?.[c.cardKey]?.rating !== 'solid');
  }

  state.flashcard.deck = deck;
  if (!keepIndex || state.flashcard.index >= deck.length) state.flashcard.index = 0;
  state.flashcard.flipped = false;
  state.flashcard.showHint = false;
  state.flashcard.showContext = false;
  renderFlashcardStage();
}

function shuffleFlashcardDeck() {
  state.flashcard.deck = _shuffledCopy(state.flashcard.deck);
  state.flashcard.index = 0;
  state.flashcard.flipped = false;
  state.flashcard.showHint = false;
  state.flashcard.showContext = false;
  renderFlashcardStage();
  showToast('Đã trộn lại bộ câu hỏi');
}

function flipFlashcard() {
  const card = state.flashcard.deck[state.flashcard.index];
  if (card?.quiz) return;
  state.flashcard.flipped = !state.flashcard.flipped;
  renderFlashcardStage();
}

function moveFlashcard(d) {
  const n = state.flashcard.deck.length;
  if (!n) return;
  state.flashcard.index = (state.flashcard.index + d + n) % n;
  state.flashcard.flipped = false;
  state.flashcard.showHint = false;
  state.flashcard.showContext = false;
  renderFlashcardStage();
}

function toggleFlashcardHint() { state.flashcard.showHint = !state.flashcard.showHint; renderFlashcardStage(); }
function toggleFlashcardContext() { state.flashcard.showContext = !state.flashcard.showContext; renderFlashcardStage(); }

function onFlashcardDraftInput(val) {
  const card = state.flashcard.deck[state.flashcard.index];
  if (card) state.flashcard.drafts[card.cardKey] = val;
}

function onFlashcardDraftKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    flipFlashcard();
  }
}

async function saveCardProgress(card, rating) {
  const prev = state.reviewProgress[card.cardKey];
  state.reviewProgress[card.cardKey] = {
    card_key: card.cardKey,
    item_kind: card.kind,
    item_id: card.id,
    rating,
    attempts: (prev?.attempts || 0) + 1,
    correct_streak: rating === 'solid' ? ((prev?.correct_streak || 0) + 1) : 0,
  };
  try {
    const res = await fetch('/api/review-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_key: card.cardKey, item_kind: card.kind, item_id: card.id, rating }),
    });
    if (res.ok) {
      state.reviewProgress[card.cardKey] = await res.json();
    }
  } catch (err) {
    console.error(err);
  }
}

async function selectQuizOption(optIdx) {
  const card = state.flashcard.deck[state.flashcard.index];
  if (!card?.quiz) return;
  if (state.flashcard.quizAnswers[card.cardKey] !== undefined) return;
  state.flashcard.quizAnswers[card.cardKey] = optIdx;
  const isCorrect = optIdx === card.quiz.correctIdx;
  await saveCardProgress(card, isCorrect ? 'solid' : 'forgot');
  renderFlashcardStage();
}

async function rateCurrentCard(rating) {
  const deck = state.flashcard.deck;
  const idx = state.flashcard.index;
  const card = deck[idx];
  if (!card) return;
  await saveCardProgress(card, rating);

  if (rating === 'forgot') {
    const requeuePos = Math.min(deck.length, idx + 4);
    const alreadySoon = deck.slice(idx + 1, requeuePos + 1).some((c) => c.cardKey === card.cardKey);
    if (!alreadySoon && deck.length > 1) {
      deck.splice(requeuePos, 0, { ...card, _requeued: true });
    }
    showToast('🔴 Đã ghi nhận Quên — sẽ hỏi lại sau 3 thẻ để ép nhớ!', 'info');
  } else if (rating === 'fuzzy') {
    showToast('🟡 Nhớ mờ — giữ trong danh sách cần ôn');
  } else {
    showToast('🟢 Thuộc chắc!', 'success');
  }

  if (state.flashcard.unsolidOnly && rating === 'solid') {
    deck.splice(idx, 1);
    if (state.flashcard.index >= deck.length) state.flashcard.index = Math.max(0, deck.length - 1);
    state.flashcard.flipped = false;
    state.flashcard.showHint = false;
    state.flashcard.showContext = false;
    renderFlashcardStage();
    return;
  }

  if (idx + 1 < deck.length) {
    moveFlashcard(1);
  } else {
    state.flashcard.flipped = true;
    renderFlashcardStage();
  }
}

async function resetItemDrillProgress(kind, id) {
  try {
    await fetch(`/api/review-progress?item_kind=${encodeURIComponent(kind)}&item_id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    Object.keys(state.reviewProgress).forEach((k) => {
      if (state.reviewProgress[k]?.item_kind === kind && state.reviewProgress[k]?.item_id === id) {
        delete state.reviewProgress[k];
      }
    });
    showToast(`Đã reset tiến độ ôn tập của ${id}`, 'success');
    buildFlashcardDeck(false);
  } catch (err) {
    showToast('Reset tiến độ thất bại', 'error');
  }
}

function openFlashcardSourceRecord(kind, id) {
  if (kind === 'plc') jumpToPlcNote(id);
  else if (kind === 'network') jumpToNetworkNote(id);
  else if (kind === 'knowledge') jumpToKnowledgeItem(id);
  else if (kind === 'repair') jumpToRepairCase(id);
}

async function markFlashcardMastered(kind, id) { await quickUpdateStatus(kind, id, 'mastered'); }

function _renderSummaryFlashcard(card, flipped) {
  if (card.kind === 'repair') {
    const c = card.item;
    const steps = c.steps && c.steps.length ? c.steps : [{ step_order: 1, symptom: c.fault_symptom_raw, root_cause: c.root_cause_raw, solution: c.solution_raw }];
    const front = `
      <div class="d-meta"><span class="d-id">${escapeHtml(c.id)}</span><span>CA SỬA CHỮA</span><span>${escapeHtml(categoryLabel(c.device_category))}</span>${ledHtml(c.status_code)}</div>
      <div class="d-title">${escapeHtml(c.brand_model)}</div>
      <div class="note-block accent"><div class="nb-title">HIỆN TƯỢNG / MÃ LỖI QUAN SÁT</div><div class="nb-body">${escapeHtml(c.fault_symptom_raw || 'Chưa có mô tả triệu chứng')}</div>
        ${c.fault_codes?.length ? `<div class="tags" style="margin-top:8px;">${renderTagPills([], c.fault_codes)}</div>` : ''}</div>
      ${!flipped ? `<div class="fc-hidden">NGUYÊN NHÂN &amp; CÁCH XỬ LÝ ĐANG ẨN — tự chẩn đoán trước khi lật thẻ</div>` : ''}`;
    const back = `<div class="fc-answer stack">
      ${c.note ? `<div class="warn"><div class="warn-title"><span>LƯU Ý CẤP NGUỒN TEST &amp; CẤU HÌNH VẬN HÀNH</span></div><div class="warn-body">${highlightTagsHtml(c.note, c.component_tags, c.fault_codes)}</div></div>` : ''}
      <div class="trace">${steps.map((st, i) => `<div class="step"><div class="step-head">BƯỚC ${pad2(st.step_order || i + 1)}</div><div class="spec">
        ${specRow('cause', 'Nguyên nhân gốc rễ', st.root_cause, c)}${specRow('sol', 'Cách xử lý & Linh kiện', st.solution, c)}</div></div>`).join('')}</div>
      ${c.component_tags?.length ? `<div class="tags">${renderTagPills(c.component_tags, [])}</div>` : ''}</div>`;
    return { front, back };
  }
  if (card.kind === 'plc') {
    const p = card.item;
    const secs = _getItemSections('plc', p);
    const pinRows = p.pinout_json || [];
    const pinTableHtml = pinRows.length
      ? `<div class="sec"><div class="sec-head"><span class="sec-title">THÔNG SỐ CHÂN KHỐI HÀM (PINOUT &amp; PARAMETERS)<span class="c">${pad2(pinRows.length)}</span></span></div>
          <div class="tech-table-wrap"><table class="tech-table">
            <thead><tr><th>CHÂN / THAM SỐ</th><th>CHIỀU</th><th>KIỂU DỮ LIỆU</th><th>MÔ TẢ CHỨC NĂNG</th></tr></thead>
            <tbody>${pinRows.map((r) => `
              <tr>
                <td class="pin-cell">${escapeHtml(r.pin)}</td>
                <td><span class="dir-badge">${escapeHtml(r.dir || '—')}</span></td>
                <td class="dtype-cell">${escapeHtml(r.dtype || '—')}</td>
                <td>${escapeHtml(r.desc || '')}</td>
              </tr>`).join('')}</tbody></table></div></div>`
      : '';
    const front = `
      <div class="d-meta"><span class="d-id">${escapeHtml(p.id)}</span><span>LẬP TRÌNH PLC</span><span>${escapeHtml((p.category || '').toUpperCase())}</span>${ledHtml(p.status_code)}</div>
      <div class="d-title">${escapeHtml(p.title)}</div>
      <div class="note-block accent"><div class="nb-title">${escapeHtml(p.plc_brand_platform || 'PLC SYSTEM')}</div>
        <div class="nb-body">${p.interview_qa ? escapeHtml(p.interview_qa.split('\n')[0]) : 'Hãy trình bày bản chất nguyên lý, các chân/vùng nhớ chính và các lưu ý quan trọng.'}</div></div>
      ${!flipped ? `<div class="fc-hidden">NỘI DUNG ĐÁP ÁN ĐANG ẨN — tự trả lời trước khi lật thẻ</div>` : ''}`;
    const back = `<div class="fc-answer stack">
      ${renderCustomSectionsHtml(secs, `fc-plc:${p.id}`, p.tags || [])}
      ${pinTableHtml}
      ${p.tags?.length ? `<div class="tags">${renderTagChipsPlain(p.tags)}</div>` : ''}</div>`;
    return { front, back };
  }
  if (card.kind === 'network') {
    const n = card.item;
    const secs = _getItemSections('network', n);
    const regs = n.register_map_json || [];
    const regTableHtml = regs.length
      ? `<div class="sec"><div class="sec-head"><span class="sec-title">BẢN ĐỒ THANH GHI &amp; KHUNG TRUYỀN (REGISTER MAP / TELEGRAM)<span class="c">${pad2(regs.length)}</span></span></div>
          <div class="tech-table-wrap"><table class="tech-table">
            <thead><tr><th>TÊN THANH GHI / LỆNH</th><th>ĐỊA CHỈ HEX</th><th>ĐỊA CHỈ DEC</th><th>Ý NGHĨA &amp; GIÁ TRỊ</th></tr></thead>
            <tbody>${regs.map((r) => `
              <tr>
                <td class="pin-cell">${escapeHtml(r.name)}</td>
                <td class="hex-cell">${escapeHtml(r.address_hex || '—')}</td>
                <td class="dtype-cell">${escapeHtml(r.address_dec || '—')}</td>
                <td>${escapeHtml(r.value_desc || '')}</td>
              </tr>`).join('')}</tbody></table></div></div>`
      : '';
    const front = `
      <div class="d-meta"><span class="d-id">${escapeHtml(n.id)}</span><span>MẠNG TRUYỀN THÔNG</span><span>${escapeHtml(n.protocol.toUpperCase())}</span>${ledHtml(n.status_code)}</div>
      <div class="d-title">${escapeHtml(n.target_device)}</div>
      <div class="note-block accent"><div class="nb-title">GỢI Ý ÔN TẬP GIAO THỨC ${escapeHtml(n.protocol)}</div>
        <div class="nb-body">Hãy trình bày sơ đồ đấu dây, thông số cấu hình, khung truyền / thanh ghi và cách bắt lỗi mất kết nối.</div></div>
      ${!flipped ? `<div class="fc-hidden">NỘI DUNG ĐÁP ÁN ĐANG ẨN — tự trả lời trước khi lật thẻ</div>` : ''}`;
    const back = `<div class="fc-answer stack">
      ${renderCustomSectionsHtml(secs, `fc-net:${n.id}`, n.tags || [])}
      ${regTableHtml}
      ${n.tags?.length ? `<div class="tags">${renderTagChipsPlain(n.tags)}</div>` : ''}</div>`;
    return { front, back };
  }
  const k = card.item;
  const front = `
    <div class="d-meta"><span class="d-id">${escapeHtml(k.id)}</span><span>KIẾN THỨC / SOP</span><span>${escapeHtml(groupLabel(k.source_group))}</span>${ledHtml(k.status_code)}</div>
    <div class="d-title">${escapeHtml(k.topic_model)}</div>
    <div class="note-block ${k.why_question ? 'why' : 'accent'}"><div class="nb-title">${k.why_question ? 'CÂU HỎI PHẢN BIỆN (TẠI SAO?)' : 'TỪ KHÓA LÕI'}</div>
      <div class="nb-body">${escapeHtml(k.why_question || k.key_takeaway || 'Trình bày bản chất nguyên lý và quy trình của chủ đề này.')}</div></div>
    ${!flipped ? `<div class="fc-hidden">NỘI DUNG ĐÁP ÁN ĐANG ẨN — tự trả lời trước khi lật thẻ</div>` : ''}`;
  const back = `<div class="fc-answer stack">
    ${k.key_takeaway && k.why_question ? `<div class="note-block accent"><div class="nb-title">TỪ KHÓA LÕI</div><div class="nb-body">${highlightTagsHtml(k.key_takeaway, k.component_tags)}</div></div>` : ''}
    ${k.core_concept_workflow ? `<div class="note-block"><div class="nb-title">BẢN CHẤT NGUYÊN LÝ / QUY TRÌNH SOP</div><div class="nb-body">${highlightTagsHtml(k.core_concept_workflow, k.component_tags)}</div></div>` : ''}
    ${k.actionable_application ? `<div class="note-block ans"><div class="nb-title">TRẢ LỜI THỰC CHIẾN &amp; GIẢI PHÁP</div><div class="nb-body">${highlightTagsHtml(k.actionable_application, k.component_tags)}</div></div>` : ''}
    ${k.note ? `<div class="warn safety"><div class="warn-title"><span>LƯU Ý AN TOÀN</span></div><div class="warn-body">${highlightTagsHtml(k.note, k.component_tags)}</div></div>` : ''}
    ${renderCustomSectionsHtml(k.custom_sections_json || [], `fc-knw:${k.id}`, k.component_tags || [])}
    ${k.component_tags?.length ? `<div class="tags">${renderTagPills(k.component_tags, [])}</div>` : ''}</div>`;
  return { front, back };
}

function renderFlashcardStage() {
  const deck = state.flashcard.deck;
  const ws = state.activeWorkspace || 'mrl';
  const stats = computeWorkspaceStats();
  const wsStat = stats[ws] || stats.mrl;
  const mode = state.flashcard.mode || 'deep';

  let solidCount = 0;
  deck.forEach((c) => { if (state.reviewProgress?.[c.cardKey]?.rating === 'solid') solidCount += 1; });
  document.getElementById('fc-progress-summary').innerHTML =
    `CÂU HỎI <b style="color:var(--amber);">${deck.length}</b> · THUỘC <b style="color:var(--green);">${solidCount}/${deck.length}</b> · BÀI LÀM CHỦ <b style="color:var(--text-2);">${wsStat.mastered}/${wsStat.total}</b>`;

  const stage = document.getElementById('flashcard-stage');
  if (!deck.length) {
    const emptyMsg = mode === 'quiz'
      ? 'Chưa đủ dữ liệu Bảng chân / Thanh ghi / Mục có dấu ":" (tối thiểu 4 mục) để tạo câu trắc nghiệm 4 đáp án.'
      : (state.flashcard.unsolidOnly
        ? 'Bạn đã đánh dấu THUỘC CHẮC tất cả câu hỏi trong bộ lọc này!'
        : 'Không còn thẻ nào ở bộ lọc hiện tại.');
    stage.innerHTML = `<div class="fc-card" style="text-align:center;padding:54px 20px;">
      <div class="mono" style="color:var(--green);font-size:13px;letter-spacing:.1em;">TRỐNG / HOÀN TẤT ÔN TẬP</div>
      <div style="color:var(--text-3);margin-top:8px;">${emptyMsg}</div>
      ${state.flashcard.focusItem ? `<button type="button" class="btn btn-sm" style="margin-top:14px;" onclick="clearFlashcardItemScope()">Quay lại toàn bộ bài</button>` : ''}
    </div>`;
    return;
  }

  const card = deck[state.flashcard.index] || deck[0];
  const flipped = state.flashcard.flipped;
  const pct = Math.round(((state.flashcard.index + 1) / deck.length) * 100);
  const recStats = _getItemDrillStats(card.kind, card.item || card.id);
  const savedRating = state.reviewProgress?.[card.cardKey]?.rating || '';
  const lvlClass = savedRating ? `lvl-${savedRating}` : 'lvl-new';
  const lvlText = savedRating === 'solid' ? '🟢 THUỘC CHẮC' : (savedRating === 'fuzzy' ? '🟡 NHỚ MỜ' : (savedRating === 'forgot' ? '🔴 CẦN NHỚ LẠI' : '⚪ CHƯA ÔN'));

  let bodyHtml = '';
  let controlsRightHtml = '';

  if (card.isSummary) {
    const { front, back } = _renderSummaryFlashcard(card, flipped);
    bodyHtml = `<div class="stack">${front}</div>${flipped ? back : ''}`;
    controlsRightHtml = `
      <button type="button" class="btn btn-primary" onclick="flipFlashcard()">${flipped ? 'Ẩn đáp án' : 'Lật thẻ / Xem đáp án'}</button>
      ${flipped ? `<button type="button" class="btn btn-green" onclick="markFlashcardMastered('${card.kind}', '${escapeHtml(card.id)}')">Đánh dấu đã làm chủ</button>` : ''}`;
  } else if (card.quiz) {
    const chosen = state.flashcard.quizAnswers[card.cardKey];
    const answered = chosen !== undefined;
    const keys = ['A', 'B', 'C', 'D'];
    bodyHtml = `
      <div class="stack">
        <div class="fc-breadcrumbs">
          <span class="d-id">${escapeHtml(card.id)}</span>
          <span class="fc-kind-pill">${escapeHtml(card.badge)}</span>
          ${card.subBadge ? `<span class="mono" style="font-size:12px;color:var(--text-2);">${escapeHtml(card.subBadge)}</span>` : ''}
          <span class="fc-lvl-pill ${lvlClass}">${lvlText}</span>
        </div>
        <div class="d-title">${escapeHtml(card.title)}</div>
        <div class="fc-question-box">
          <div class="fc-question-head"><span>CÂU HỎI TRẮC NGHIỆM (CHỌN A/B/C/D HOẶC PHÍM 1-4)</span></div>
          <div class="fc-question-text">${escapeHtml(card.question)}</div>
        </div>
        <div class="fc-quiz-opts">
          ${card.quiz.options.map((opt, idx) => {
            let cls = '';
            if (answered) {
              if (idx === card.quiz.correctIdx) cls = 'is-correct';
              else if (idx === chosen) cls = 'is-wrong';
            }
            return `<button type="button" class="fc-quiz-opt ${cls}" ${answered ? 'disabled' : ''} onclick="selectQuizOption(${idx})">
              <span class="q-key">${keys[idx]}</span><span>${escapeHtml(opt)}</span>
            </button>`;
          }).join('')}
        </div>
        ${answered ? `<div class="fc-answer">${card.answerHtml}</div>` : ''}
      </div>`;
    const audioBtnHtml = card.enAudioText
      ? `<button type="button" class="btn btn-sm" data-speak="${escapeHtml(card.enAudioText)}" onclick="speakEnglishText(this.dataset.speak)">🔊 Nghe EN</button>`
      : '';
    const srcBtnHtml = card.kind === 'en_vocab'
      ? `<button type="button" class="btn btn-sm" onclick="openVocabModal()">⭐ Sổ Từ Vựng</button>`
      : `<button type="button" class="btn btn-sm" onclick="openFlashcardSourceRecord('${card.kind}', '${escapeHtml(card.id)}')">Mở bài gốc ↗</button>`;
    controlsRightHtml = `${audioBtnHtml}${srcBtnHtml}`;
  } else {
    const draftVal = state.flashcard.drafts[card.cardKey] || '';
    const useCompare = flipped && (state.flashcard.showDraftBox || draftVal.trim().length > 0);
    const contextBlock = card.contextHtml && state.flashcard.showContext
      ? `<div class="fc-context-box"><div class="mono" style="font-size:12px;color:var(--amber);margin-bottom:6px;">${escapeHtml(card.contextTitle || 'NGỮ CẢNH GỐC')}</div>${card.contextHtml}</div>`
      : '';

    const draftSection = !flipped && state.flashcard.showDraftBox
      ? `<div class="fc-draft-wrap">
           <div class="fc-draft-head">
             <span>TỰ GÕ CÂU TRẢ LỜI ĐỂ ĐỐI CHIẾU KHI LẬT THẺ</span>
             <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> lật nhanh</span>
           </div>
           <textarea id="fc-user-draft" class="fc-draft-input" spellcheck="false" placeholder="Gõ nhanh những gì bạn nhớ được (hoặc tự nhẩm rồi bấm Lật thẻ)...">${escapeHtml(draftVal)}</textarea>
         </div>`
      : (!flipped ? `<div class="fc-hidden">ĐÁP ÁN CHUẨN ĐANG ẨN — tự trả lời rồi bấm <kbd>Space</kbd> để đối chiếu</div>` : '');

    const answerContent = useCompare
      ? `<div class="fc-compare">
           <div class="fc-compare-col">
             <div class="fc-compare-lbl">CÂU TRẢ LỜI BẠN TỰ NHỚ</div>
             <div class="fc-user-text">${draftVal.trim() ? escapeHtml(draftVal) : '<span style="color:var(--text-3);">(Bạn chưa gõ nháp — tự đối chiếu nhẩm với đáp án bên phải)</span>'}</div>
           </div>
           <div class="fc-compare-col ref-col">
             <div class="fc-compare-lbl">ĐÁP ÁN CHUẨN TRONG BÀI</div>
             ${card.answerHtml}
           </div>
         </div>`
      : `<div class="stack">${card.answerHtml}</div>`;

    const promoteBanner = flipped && recStats.total > 0 && recStats.solid === recStats.total && card.item?.status_code !== 'mastered'
      ? `<div class="fc-promote-banner">
           <span>🎉 Bạn đã <b>THUỘC CHẮC ${recStats.solid}/${recStats.total}</b> câu hỏi của <b>${escapeHtml(card.id)}</b>!</span>
           <button type="button" class="btn btn-sm btn-green" onclick="markFlashcardMastered('${card.kind}', '${escapeHtml(card.id)}')">Đánh dấu ${escapeHtml(card.id)} ĐÃ LÀM CHỦ</button>
         </div>`
      : '';

    bodyHtml = `
      <div class="stack">
        <div class="fc-breadcrumbs">
          <span class="d-id">${escapeHtml(card.id)}</span>
          ${card._requeued ? `<span class="fc-kind-pill" style="border-color:var(--red);color:#F87171;">LẶP LẠI VÌ QUÊN</span>` : ''}
          <span class="fc-kind-pill">${escapeHtml(card.badge)}</span>
          ${card.subBadge ? `<span class="mono" style="font-size:12px;color:var(--text-2);">${escapeHtml(card.subBadge)}</span>` : ''}
          <span class="mono" style="font-size:12px;color:var(--text-3);">Bài này: ${recStats.solid}/${recStats.total} thuộc</span>
          <span class="fc-lvl-pill ${lvlClass}">${lvlText}</span>
        </div>
        <div class="d-title">${escapeHtml(card.title)}</div>
        <div class="fc-question-box">
          <div class="fc-question-head">
            <span>CÂU HỎI KIỂM TRA TRÍ NHỚ</span>
            ${card.hint ? `<button type="button" class="btn btn-sm" style="padding:2px 7px;font-size:12px;" onclick="toggleFlashcardHint()">${state.flashcard.showHint ? 'Ẩn gợi ý' : 'Gợi ý'}</button>` : ''}
          </div>
          <div class="fc-question-text">${escapeHtml(card.question)}</div>
          ${card.hint && state.flashcard.showHint ? `<div class="fc-hint-box">💡 Gợi ý: ${escapeHtml(card.hint)}</div>` : ''}
        </div>
        ${draftSection}
        ${flipped ? `
          <div class="fc-answer stack">
            ${answerContent}
            ${card.contextHtml ? `<div><button type="button" class="btn btn-sm" onclick="toggleFlashcardContext()">${state.flashcard.showContext ? '▾ Ẩn toàn bộ mục gốc' : '▸ Xem toàn bộ mục gốc'}</button>${contextBlock}</div>` : ''}
            <div class="fc-rate-bar">
              <span class="fc-rate-lbl">CHẤM MỨC ĐỘ NHỚ:</span>
              <button type="button" class="fc-rate-btn rate-forgot ${savedRating === 'forgot' ? 'active' : ''}" onclick="rateCurrentCard('forgot')">🔴 Quên · Hỏi lại [1]</button>
              <button type="button" class="fc-rate-btn rate-fuzzy ${savedRating === 'fuzzy' ? 'active' : ''}" onclick="rateCurrentCard('fuzzy')">🟡 Nhớ mờ [2]</button>
              <button type="button" class="fc-rate-btn rate-solid ${savedRating === 'solid' ? 'active' : ''}" onclick="rateCurrentCard('solid')">🟢 Thuộc chắc [3]</button>
            </div>
            ${promoteBanner}
          </div>` : ''}
      </div>`;

    const audioBtnHtml = card.enAudioText
      ? `<button type="button" class="btn btn-sm" data-speak="${escapeHtml(card.enAudioText)}" onclick="speakEnglishText(this.dataset.speak)">🔊 Nghe EN</button>`
      : '';
    const srcBtnHtml = card.kind === 'en_vocab'
      ? `<button type="button" class="btn btn-sm" onclick="openVocabModal()">⭐ Sổ Từ Vựng</button>`
      : `<button type="button" class="btn btn-sm" onclick="openFlashcardSourceRecord('${card.kind}', '${escapeHtml(card.id)}')">Mở bài gốc ↗</button>
         <button type="button" class="btn btn-sm" onclick="resetItemDrillProgress('${card.kind}', '${escapeHtml(card.id)}')" title="Reset điểm ôn các câu của bài này">Reset bài</button>`;
    controlsRightHtml = `
      ${audioBtnHtml}
      ${srcBtnHtml}
      <button type="button" class="btn btn-primary" onclick="flipFlashcard()">${flipped ? 'Ẩn đáp án' : 'Lật thẻ / Đối chiếu'}</button>`;
  }

  const kbdHint = card.quiz
    ? '<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> chọn đáp án · <kbd>←</kbd><kbd>→</kbd> chuyển'
    : (card.isSummary
      ? '<kbd>Space</kbd> lật thẻ · <kbd>←</kbd><kbd>→</kbd> chuyển'
      : '<kbd>Space</kbd> lật · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> chấm nhớ · <kbd>←</kbd><kbd>→</kbd> chuyển');

  stage.innerHTML = `
    <div class="fc-bar">
      <span>THẺ ${pad2(state.flashcard.index + 1)} / ${pad2(deck.length)}${recStats.total ? ` · TIẾN ĐỘ ${escapeHtml(card.id)}: ${recStats.solid}/${recStats.total} THUỘC` : ''}</span>
      <span>${kbdHint}</span>
    </div>
    <div class="fc-progress"><div style="width:${pct}%"></div></div>
    <div class="fc-card">
      ${bodyHtml}
      <div class="fc-ctl">
        <div class="grp">
          <button type="button" class="btn" onclick="moveFlashcard(-1)">← Thẻ trước</button>
          <button type="button" class="btn" onclick="moveFlashcard(1)">Thẻ tiếp →</button>
        </div>
        <div class="grp">${controlsRightHtml}</div>
      </div>
    </div>`;

  const draftEl = document.getElementById('fc-user-draft');
  if (draftEl) {
    draftEl.addEventListener('input', () => onFlashcardDraftInput(draftEl.value));
    draftEl.addEventListener('keydown', onFlashcardDraftKeydown);
  }
  if (typeof applyFullAppLocalization === 'function') applyFullAppLocalization();
}

function _hasOpenOverlay() {
  return (
    !document.getElementById('lightbox-modal').classList.contains('hidden') ||
    !document.getElementById('crossref-overlay').classList.contains('hidden') ||
    !document.getElementById('repair-modal').classList.contains('hidden') ||
    !document.getElementById('knowledge-modal').classList.contains('hidden') ||
    !document.getElementById('plc-modal').classList.contains('hidden') ||
    !document.getElementById('network-modal').classList.contains('hidden') ||
    !(document.getElementById('category-manager-modal')?.classList.contains('hidden') ?? true) ||
    !(document.getElementById('en-vocab-modal')?.classList.contains('hidden') ?? true) ||
    !(document.getElementById('en-vocab-edit-modal')?.classList.contains('hidden') ?? true) ||
    !(document.getElementById('en-ai-config-modal')?.classList.contains('hidden') ?? true)
  );
}

const FOCUS_TABS = ['repairs', 'knowledge', 'plc', 'network', 'en-vocab-bank'];

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && state.activeWorkspace && !_hasOpenOverlay()) {
    e.preventDefault();
    toggleLeftSidebar();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '\\' && state.activeWorkspace && !_hasOpenOverlay()) {
    e.preventDefault();
    toggleSplitMode('vertical');
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && state.activeWorkspace && !_hasOpenOverlay()) {
    if (document.activeElement?.closest?.('#inline-sec-editor-box')) {
      e.preventDefault();
      saveInlineSectionNow(true);
      return;
    }
    const activeElId = document.activeElement?.id || '';
    if (activeElId === 'pane2-scratchpad-textarea' || (state.splitMode && state.activePane === 'secondary' && state.pane2?.group === 'scratchpad')) {
      e.preventDefault();
      savePane2ScratchpadNow(true);
      return;
    }
    if (state.inlineSectionEdit) {
      e.preventDefault();
      saveInlineSectionNow(true);
      return;
    }
    if (state.activeTab === 'scratchpad') {
      e.preventDefault();
      saveScratchpadNow(true);
      return;
    }
  }
  if (e.altKey && e.key === 'Home') {
    e.preventDefault();
    if (!_hasOpenOverlay()) openPortalScreen();
    return;
  }
  if (e.key === 'Escape') {
    if (typeof isEnPopupOpen === 'function' && isEnPopupOpen()) {
      closeEnPopups();
      return;
    }
    if (typeof isCtxMenuOpen === 'function' && isCtxMenuOpen()) {
      closeCtxMenu();
      return;
    }
    if (_hasOpenOverlay()) {
      closeLightbox(); closeCrossRefDrawer(); closeRepairModal(); closeKnowledgeModal(); closePlcModal(); closeNetworkModal(); closeCategoryManagerModal();
      if (typeof closeVocabModal === 'function') closeVocabModal();
      if (typeof closeEnVocabEditorModal === 'function') closeEnVocabEditorModal();
      if (typeof closeAiConfigModal === 'function') closeAiConfigModal();
      return;
    }
    if (state.inlineChipEdit) {
      cancelChipInlineEdit();
      return;
    }
    if (state.activeWorkspace && FOCUS_TABS.includes(state.activeTab)) {
      showListPane(state.activeTab);
    }
    return;
  }
  if (!state.activeWorkspace) return;
  const tag = (document.activeElement?.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag) || _hasOpenOverlay()) return;

  if (FOCUS_TABS.includes(state.activeTab)) {
    if (e.key === 'ArrowUp') { e.preventDefault(); navigateAdjacentItem(state.activeTab, -1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); navigateAdjacentItem(state.activeTab, 1); }
    return;
  }

  if (state.activeTab !== 'flashcards') return;
  if (e.code === 'Space') { e.preventDefault(); flipFlashcard(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); moveFlashcard(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); moveFlashcard(-1); }
  else if (['1', '2', '3', '4'].includes(e.key)) {
    const cur = state.flashcard.deck[state.flashcard.index];
    if (cur?.quiz) {
      e.preventDefault();
      selectQuizOption(Number(e.key) - 1);
    } else if (state.flashcard.flipped && !cur?.isSummary) {
      e.preventDefault();
      if (e.key === '1') rateCurrentCard('forgot');
      else if (e.key === '2') rateCurrentCard('fuzzy');
      else if (e.key === '3') rateCurrentCard('solid');
    }
  }
});

