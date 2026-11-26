/**
 * byHuwng - Robot Trợ Lý Tài Xỉu Thông Minh & Live Game Watcher
 * - Giao diện Robot Avatar hoạt hình (Cyber Droid Companion)
 * - Khi nhập hoặc bắt được kết quả: Báo to rõ TÀI hoặc XỈU ở bên cạnh con robot
 * - Tính toán xác suất & dự báo thế cầu phiên tiếp theo
 * - KHÔNG phát giọng nói đọc kết quả (đã tắt theo yêu cầu)
 * - Bảng điều khiển gắn bên cạnh robot có thể kéo thả, thu gọn linh hoạt
 */

(function () {
  'use strict';

  if (window.__TAI_XIU_ROBOT_INJECTED__) return;
  window.__TAI_XIU_ROBOT_INJECTED__ = true;

  // Local state
  const watcherState = {
    sessions: [],
    settings: {
      voiceEnabled: false, // Tắt thông báo giọng nói
      notifyEnabled: true,
      onScreenAlert: true,
      autoDetect: true,
      bubbleVisible: true
    },
    lastDetectedSessionId: null,
    currentSessionNumber: 3340096,
    bannerTimeout: null,
    bubbleTimeout: null
  };

  // ==========================================
  // Inject WebSocket Sniffer Hook into Page
  // ==========================================
  function injectMainWorldHook() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('hook.js');
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.warn('[byHuwng] Hook note:', e);
    }
  }

  // Listen for intercepted live game packets from hook.js
  window.addEventListener('message', (event) => {
    if (event.data && event.data.source === 'TAI_XIU_PRO_HOOK' && event.data.type === 'LIVE_RESULT_DETECTED') {
      const payload = event.data.payload;
      if (payload && payload.d1 && payload.d2 && payload.d3) {
        const sId = payload.sessionId || (`#${watcherState.currentSessionNumber}`);
        if (sId !== watcherState.lastDetectedSessionId) {
          watcherState.lastDetectedSessionId = sId;
          handleFinishedSession(sId, payload.d1, payload.d2, payload.d3);
        }
      }
    }
  });

  // ==========================================
  // Mathematical Helper Functions
  // ==========================================
  function classifyRoll(d1, d2, d3) {
    const v1 = Number(d1), v2 = Number(d2), v3 = Number(d3);
    const sum = v1 + v2 + v3;
    const isTriple = (v1 === v2 && v2 === v3);
    let result = 'triple';
    if (!isTriple) {
      if (sum >= 11 && sum <= 17) result = 'tai';
      else if (sum >= 4 && sum <= 10) result = 'xiu';
    }
    return { dice: [v1, v2, v3], sum, result, isTriple };
  }

  function detectPatternName(sessions) {
    if (!sessions || sessions.length < 3) return 'Đang tích lũy chuỗi cầu';
    const results = sessions.map(s => s.result);
    const n = results.length;
    const last = results[n - 1];

    // Cầu bệt
    let bet = 1;
    for (let i = n - 2; i >= 0; i--) {
      if (results[i] === last) bet++;
      else break;
    }
    if (bet >= 3) {
      const name = last === 'tai' ? 'Tài' : (last === 'xiu' ? 'Xỉu' : 'Bộ ba');
      return `Cầu Bệt ${name} (${bet} phiên liên tiếp)`;
    }

    // Cầu đảo 1-1
    let dao = 1;
    let expected = last === 'tai' ? 'xiu' : 'tai';
    for (let i = n - 2; i >= 0; i--) {
      if (results[i] === expected) {
        dao++;
        expected = expected === 'tai' ? 'xiu' : 'tai';
      } else break;
    }
    if (dao >= 3) return `Cầu Đảo 1-1 (${dao} nhịp xen kẽ)`;

    // Cầu 2-2
    if (n >= 4) {
      const t = results.slice(-4);
      if (t[0] === t[1] && t[2] === t[3] && t[0] !== t[2] && t[0] !== 'triple') {
        return 'Nhịp Cầu 2-2 (Cặp đối xứng)';
      }
    }

    return 'Cầu ngẫu nhiên tự nhiên';
  }

  /**
   * Tính toán xác suất và phân tích thế cầu cho PHIÊN TIẾP THEO
   */
  /**
   * Xem lại toàn bộ các kết quả trước đó rồi mới đưa ra quyết định tối ưu
   */
  function calcNextSessionForecast(finishedSession, history) {
    // 1. Mã phiên tiếp theo
    let nextSessionId = '#???';
    if (finishedSession.sessionId) {
      const numMatch = finishedSession.sessionId.match(/[0-9]+/);
      if (numMatch) {
        const nextNum = parseInt(numMatch[0], 10) + 1;
        nextSessionId = `#${nextNum}`;
        watcherState.currentSessionNumber = nextNum;
      }
    } else {
      watcherState.currentSessionNumber++;
      nextSessionId = `#${watcherState.currentSessionNumber}`;
    }

    // 2. LẤY CHUỖI LỊCH SỬ ĐỂ SOI LẠI (REVIEW PREVIOUS SESSIONS)
    const validHistory = (history && history.length > 0) ? history : [finishedSession];
    const n = validHistory.length;
    const results = validHistory.map(s => s.result);
    const sums = validHistory.map(s => s.sum || 10);
    const lastResult = results[n - 1];

    // Lấy chuỗi 5 ván gần nhất để hiển thị trực quan cho người chơi
    const recent5 = validHistory.slice(-5);
    const recent5Symbols = recent5.map(s => s.result === 'tai' ? 'Tài' : (s.result === 'xiu' ? 'Xỉu' : 'Bộ 3')).join(' ➔ ');

    // 3. ĐÁNH GIÁ YẾU TỐ 1: THẾ CẦU & CHUỖI NHỊP (Streak & Pattern)
    const pattern = detectPatternName(validHistory);
    let patternScore = 0; // > 0 nghiêng về Tài, < 0 nghiêng về Xỉu

    // 4. ĐÁNH GIÁ YẾU TỐ 2: QUỸ ĐẠO ĐIỂM SỐ XÚC XẮC (Dice Momentum)
    let momentumScore = 0;
    let momentumNote = '';
    if (sums.length >= 3) {
      const s1 = sums[sums.length - 3];
      const s2 = sums[sums.length - 2];
      const s3 = sums[sums.length - 1];
      if (s1 < s2 && s2 < s3) {
        // Điểm đang leo dốc liên tục (ví dụ: 7 -> 10 -> 13)
        momentumScore = +15;
        momentumNote = `Điểm tăng (${s1}➔${s2}➔${s3}), đà Tài mạnh`;
      } else if (s1 > s2 && s2 > s3) {
        // Điểm đang tụt dốc liên tục (ví dụ: 15 -> 12 -> 8)
        momentumScore = -15;
        momentumNote = `Điểm giảm (${s1}➔${s2}➔${s3}), đà Xỉu mạnh`;
      } else if (s3 >= 15) {
        // Chạm trần điểm cao (15, 16, 17) -> Lực hồi quy kéo về Xỉu rất mạnh
        momentumScore = -20;
        momentumNote = `Điểm chạm trần cao (${s3}đ), lực hồi quy kéo về Xỉu mạnh`;
      } else if (s3 <= 6) {
        // Chạm sàn điểm thấp (4, 5, 6) -> Lực nảy kéo lên Tài rất mạnh
        momentumScore = +20;
        momentumNote = `Điểm chạm sàn thấp (${s3}đ), lực nảy kéo lên Tài mạnh`;
      }
    }

    // 5. ĐÁNH GIÁ YẾU TỐ 3: MA TRẬN CHUYỂN DỊCH BÀN CHƠI (Markov Transition)
    // Sau khi ra kết quả giống ván vừa rồi, lịch sử bàn này thường ra con gì tiếp?
    let markovTaiCount = 0;
    let markovXiuCount = 0;
    for (let i = 0; i < n - 1; i++) {
      if (results[i] === lastResult) {
        const next = results[i + 1];
        if (next === 'tai') markovTaiCount++;
        else if (next === 'xiu') markovXiuCount++;
      }
    }
    const markovTotal = markovTaiCount + markovXiuCount;
    let markovScore = 0;
    let markovNote = '';
    if (markovTotal >= 3) {
      const markovTaiRate = markovTaiCount / markovTotal;
      markovScore = (markovTaiRate - 0.5) * 36;
      const lastLabel = lastResult === 'tai' ? 'Tài' : 'Xỉu';
      const favoredNext = markovTaiRate > 0.5 ? 'Tài' : 'Xỉu';
      const favoredPct = Math.round(Math.max(markovTaiRate, 1 - markovTaiRate) * 100);
      markovNote = `Lịch sử bàn sau ${lastLabel}: ${favoredPct}% ra ${favoredNext}`;
    }

    // 6. ĐÁNH GIÁ YẾU TỐ 4: TỶ LỆ CÂN BẰNG 20 PHIÊN GẦN NHẤT (Mean Reversion)
    const recent20 = validHistory.slice(-20);
    const countTai = recent20.filter(s => s.result === 'tai').length;
    const countXiu = recent20.filter(s => s.result === 'xiu').length;
    const totalRecent = countTai + countXiu || 1;
    let balanceScore = 0;
    let balanceNote = '';
    if (totalRecent >= 6) {
      const diff = countTai - countXiu;
      balanceScore = -(diff * 2.8);
      balanceScore = Math.max(-18, Math.min(18, balanceScore));
      if (Math.abs(diff) >= 3) {
        balanceNote = diff > 0 
          ? `20 phiên gần: Tài đang lệch +${diff} ván, xu hướng bù Xỉu` 
          : `20 phiên gần: Xỉu đang lệch +${Math.abs(diff)} ván, xu hướng bù Tài`;
      }
    }

    // 7. TÍNH ĐIỂM THẾ CẦU (Pattern Scoring)
    let trendBadge = 'Cầu Tự Nhiên';

    if (pattern.includes('Cầu Bệt')) {
      const isBetTai = pattern.includes('Tài');
      const matchNum = pattern.match(/\d+/);
      const streakLen = matchNum ? parseInt(matchNum[0], 10) : 3;
      trendBadge = isBetTai ? `Theo Bệt Tài (${streakLen}v)` : `Theo Bệt Xỉu (${streakLen}v)`;
      
      if (streakLen <= 4) {
        // Bệt 3-4 ván: Quán tính đang mạnh nhất, theo bệt
        patternScore = isBetTai ? +28 : -28;
      } else {
        // Bệt 5+ ván: Đã bệt dài, tiếp tục theo nhưng giảm trọng số
        patternScore = isBetTai ? +16 : -16;
      }
    } else if (pattern.includes('Cầu Đảo')) {
      const nextSuggest = lastResult === 'tai' ? 'xiu' : 'tai';
      trendBadge = `Theo Đảo ➔ ${nextSuggest.toUpperCase()}`;
      patternScore = nextSuggest === 'tai' ? +24 : -24;
    } else if (pattern.includes('2-2')) {
      const nextSuggest = lastResult === 'tai' ? 'xiu' : 'tai';
      trendBadge = `Cầu Đôi ➔ ${nextSuggest.toUpperCase()}`;
      patternScore = nextSuggest === 'tai' ? +20 : -20;
    }

    // 8. TỔNG HỢP TOÀN BỘ 4 YẾU TỐ LỊCH SỬ (COMPOSITE DECISION MATRIX)
    const finalScore = patternScore + momentumScore + markovScore + balanceScore;
    let finalTaiProb = 50 + (finalScore * 0.7);
    finalTaiProb = Math.max(30, Math.min(75, finalTaiProb));
    const finalXiuProb = 100 - finalTaiProb;

    // 9. QUYẾT ĐỊNH CHỐT (THE FINAL DECISION)
    let decision = 'THEO DÕI';
    let decisionClass = 'dec-neutral';
    let confidence = Math.round(Math.max(finalTaiProb, finalXiuProb));

    if (finalTaiProb >= 53.5) {
      decision = 'ĐÁNH TÀI';
      decisionClass = 'dec-tai';
    } else if (finalXiuProb >= 53.5) {
      decision = 'ĐÁNH XỈU';
      decisionClass = 'dec-xiu';
    } else {
      decision = 'QUAN SÁT / ĐI ĐỀU';
      decisionClass = 'dec-neutral';
      confidence = 50;
    }

    // 10. TỔNG HỢP DẪN CHỨNG ĐÃ SOI
    const reasons = [];
    if (pattern && !pattern.includes('ngẫu nhiên')) reasons.push(pattern);
    if (momentumNote) reasons.push(momentumNote);
    if (markovNote) reasons.push(markovNote);
    if (balanceNote) reasons.push(balanceNote);

    const trendAdvice = reasons.length > 0 
      ? reasons.join(' • ') 
      : 'Đã soi lại lịch sử: Hai cửa cân bằng, nên đánh nhỏ thăm dò hoặc quan sát thêm 1 ván.';

    const probTheoTai = `${finalTaiProb.toFixed(1)}%`.replace('.', ',');
    const probTheoXiu = `${finalXiuProb.toFixed(1)}%`.replace('.', ',');
    const probTheoTriple = '2,78%';

    return {
      nextSessionId,
      decision,
      decisionClass,
      confidence: `${confidence}%`,
      recent5Symbols,
      probTheoTai,
      probTheoXiu,
      probTheoTriple,
      pattern,
      trendBadge,
      trendAdvice,
      historySummary: `20 phiên gần: ${countTai} Tài / ${countXiu} Xỉu`
    };
  }

  // ==========================================
  // Crystal Audio Chime (Hiệu ứng chuông âm thanh nhẹ, KHÔNG GIỌNG NÓI)
  // ==========================================
  function playCasinoChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.08);
      gain2.gain.setValueAtTime(0.25, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.45);

      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1046.50, now + 0.16);
      gain3.gain.setValueAtTime(0.3, now + 0.16);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.16);
      osc3.stop(now + 0.7);
    } catch (e) {
      // pass
    }
  }

  // ==========================================
  // DUAL-PANEL BIG ON-SCREEN ALERT BANNER
  // (Banner to trên đỉnh màn hình khi có kết quả mới)
  // ==========================================
  function showDualOnScreenBanner(finishedSession, forecast) {
    if (!watcherState.settings.onScreenAlert) return;

    let banner = document.getElementById('tx-screen-alert-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'tx-screen-alert-banner';
      banner.className = 'tx-screen-banner';
      document.body.appendChild(banner);
    }

    if (watcherState.bannerTimeout) {
      clearTimeout(watcherState.bannerTimeout);
    }

    const roll = finishedSession;
    const isTai = roll.result === 'tai';
    const isXiu = roll.result === 'xiu';
    const isTriple = roll.result === 'triple';

    let resultClass = 'is-tai';
    let label = 'TÀI';
    if (isXiu) {
      resultClass = 'is-xiu';
      label = 'XỈU';
    } else if (isTriple) {
      resultClass = 'is-triple';
      label = 'BỘ BA';
    }

    const [d1, d2, d3] = roll.dice;
    const sId = roll.sessionId || `#${watcherState.currentSessionNumber}`;

    banner.className = `tx-screen-banner ${resultClass} animate-in`;
    banner.innerHTML = `
      <div class="tx-banner-top-bar">
        <span class="tx-banner-tag-badge">🤖 ROBOT byHuwng: KẾT QUẢ PHIÊN</span>
        <button class="tx-banner-close" title="Đóng">✕</button>
      </div>

      <div class="tx-banner-dual-grid">
        <!-- CỘT 1: KẾT QUẢ VỪA XONG -->
        <div class="tx-banner-col tx-col-finished">
          <div class="tx-col-label">PHIÊN VỪA XONG: ${sId}</div>
          <div class="tx-col-big-res">${label} ${roll.sum} ĐIỂM</div>
          <div class="tx-col-dice-row">
            <span class="tx-b-die die-${d1}">${d1}</span>
            <span class="tx-b-die die-${d2}">${d2}</span>
            <span class="tx-b-die die-${d3}">${d3}</span>
          </div>
          <div class="tx-col-sub">${forecast.pattern}</div>
        </div>

        <div class="tx-banner-divider"></div>

        <!-- CỘT 2: TÍNH TOÁN PHIÊN TIẾP THEO -->
        <div class="tx-banner-col tx-col-next">
          <div class="tx-col-label">DỰ BÁO TIẾP THEO: ${forecast.nextSessionId}</div>
          <div class="tx-banner-decision-row">
            <span class="tx-banner-decision-badge ${forecast.decisionClass}">🎯 ${forecast.decision} (${forecast.confidence})</span>
            <span class="tx-col-trend-badge">${forecast.trendBadge}</span>
          </div>
          <div class="tx-banner-review-trail">🧠 Đã soi ván trước: <strong>${forecast.recent5Symbols}</strong></div>
          <div class="tx-col-prob-row">
            <span class="tx-prob-pill prob-tai">Tài: ${forecast.probTheoTai}</span>
            <span class="tx-prob-pill prob-xiu">Xỉu: ${forecast.probTheoXiu}</span>
            <span class="tx-prob-pill prob-b3">Bộ 3: 2,78%</span>
          </div>
          <div class="tx-col-sub tx-col-advice">⚖️ ${forecast.trendAdvice}</div>
        </div>
      </div>

      <div class="tx-banner-timer-bar"></div>
    `;

    const closeBtn = banner.querySelector('.tx-banner-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissBanner(banner);
    });

    banner.addEventListener('click', () => {
      dismissBanner(banner);
    });

    watcherState.bannerTimeout = setTimeout(() => {
      dismissBanner(banner);
    }, 5500);
  }

  function dismissBanner(banner) {
    if (!banner) return;
    banner.classList.remove('animate-in');
    banner.classList.add('animate-out');
    setTimeout(() => {
      if (banner && banner.parentNode) {
        banner.className = 'tx-screen-banner';
        banner.style.display = 'none';
      }
    }, 300);
  }

  // ==========================================
  // Xử lý khi bắt được hoặc nhập kết quả phiên
  // ==========================================
  async function handleFinishedSession(sessionId, d1, d2, d3) {
    const roll = classifyRoll(d1, d2, d3);
    const newSession = {
      id: sessionId || ('s_' + Date.now()),
      sessionId: sessionId || (`#${watcherState.currentSessionNumber}`),
      timestamp: Date.now(),
      dice: [d1, d2, d3],
      sum: roll.sum,
      result: roll.result,
      isTriple: roll.isTriple
    };

    watcherState.sessions.push(newSession);

    // Lưu vào chrome storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['sessions'], (res) => {
        const list = res.sessions || [];
        list.push(newSession);
        chrome.storage.local.set({ sessions: list });
      });
    }

    // TÍNH TOÁN CHO PHIÊN TIẾP THEO
    const forecast = calcNextSessionForecast(newSession, watcherState.sessions);

    // 1. Âm thanh chuông casino nhẹ
    playCasinoChime();

    // 2. Banner to trên màn hình (nếu bật)
    showDualOnScreenBanner(newSession, forecast);

    // 3. Desktop Notification (không phát giọng nói)
    const label = roll.result === 'tai' ? 'Tài' : (roll.result === 'xiu' ? 'Xỉu' : 'Bộ ba');
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'SHOW_NOTIFICATION',
        title: `🤖 byHuwng: Phiên ${newSession.sessionId} về ${label.toUpperCase()} ${roll.sum}đ [${d1}-${d2}-${d3}]`,
        body: `Phiên tiếp theo ${forecast.nextSessionId} | ${forecast.trendBadge}`
      });
    }

    // 4. CẬP NHẬT CON ROBOT VÀ BÁO KẾT QUẢ RA BÊN CẠNH
    updateRobotAndSideBubble(newSession, forecast);
  }

  // ==========================================
  // Auto-Detect Scanner (DOM & Text Inspection)
  // ==========================================
  function scanPageForResults() {
    if (!watcherState.settings.autoDetect) return;

    const bodyText = document.body ? document.body.innerText : '';
    if (!bodyText) return;

    // Pattern 1: Phiên gần nhất: #3340096 ... Tài(6-2-5)
    const matchFull = bodyText.match(/Phiên\s*(?:gần\s*nhất)?[:\s]*#?([0-9]{5,10})[\s\S]{1,60}?(Tài|Xỉu|Bộ\s*ba)\s*\(([1-6])[-,\s]+([1-6])[-,\s]+([1-6])\)/i);
    if (matchFull) {
      const sId = '#' + matchFull[1];
      const d1 = parseInt(matchFull[3], 10);
      const d2 = parseInt(matchFull[4], 10);
      const d3 = parseInt(matchFull[5], 10);

      if (sId !== watcherState.lastDetectedSessionId) {
        watcherState.lastDetectedSessionId = sId;
        handleFinishedSession(sId, d1, d2, d3);
        return;
      }
    }

    // Pattern 2: standalone Tài(6-2-5) or Xỉu(1-2-3)
    const matchSimple = bodyText.match(/(Tài|Xỉu|Bộ\s*ba)\s*\(([1-6])[-,\s]+([1-6])[-,\s]+([1-6])\)/i);
    if (matchSimple) {
      const d1 = parseInt(matchSimple[2], 10);
      const d2 = parseInt(matchSimple[3], 10);
      const d3 = parseInt(matchSimple[4], 10);
      const pseudoId = `auto_${d1}_${d2}_${d3}`;

      if (pseudoId !== watcherState.lastDetectedSessionId) {
        const sMatch = bodyText.match(/#([0-9]{5,10})/);
        const sId = sMatch ? `#${sMatch[1]}` : null;
        watcherState.lastDetectedSessionId = pseudoId;
        handleFinishedSession(sId, d1, d2, d3);
        return;
      }
    }
  }

  // ==========================================
  // INJECT FLOATING ROBOT ASSISTANT & SIDE BUBBLE
  // ==========================================
  function injectRobotHud() {
    if (document.getElementById('taixiu-pro-hud')) return;

    const container = document.createElement('div');
    container.id = 'taixiu-pro-hud';
    container.className = 'tx-robot-container';
    container.innerHTML = `
      <!-- 1. CỘT CON ROBOT & THANH NHẬP XÚC XẮC LUÔN SẴN SÀNG (KỂ CẢ KHI THU GỌN) -->
      <div class="tx-robot-column" id="txRobotColumn">
        <!-- Robot Avatar Character -->
        <div class="tx-robot-avatar-wrap" id="txRobotAvatar" title="Nhấp để ẩn/hiện bảng kết quả bên cạnh | Giữ chuột để kéo di chuyển">
          <!-- Robot Character Graphics -->
          <div class="tx-robot-body">
            <!-- Ăng-ten phát sóng -->
            <div class="tx-robot-antenna">
              <div class="tx-antenna-ball" id="txAntennaBall"></div>
              <div class="tx-antenna-stem"></div>
            </div>

            <!-- Đầu Robot -->
            <div class="tx-robot-head">
              <!-- Tai cảm biến trái phải -->
              <div class="tx-robot-ear ear-left"></div>
              <div class="tx-robot-ear ear-right"></div>

              <!-- Kính mắt / Màn hình hiển thị biểu cảm -->
              <div class="tx-robot-face" id="txRobotFace">
                <div class="tx-robot-eye eye-left" id="txEyeLeft"></div>
                <div class="tx-robot-eye eye-right" id="txEyeRight"></div>
                <div class="tx-robot-mouth" id="txRobotMouth"></div>
              </div>
            </div>

            <!-- Thân Robot và Động cơ đẩy năng lượng -->
            <div class="tx-robot-torso">
              <div class="tx-robot-chest-plate">
                <div class="tx-robot-logo-text">byHuwng</div>
                <div class="tx-robot-reactor" id="txRobotReactor"></div>
              </div>
              <!-- Vòng năng lượng bay lơ lửng -->
              <div class="tx-robot-thruster"></div>
            </div>
          </div>

          <!-- Trạng thái LED báo hiệu -->
          <div class="tx-robot-status-pill" id="txRobotStatusPill">
            <span class="tx-pill-dot"></span>
            <span class="tx-pill-text" id="txRobotPillText">AI Bot</span>
          </div>
        </div>

        <!-- PHẦN NHẬP XÚC XẮC CỦA ROBOT (VẪN CÒN KHI THU GỌN) -->
        <div class="tx-robot-dock" id="txRobotDock">
          <div class="tx-dock-quick-row">
            <button id="txDockTaiBtn" class="tx-dock-btn tx-dock-tai" title="Báo nhanh Tài 13 (6-2-5)">⚡Tài</button>
            <button id="txDockXiuBtn" class="tx-dock-btn tx-dock-xiu" title="Báo nhanh Xỉu 8 (2-3-3)">⚡Xỉu</button>
            <button id="txDockToggleBtn" class="tx-dock-btn tx-dock-toggle" title="Mở rộng / Thu nhỏ bảng bên cạnh">📊</button>
          </div>
          <div class="tx-dock-input-row">
            <input type="text" id="txDockDiceInput" placeholder="vd: 625 (hoặc 625 123 456)" maxlength="60" title="Gõ 3 số (vd: 625) hoặc chuỗi nhiều ván (vd: 625 123 456) & Enter">
            <button id="txDockSubmitBtn" class="tx-dock-sub" title="Báo kết quả">Báo</button>
          </div>
        </div>

        <!-- Bong bóng báo kết quả bên cạnh con robot khi thu gọn -->
        <div class="tx-robot-quick-tag" id="txRobotQuickTag" style="display: none;">
          <div class="tx-quick-tag-bubble">
            <div class="tx-tag-res" id="txQuickTagRes">TÀI 13 [6-2-5]</div>
            <div class="tx-tag-decision" id="txQuickTagDecision">🎯 ĐÁNH TÀI (65%)</div>
            <div class="tx-tag-next" id="txQuickTagNext">Kế tiếp: #3340097 • Bệt Tài</div>
          </div>
        </div>
      </div>

      <!-- 2. BẢNG BÁO KẾT QUẢ & TÍNH TOÁN Ở BÊN CẠNH CON ROBOT (SIDE BUBBLE) -->
      <div class="tx-robot-side-panel" id="txRobotSidePanel">
        <!-- Mũi tên chỉ vào Robot -->
        <div class="tx-side-panel-pointer"></div>

        <!-- Header bảng bên cạnh -->
        <div class="tx-panel-header" id="txPanelHeader">
          <div class="tx-panel-brand">
            <span class="tx-panel-title">🤖 Trợ Lý Robot byHuwng</span>
            <span class="tx-panel-live-badge">ONLINE</span>
          </div>
          <div class="tx-panel-controls">
            <button id="txPanelBannerBtn" class="tx-p-btn active" title="Bật/Tắt màn hình thông báo to">🖥️</button>
            <button id="txPanelNotifyBtn" class="tx-p-btn active" title="Bật/Tắt thông báo máy tính">🔔</button>
            <button id="txPanelCollapseBtn" class="tx-p-btn" title="Thu nhỏ vào con robot">◀</button>
          </div>
        </div>

        <!-- Body bảng bên cạnh: BÁO RA TÀI HOẶC XỈU -->
        <div class="tx-panel-body" id="txPanelBody">
          <!-- KHỐI 1: BÁO KẾT QUẢ PHIÊN VỪA XONG -->
          <div class="tx-p-card tx-p-card-res" id="txPanelResultCard">
            <div class="tx-res-top-row">
              <span class="tx-res-session-id" id="txHudSessionId">Phiên vừa xong: #3340096</span>
              <span class="tx-res-badge badge-tai" id="txHudBadgeRes">TÀI (13đ)</span>
            </div>

            <!-- Xúc xắc và Tổng điểm cực to và trực quan -->
            <div class="tx-res-dice-row">
              <div class="tx-die-box" id="txHudDie1">6</div>
              <div class="tx-die-box" id="txHudDie2">2</div>
              <div class="tx-die-box" id="txHudDie3">5</div>
              <div class="tx-sum-highlight" id="txHudSum">Tổng: 13</div>
            </div>

            <!-- Thế cầu hiện tại -->
            <div class="tx-res-pattern-line" id="txHudPattern">🎲 Đang theo dõi chuỗi cầu...</div>
          </div>

          <!-- KHỐI 2: DỰ BÁO TOÁN HỌC & QUYẾT ĐỊNH CHO PHIÊN TIẾP THEO -->
          <div class="tx-p-card tx-p-card-forecast" id="txPanelForecastCard">
            <div class="tx-forecast-top-row">
              <span class="tx-forecast-id" id="txNextSessionId">Phiên kế tiếp: #3340097</span>
              <span class="tx-forecast-badge" id="txNextTrendBadge">DỰ BÁO CẦU</span>
            </div>

            <!-- Khối Quyết Định Chốt Sau Khi Soi Lịch Sử -->
            <div class="tx-decision-banner" id="txDecisionBanner">
              <span class="tx-decision-label">🎯 QUYẾT ĐỊNH:</span>
              <span class="tx-decision-val" id="txDecisionVal">ĐÁNH TÀI</span>
              <span class="tx-decision-conf" id="txDecisionConf">(65,0%)</span>
            </div>

            <!-- Khối Soi Lại Chuỗi Ván Trước -->
            <div class="tx-history-review-row" id="txHistoryReviewRow">
              <span class="tx-review-tag">🧠 Đã soi các ván trước:</span>
              <span class="tx-review-seq" id="txReviewSeq">Xỉu ➔ Tài ➔ Tài</span>
            </div>

            <div class="tx-forecast-probs-row">
              <span class="tx-prob-chip p-tai" id="txProbChipTai">Tài: <strong>50,0%</strong></span>
              <span class="tx-prob-chip p-xiu" id="txProbChipXiu">Xỉu: <strong>50,0%</strong></span>
              <span class="tx-prob-chip p-b3" id="txProbChipB3">Bộ 3: <strong>2,78%</strong></span>
            </div>

            <div class="tx-forecast-advice-text" id="txNextAdvice">
              ⚖️ Đang xem lại các kết quả trước đó để đưa ra quyết định...
            </div>
          </div>

          <!-- KHỐI 3: NHẬP NHANH KẾT QUẢ VÀO ROBOT -->
          <div class="tx-quick-section">
            <div class="tx-quick-title">⚡ Bấm Nhanh Hoặc Nhập Số Xúc Xắc:</div>
            <div class="tx-quick-buttons">
              <button id="txQuickTai" class="tx-q-btn tx-q-tai" title="Báo nhanh Tài 13 (6-2-5)">⚡ TÀI (13đ)</button>
              <button id="txQuickXiu" class="tx-q-btn tx-q-xiu" title="Báo nhanh Xỉu 8 (2-3-3)">⚡ XỈU (8đ)</button>
              <button id="txQuickTriple" class="tx-q-btn tx-q-b3" title="Báo nhanh Bộ ba ngẫu nhiên">⚡ BỘ BA</button>
            </div>

            <div class="tx-input-group">
              <input type="text" id="txManualDiceInput" placeholder="Gõ 625 hoặc nhiều ván (vd: 625 123 456)" maxlength="60">
              <button id="txManualSubmitBtn" class="tx-input-submit-btn">Báo</button>
            </div>
          </div>

          <!-- Mini Bead Road (Chuỗi hạt lịch sử cầu gần nhất) -->
          <div class="tx-bead-road-container" id="txHudBeadRow">
            <!-- Điểm hạt tròn T, X, B -->
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    setupRobotDraggable(container);
    setupRobotListeners(container);

    // Initial render from storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['sessions', 'settings'], (res) => {
        if (res.sessions && res.sessions.length > 0) {
          watcherState.sessions = res.sessions;
          const last = res.sessions[res.sessions.length - 1];
          const forecast = calcNextSessionForecast(last, res.sessions);
          updateRobotAndSideBubble(last, forecast);
        }
      });
    }
  }

  // ==========================================
  // Dragging logic (Kéo thả cả cụm Robot + Bảng)
  // ==========================================
  function setupRobotDraggable(container) {
    const avatar = container.querySelector('#txRobotAvatar');
    const panelHeader = container.querySelector('#txPanelHeader');

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let hasMoved = false;

    function onMouseDown(e) {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;

      const rect = container.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      container.classList.add('is-dragging');
      e.preventDefault();
    }

    avatar.addEventListener('mousedown', onMouseDown);
    panelHeader.addEventListener('mousedown', onMouseDown);

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }

      const newLeft = Math.max(10, Math.min(window.innerWidth - 100, initialLeft + dx));
      const newTop = Math.max(10, Math.min(window.innerHeight - 100, initialTop + dy));

      container.style.left = `${newLeft}px`;
      container.style.top = `${newTop}px`;
      container.style.right = 'auto';
      container.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        container.classList.remove('is-dragging');
      }
    });

    // Toggle bubble khi click vào Avatar mà không kéo chuột
    avatar.addEventListener('click', (e) => {
      if (hasMoved) return; // Nếu vừa kéo thì không toggle
      toggleSidePanel();
    });
  }

  function toggleSidePanel() {
    const container = document.getElementById('taixiu-pro-hud');
    const panel = document.getElementById('txRobotSidePanel');
    const collapseBtn = document.getElementById('txPanelCollapseBtn');
    const dockToggleBtn = document.getElementById('txDockToggleBtn');
    if (!panel) return;

    watcherState.settings.bubbleVisible = !watcherState.settings.bubbleVisible;

    if (watcherState.settings.bubbleVisible) {
      panel.style.display = 'block';
      container.classList.remove('panel-collapsed');
      if (collapseBtn) collapseBtn.textContent = '◀';
      if (dockToggleBtn) dockToggleBtn.textContent = '◀';
    } else {
      panel.style.display = 'none';
      container.classList.add('panel-collapsed');
      if (collapseBtn) collapseBtn.textContent = '▶';
      if (dockToggleBtn) dockToggleBtn.textContent = '📊';
    }
  }

  // ==========================================
  // Event listeners (Buttons, Inputs)
  // ==========================================
  function setupRobotListeners(container) {
    const collapseBtn = container.querySelector('#txPanelCollapseBtn');
    const dockToggleBtn = container.querySelector('#txDockToggleBtn');
    const bannerBtn = container.querySelector('#txPanelBannerBtn');
    const notifyBtn = container.querySelector('#txPanelNotifyBtn');

    if (collapseBtn) {
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidePanel();
      });
    }

    if (dockToggleBtn) {
      dockToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidePanel();
      });
    }

    if (bannerBtn) {
      bannerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        watcherState.settings.onScreenAlert = !watcherState.settings.onScreenAlert;
        bannerBtn.classList.toggle('active', watcherState.settings.onScreenAlert);
      });
    }

    if (notifyBtn) {
      notifyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        watcherState.settings.notifyEnabled = !watcherState.settings.notifyEnabled;
        notifyBtn.classList.toggle('active', watcherState.settings.notifyEnabled);
        notifyBtn.textContent = watcherState.settings.notifyEnabled ? '🔔' : '🔕';
      });
    }

    // Quick Add Buttons (Trên bảng side-panel)
    const quickTai = container.querySelector('#txQuickTai');
    if (quickTai) {
      quickTai.addEventListener('click', () => {
        handleFinishedSession(null, 6, 2, 5); // Tài 13 (6-2-5)
      });
    }

    const quickXiu = container.querySelector('#txQuickXiu');
    if (quickXiu) {
      quickXiu.addEventListener('click', () => {
        handleFinishedSession(null, 2, 3, 3); // Xỉu 8 (2-3-3)
      });
    }

    const quickTriple = container.querySelector('#txQuickTriple');
    if (quickTriple) {
      quickTriple.addEventListener('click', () => {
        const v = (Math.random() * 6 | 0) + 1;
        handleFinishedSession(null, v, v, v);
      });
    }

    // Quick Add Buttons (Ngay trên thanh thu gọn dưới Robot)
    const dockTai = container.querySelector('#txDockTaiBtn');
    if (dockTai) {
      dockTai.addEventListener('click', (e) => {
        e.stopPropagation();
        handleFinishedSession(null, 6, 2, 5); // Tài 13 (6-2-5)
      });
    }

    const dockXiu = container.querySelector('#txDockXiuBtn');
    if (dockXiu) {
      dockXiu.addEventListener('click', (e) => {
        e.stopPropagation();
        handleFinishedSession(null, 2, 3, 3); // Xỉu 8 (2-3-3)
      });
    }

    // Xử lý chung hàm submit xúc xắc từ chuỗi text (Hỗ trợ cả 1 ván hoặc 4-5 ván liên tiếp)
    const executeDiceSubmit = (rawStr) => {
      const raw = (rawStr || '').trim();

      // Trường hợp 1: Nhập hàng loạt 4 - 5 ván cùng lúc (ví dụ: "625 123 456 233 555" hoặc cách nhau bằng dấu phẩy)
      const batchMatches = raw.match(/[1-6]{3}/g);
      if (batchMatches && batchMatches.length > 1) {
        batchMatches.forEach((dStr) => {
          const d1 = parseInt(dStr[0], 10);
          const d2 = parseInt(dStr[1], 10);
          const d3 = parseInt(dStr[2], 10);
          handleFinishedSession(null, d1, d2, d3);
        });

        const input1 = document.getElementById('txManualDiceInput');
        const input2 = document.getElementById('txDockDiceInput');
        if (input1) input1.value = '';
        if (input2) input2.value = '';
        return true;
      }

      // Trường hợp 2: Nhập 1 ván thông thường (ví dụ: "625" hoặc "#3340096 625")
      let customSessionId = null;
      let diceStr = raw;

      const sessionMatch = raw.match(/#?([0-9]{5,10})\s+([1-6]{3})/);
      if (sessionMatch) {
        customSessionId = '#' + sessionMatch[1];
        diceStr = sessionMatch[2];
      } else {
        diceStr = raw.replace(/[^1-6]/g, '');
      }

      if (diceStr.length === 3) {
        const d1 = parseInt(diceStr[0], 10);
        const d2 = parseInt(diceStr[1], 10);
        const d3 = parseInt(diceStr[2], 10);
        handleFinishedSession(customSessionId, d1, d2, d3);

        const input1 = document.getElementById('txManualDiceInput');
        const input2 = document.getElementById('txDockDiceInput');
        if (input1) input1.value = '';
        if (input2) input2.value = '';
        return true;
      }
      alert('Vui lòng gõ 3 số xúc xắc (ví dụ: 625) hoặc chuỗi nhiều ván (ví dụ: 625 123 456 233)');
      return false;
    };

    // Manual Input 1: Trên bảng side-panel
    const input = container.querySelector('#txManualDiceInput');
    const submit = container.querySelector('#txManualSubmitBtn');
    if (submit && input) {
      submit.addEventListener('click', () => executeDiceSubmit(input.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') executeDiceSubmit(input.value);
      });
    }

    // Manual Input 2: Ngay trên thanh dock con robot (VẪN CÒN KHI THU GỌN)
    const dockInput = container.querySelector('#txDockDiceInput');
    const dockSubmit = container.querySelector('#txDockSubmitBtn');
    if (dockSubmit && dockInput) {
      dockSubmit.addEventListener('click', (e) => {
        e.stopPropagation();
        executeDiceSubmit(dockInput.value);
      });
      dockInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          executeDiceSubmit(dockInput.value);
        }
      });
    }
  }

  // ==========================================
  // Cập nhật Robot Avatar & Bảng báo bên cạnh
  // ==========================================
  function updateRobotAndSideBubble(session, forecast) {
    if (!session) return;

    const container = document.getElementById('taixiu-pro-hud');
    const avatar = document.getElementById('txRobotAvatar');
    const face = document.getElementById('txRobotFace');
    const reactor = document.getElementById('txRobotReactor');
    const antenna = document.getElementById('txAntennaBall');
    const pillText = document.getElementById('txRobotPillText');
    const quickTag = document.getElementById('txRobotQuickTag');
    const quickTagRes = document.getElementById('txQuickTagRes');
    const quickTagNext = document.getElementById('txQuickTagNext');

    const sIdEl = document.getElementById('txHudSessionId');
    const badgeEl = document.getElementById('txHudBadgeRes');
    const d1El = document.getElementById('txHudDie1');
    const d2El = document.getElementById('txHudDie2');
    const d3El = document.getElementById('txHudDie3');
    const sumEl = document.getElementById('txHudSum');
    const patEl = document.getElementById('txHudPattern');

    const nextIdEl = document.getElementById('txNextSessionId');
    const nextBadgeEl = document.getElementById('txNextTrendBadge');
    const nextAdviceEl = document.getElementById('txNextAdvice');
    const sidePanel = document.getElementById('txRobotSidePanel');

    // Phân loại kết quả
    const isTai = session.result === 'tai';
    const isXiu = session.result === 'xiu';
    const isTriple = session.result === 'triple';

    let label = 'TÀI';
    let resCls = 'badge-tai';
    let moodCls = 'robot-mood-tai';

    if (isXiu) {
      label = 'XỈU';
      resCls = 'badge-xiu';
      moodCls = 'robot-mood-xiu';
    } else if (isTriple) {
      label = 'BỘ BA';
      resCls = 'badge-triple';
      moodCls = 'robot-mood-triple';
    }

    // 1. BIỂU CẢM & HIỆU ỨNG ÁNH SÁNG CON ROBOT
    if (avatar) {
      avatar.classList.remove('robot-mood-tai', 'robot-mood-xiu', 'robot-mood-triple');
      avatar.classList.add(moodCls);
      avatar.classList.add('robot-bounce');
      setTimeout(() => avatar.classList.remove('robot-bounce'), 800);
    }

    if (pillText) {
      pillText.textContent = `${label} ${session.sum}đ`;
    }

    // Nếu bảng bên cạnh đang bị thu gọn, hiển thị Quick Tag bên cạnh robot trong 6 giây
    if (quickTag) {
      if (quickTagRes) {
        quickTagRes.textContent = `${label} ${session.sum}đ [${session.dice.join('-')}]`;
      }
      if (quickTagNext && forecast) {
        quickTagNext.textContent = `Phiên sau ${forecast.nextSessionId} • ${forecast.trendBadge}`;
      }
      const quickTagDecision = document.getElementById('txQuickTagDecision');
      if (quickTagDecision && forecast) {
        quickTagDecision.textContent = `🎯 Ván sau: ${forecast.decision} (${forecast.confidence})`;
        quickTagDecision.className = `tx-tag-decision ${forecast.decisionClass}`;
      }
      if (!watcherState.settings.bubbleVisible) {
        quickTag.style.display = 'block';
        quickTag.className = `tx-robot-quick-tag tag-${session.result} animate-pop`;
        if (watcherState.bubbleTimeout) clearTimeout(watcherState.bubbleTimeout);
        watcherState.bubbleTimeout = setTimeout(() => {
          quickTag.style.display = 'none';
        }, 6500);
      }
    }

    // 2. BẢNG BÁO KẾT QUẢ Ở BÊN CẠNH
    if (sIdEl) sIdEl.textContent = `Phiên vừa xong: ${session.sessionId || ('#' + watcherState.currentSessionNumber)}`;
    if (d1El && session.dice) d1El.textContent = session.dice[0];
    if (d2El && session.dice) d2El.textContent = session.dice[1];
    if (d3El && session.dice) d3El.textContent = session.dice[2];
    if (sumEl) sumEl.textContent = `Tổng: ${session.sum}`;

    if (badgeEl) {
      badgeEl.textContent = `${label} (${session.sum}đ)`;
      badgeEl.className = `tx-res-badge ${resCls}`;
    }

    if (patEl) {
      patEl.textContent = forecast ? `🎲 Thế cầu: ${forecast.pattern}` : '🎲 Cầu ngẫu nhiên tự nhiên';
    }

    // Khối dự báo phiên tiếp theo
    if (nextIdEl && forecast) nextIdEl.textContent = `Phiên kế tiếp: ${forecast.nextSessionId}`;
    if (nextBadgeEl && forecast) nextBadgeEl.textContent = forecast.trendBadge;
    if (nextAdviceEl && forecast) nextAdviceEl.textContent = forecast.trendAdvice;

    const chipTai = document.getElementById('txProbChipTai');
    const chipXiu = document.getElementById('txProbChipXiu');
    if (chipTai && forecast) chipTai.innerHTML = `Tài: <strong>${forecast.probTheoTai}</strong>`;
    if (chipXiu && forecast) chipXiu.innerHTML = `Xỉu: <strong>${forecast.probTheoXiu}</strong>`;

    // Cập nhật Banner Quyết Định & Chuỗi ván trước đã soi
    const decVal = document.getElementById('txDecisionVal');
    const decConf = document.getElementById('txDecisionConf');
    const decBanner = document.getElementById('txDecisionBanner');
    if (decVal && forecast) decVal.textContent = forecast.decision;
    if (decConf && forecast) decConf.textContent = `(${forecast.confidence})`;
    if (decBanner && forecast) {
      decBanner.className = `tx-decision-banner ${forecast.decisionClass}`;
    }

    const revSeq = document.getElementById('txReviewSeq');
    if (revSeq && forecast) {
      revSeq.textContent = forecast.recent5Symbols || 'Đang tích lũy chuỗi';
    }

    // Hiệu ứng phát sáng đường viền bảng bên cạnh
    if (sidePanel) {
      sidePanel.classList.remove('border-tai', 'border-xiu', 'border-triple');
      if (isTai) sidePanel.classList.add('border-tai');
      else if (isXiu) sidePanel.classList.add('border-xiu');
      else sidePanel.classList.add('border-triple');

      sidePanel.classList.add('panel-pop');
      setTimeout(() => sidePanel.classList.remove('panel-pop'), 400);
    }

    // Vẽ chuỗi hạt lịch sử Bead Road
    const beadRow = document.getElementById('txHudBeadRow');
    if (beadRow) {
      beadRow.innerHTML = '';
      const recent = watcherState.sessions.slice(-12);
      recent.forEach(s => {
        const dot = document.createElement('span');
        dot.className = `tx-mini-bead bead-${s.result}`;
        dot.textContent = s.result === 'tai' ? 'T' : (s.result === 'xiu' ? 'X' : 'B');
        dot.title = `Phiên: ${s.sessionId || ''} | ${s.result.toUpperCase()} ${s.sum}đ (${s.dice ? s.dice.join('-') : ''})`;
        beadRow.appendChild(dot);
      });
    }
  }

  // ==========================================
  // Khởi động Scanner, Hook & Observer
  // ==========================================
  function init() {
    injectMainWorldHook();
    injectRobotHud();

    const observer = new MutationObserver(() => {
      scanPageForResults();
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    setInterval(scanPageForResults, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
