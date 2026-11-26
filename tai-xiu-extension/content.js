/**
 * TAI XIU PRO - Live Game Watcher, Auto-Sniffer & Next Session Calculator
 * - Intercepts WebSocket & DOM text (Mã phiên #3340096, xúc xắc 6-2-5)
 * - Records & announces the finished session (Phiên vừa xong)
 * - Calculates mathematical probabilities & trend forecast for the NEXT session (Phiên tiếp theo #3340097)
 * - Dual-Panel Big On-Screen Alert Banner
 * - Vietnamese Voice Announcer & Web Audio Chime
 */

(function () {
  'use strict';

  if (window.__TAI_XIU_PRO_INJECTED__) return;
  window.__TAI_XIU_PRO_INJECTED__ = true;

  // Local state
  const watcherState = {
    sessions: [],
    settings: {
      voiceEnabled: true,
      notifyEnabled: true,
      onScreenAlert: true,
      autoDetect: true,
      hudVisible: true
    },
    lastDetectedSessionId: null,
    currentSessionNumber: 3340096, // default base seed
    bannerTimeout: null
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
      console.warn('[TAI XIU PRO] Hook injection note:', e);
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

    // 2. Xác suất toán học lý thuyết tiên nghiệm
    const probTheoTai = '48,61%';
    const probTheoXiu = '48,61%';
    const probTheoTriple = '2,78%';

    // 3. Phân tích thế cầu phiên tiếp theo
    const pattern = detectPatternName(history);
    let trendAdvice = 'Xác suất 2 cửa cân bằng';
    let trendBadge = 'Cầu Tự Nhiên';

    if (pattern.includes('Cầu Bệt')) {
      const isBetTai = pattern.includes('Tài');
      trendBadge = isBetTai ? 'Theo Bệt Tài' : 'Theo Bệt Xỉu';
      trendAdvice = `Đang bệt dài. Người chơi thường theo bệt hoặc chờ bẻ cầu; toán học khẳng định xác suất ván sau vẫn độc lập 48,61%.`;
    } else if (pattern.includes('Cầu Đảo')) {
      const nextSuggest = finishedSession.result === 'tai' ? 'XỈU' : 'TÀI';
      trendBadge = `Theo Đảo ➔ ${nextSuggest}`;
      trendAdvice = `Đang có nhịp xen kẽ Tài - Xỉu. Nếu theo nhịp đảo thì phiên tiếp theo là ${nextSuggest}.`;
    } else if (pattern.includes('2-2')) {
      trendBadge = 'Theo Nhịp 2-2';
      trendAdvice = 'Nhịp cầu cặp đôi. Quan sát phiên chẵn lẻ.';
    }

    // 4. Thống kê tỷ lệ 20 phiên gần nhất
    const recent20 = history.slice(-20);
    const countTai = recent20.filter(s => s.result === 'tai').length;
    const countXiu = recent20.filter(s => s.result === 'xiu').length;

    return {
      nextSessionId,
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
  // Crystal Audio Chime (Web Audio API)
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
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.1);
      gain2.gain.setValueAtTime(0.3, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.55);

      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1046.50, now + 0.2);
      gain3.gain.setValueAtTime(0.35, now + 0.2);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.2);
      osc3.stop(now + 0.85);
    } catch (e) {
      // pass
    }
  }

  // ==========================================
  // Vietnamese Voice Announcer (Speech Synthesis)
  // ==========================================
  function speakVietnamese(text) {
    if (!watcherState.settings.voiceEnabled) return;
    if (!window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find(v => v.lang.includes('vi') || v.lang.includes('VN'));
      if (viVoice) utterance.voice = viVoice;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      // pass
    }
  }

  // ==========================================
  // DUAL-PANEL BIG ON-SCREEN ALERT BANNER
  // (Báo phiên vừa xong + Tính tới phiên tiếp theo)
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
        <span class="tx-banner-tag-badge">🎲 THÔNG BÁO BÀN CƯỢC TÀI XỈU</span>
        <button class="tx-banner-close" title="Đóng">✕</button>
      </div>

      <div class="tx-banner-dual-grid">
        <!-- CỘT 1: KẾT QUẢ PHIÊN VỪA XONG -->
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
          <div class="tx-col-label">DỰ BÁO PHIÊN TIẾP THEO: ${forecast.nextSessionId}</div>
          <div class="tx-col-trend-badge">${forecast.trendBadge}</div>
          <div class="tx-col-prob-row">
            <span class="tx-prob-pill prob-tai">Tài: 48,61%</span>
            <span class="tx-prob-pill prob-xiu">Xỉu: 48,61%</span>
            <span class="tx-prob-pill prob-b3">Bộ 3: 2,78%</span>
          </div>
          <div class="tx-col-sub tx-col-advice">⚖️ ${forecast.trendAdvice}</div>
        </div>
      </div>

      <div class="tx-banner-timer-bar"></div>
    `;

    // Click to dismiss
    const closeBtn = banner.querySelector('.tx-banner-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissBanner(banner);
    });

    banner.addEventListener('click', () => {
      dismissBanner(banner);
    });

    // Auto dismiss after 6 seconds
    watcherState.bannerTimeout = setTimeout(() => {
      dismissBanner(banner);
    }, 6000);
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
  // Xử lý khi bắt được kết quả phiên vừa xong
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

    // 1. CHIME
    playCasinoChime();

    // 2. DUAL ON-SCREEN ALERT BANNER
    showDualOnScreenBanner(newSession, forecast);

    // 3. VOICE ANNOUNCER: Đọc cả phiên vừa xong và phiên tiếp theo
    const label = roll.result === 'tai' ? 'Tài' : (roll.result === 'xiu' ? 'Xỉu' : 'Bộ ba');
    const sIdClean = newSession.sessionId ? newSession.sessionId.replace('#', '') : '';
    const nextClean = forecast.nextSessionId.replace('#', '');

    const voiceText = `Phiên ${sIdClean} vừa xong về ${label} ${roll.sum} điểm: ${d1}, ${d2}, ${d3}. Chuẩn bị phiên tiếp theo ${nextClean}: Xác suất toán học Tài 48,61%, Xỉu 48,61%.`;
    speakVietnamese(voiceText);

    // 4. DESKTOP NOTIFICATION
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'SHOW_NOTIFICATION',
        title: `🎲 byHuwng: Phiên ${newSession.sessionId}: ${label.toUpperCase()} ${roll.sum} điểm [${d1}-${d2}-${d3}]`,
        body: `Phiên tiếp theo ${forecast.nextSessionId} | ${forecast.trendBadge} | ${forecast.historySummary}`
      });
    }

    // 5. UPDATE HUD
    updateHudUi(newSession, forecast);
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
  // Inject Floating HUD Widget
  // ==========================================
  function injectFloatingHud() {
    if (document.getElementById('taixiu-pro-hud')) return;

    const hud = document.createElement('div');
    hud.id = 'taixiu-pro-hud';
    hud.className = 'tx-pro-hud';
    hud.innerHTML = `
      <div class="tx-hud-header" id="txHudHeader">
        <div class="tx-hud-brand">
          <span class="tx-hud-logo">🎲</span>
          <span class="tx-hud-title">byHuwng</span>
          <span class="tx-hud-badge-live">LIVE</span>
        </div>
        <div class="tx-hud-controls">
          <button id="txHudBannerBtn" class="tx-hud-btn active" title="Bật/Tắt thông báo to trên màn hình">🖥️</button>
          <button id="txHudVoiceBtn" class="tx-hud-btn active" title="Bật/Tắt giọng đọc kết quả">🔊</button>
          <button id="txHudNotifyBtn" class="tx-hud-btn active" title="Bật/Tắt thông báo Windows">🔔</button>
          <button id="txHudMinBtn" class="tx-hud-btn" title="Thu nhỏ">_</button>
          <button id="txHudCloseBtn" class="tx-hud-btn" title="Đóng">✕</button>
        </div>
      </div>

      <div class="tx-hud-body" id="txHudBody">
        <!-- THẺ 1: PHIÊN VỪA XONG -->
        <div class="tx-hud-card" id="txHudResultCard">
          <div class="tx-hud-row">
            <span class="tx-hud-session" id="txHudSessionId">Phiên vừa xong: #3340096</span>
            <span class="tx-hud-badge-res badge-tai" id="txHudBadgeRes">TÀI (13đ)</span>
          </div>
          <div class="tx-hud-dice-row">
            <div class="tx-hud-die" id="txHudDie1">6</div>
            <div class="tx-hud-die" id="txHudDie2">2</div>
            <div class="tx-hud-die" id="txHudDie3">5</div>
            <span class="tx-hud-sum" id="txHudSum">Tổng: 13</span>
          </div>
          <div class="tx-hud-pattern" id="txHudPattern">Đang theo dõi bảng cầu...</div>
        </div>

        <!-- THẺ 2: TÍNH TOÁN PHIÊN TIẾP THEO -->
        <div class="tx-hud-next-card" id="txHudNextCard">
          <div class="tx-next-title-row">
            <span class="tx-next-id" id="txNextSessionId">Phiên kế tiếp: #3340097</span>
            <span class="tx-next-badge" id="txNextTrendBadge">DỰ BÁO CẦU</span>
          </div>
          <div class="tx-next-probs">
            <span>Tài: <strong>48,61%</strong></span> • 
            <span>Xỉu: <strong>48,61%</strong></span> • 
            <span>Bộ 3: <strong>2,78%</strong></span>
          </div>
          <div class="tx-next-advice" id="txNextAdvice">Biến cố độc lập: Xác suất 2 cửa cân bằng</div>
        </div>

        <!-- Quick 1-Click Entry for Canvas Games -->
        <div class="tx-hud-quick-section">
          <div class="tx-hud-quick-label">Bấm Báo Kết Quả & Tính Tiếp:</div>
          <div class="tx-hud-btn-row">
            <button id="txQuickTai" class="tx-btn-quick tx-btn-tai">⚡ TÀI (13đ)</button>
            <button id="txQuickXiu" class="tx-btn-quick tx-btn-xiu">⚡ XỈU (8đ)</button>
            <button id="txQuickTriple" class="tx-btn-quick tx-btn-triple">⚡ BỘ BA</button>
          </div>
          <div class="tx-hud-input-row">
            <input type="text" id="txManualDiceInput" placeholder="Nhập 3 xúc xắc (vd: 625) & Enter" maxlength="12">
            <button id="txManualSubmitBtn" class="tx-btn-sub">Báo</button>
          </div>
        </div>

        <!-- Mini Bead Road -->
        <div class="tx-hud-bead-row" id="txHudBeadRow">
          <!-- Mini Bead dots -->
        </div>
      </div>

      <!-- Minimized Floating Action Icon -->
      <div class="tx-hud-minimized" id="txHudMinimized" style="display: none;">
        <span class="tx-min-icon">🎲</span>
        <span class="tx-min-text" id="txMinText">byHuwng</span>
      </div>
    `;

    document.body.appendChild(hud);
    setupHudDraggable(hud);
    setupHudListeners(hud);

    // Initial render from storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['sessions', 'settings'], (res) => {
        if (res.sessions && res.sessions.length > 0) {
          watcherState.sessions = res.sessions;
          const last = res.sessions[res.sessions.length - 1];
          const forecast = calcNextSessionForecast(last, res.sessions);
          updateHudUi(last, forecast);
        }
      });
    }
  }

  function setupHudDraggable(hud) {
    const header = hud.querySelector('#txHudHeader');
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = hud.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      hud.style.left = `${initialLeft + dx}px`;
      hud.style.top = `${initialTop + dy}px`;
      hud.style.right = 'auto';
      hud.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  function setupHudListeners(hud) {
    const minBtn = hud.querySelector('#txHudMinBtn');
    const closeBtn = hud.querySelector('#txHudCloseBtn');
    const body = hud.querySelector('#txHudBody');
    const header = hud.querySelector('#txHudHeader');
    const minView = hud.querySelector('#txHudMinimized');

    const bannerBtn = hud.querySelector('#txHudBannerBtn');
    const voiceBtn = hud.querySelector('#txHudVoiceBtn');
    const notifyBtn = hud.querySelector('#txHudNotifyBtn');

    minBtn.addEventListener('click', () => {
      body.style.display = 'none';
      header.style.display = 'none';
      minView.style.display = 'flex';
      hud.classList.add('is-minimized');
    });

    minView.addEventListener('click', () => {
      body.style.display = 'block';
      header.style.display = 'flex';
      minView.style.display = 'none';
      hud.classList.remove('is-minimized');
    });

    closeBtn.addEventListener('click', () => {
      hud.style.display = 'none';
    });

    bannerBtn.addEventListener('click', () => {
      watcherState.settings.onScreenAlert = !watcherState.settings.onScreenAlert;
      bannerBtn.classList.toggle('active', watcherState.settings.onScreenAlert);
    });

    voiceBtn.addEventListener('click', () => {
      watcherState.settings.voiceEnabled = !watcherState.settings.voiceEnabled;
      voiceBtn.classList.toggle('active', watcherState.settings.voiceEnabled);
      voiceBtn.textContent = watcherState.settings.voiceEnabled ? '🔊' : '🔇';
      speakVietnamese(watcherState.settings.voiceEnabled ? 'Đã bật giọng đọc' : 'Đã tắt giọng đọc');
    });

    notifyBtn.addEventListener('click', () => {
      watcherState.settings.notifyEnabled = !watcherState.settings.notifyEnabled;
      notifyBtn.classList.toggle('active', watcherState.settings.notifyEnabled);
      notifyBtn.textContent = watcherState.settings.notifyEnabled ? '🔔' : '🔕';
    });

    // Quick Add Buttons: e.g. 6-2-5 (Tài 13) from user's image!
    const quickTai = hud.querySelector('#txQuickTai');
    quickTai.addEventListener('click', () => {
      handleFinishedSession(null, 6, 2, 5); // Tài 13 (6-2-5)
    });

    const quickXiu = hud.querySelector('#txQuickXiu');
    quickXiu.addEventListener('click', () => {
      handleFinishedSession(null, 2, 3, 3); // Xỉu 8 (2-3-3)
    });

    const quickTriple = hud.querySelector('#txQuickTriple');
    quickTriple.addEventListener('click', () => {
      const v = (Math.random() * 6 | 0) + 1;
      handleFinishedSession(null, v, v, v);
    });

    // Manual Input: supports "625" or "3340096 625"
    const input = hud.querySelector('#txManualDiceInput');
    const submit = hud.querySelector('#txManualSubmitBtn');

    const submitManual = () => {
      const raw = input.value.trim();
      let customSessionId = null;
      let diceStr = raw;

      // Check if session ID was also entered, e.g. "#3340096 625"
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
        input.value = '';
        return;
      }
      alert('Vui lòng gõ 3 số xúc xắc từ 1 đến 6 (ví dụ: 625 hoặc #3340096 625)');
    };

    submit.addEventListener('click', submitManual);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitManual();
    });
  }

  function updateHudUi(session, forecast) {
    if (!session) return;

    const sIdEl = document.getElementById('txHudSessionId');
    const badgeEl = document.getElementById('txHudBadgeRes');
    const d1El = document.getElementById('txHudDie1');
    const d2El = document.getElementById('txHudDie2');
    const d3El = document.getElementById('txHudDie3');
    const sumEl = document.getElementById('txHudSum');
    const patEl = document.getElementById('txHudPattern');
    const minText = document.getElementById('txMinText');

    // Next session elements
    const nextIdEl = document.getElementById('txNextSessionId');
    const nextBadgeEl = document.getElementById('txNextTrendBadge');
    const nextAdviceEl = document.getElementById('txNextAdvice');

    if (sIdEl) sIdEl.textContent = `Phiên vừa xong: ${session.sessionId || ('#' + watcherState.currentSessionNumber)}`;
    if (d1El && session.dice) d1El.textContent = session.dice[0];
    if (d2El && session.dice) d2El.textContent = session.dice[1];
    if (d3El && session.dice) d3El.textContent = session.dice[2];
    if (sumEl) sumEl.textContent = `Tổng: ${session.sum}`;

    let label = 'TÀI';
    let cls = 'badge-tai';
    if (session.result === 'triple') {
      label = 'BỘ BA';
      cls = 'badge-triple';
    } else if (session.result === 'xiu') {
      label = 'XỈU';
      cls = 'badge-xiu';
    }

    if (badgeEl) {
      badgeEl.textContent = `${label} (${session.sum}đ)`;
      badgeEl.className = `tx-hud-badge-res ${cls}`;
    }

    if (patEl) {
      patEl.textContent = forecast ? forecast.pattern : 'Cầu ngẫu nhiên';
    }

    if (nextIdEl && forecast) nextIdEl.textContent = `Phiên kế tiếp: ${forecast.nextSessionId}`;
    if (nextBadgeEl && forecast) nextBadgeEl.textContent = forecast.trendBadge;
    if (nextAdviceEl && forecast) nextAdviceEl.textContent = forecast.trendAdvice;

    if (minText) {
      minText.textContent = `${label} (${session.sum}) ➔ ${forecast ? forecast.nextSessionId : ''}`;
    }

    // Render mini bead dots
    const beadRow = document.getElementById('txHudBeadRow');
    if (beadRow) {
      beadRow.innerHTML = '';
      const recent = watcherState.sessions.slice(-12);
      recent.forEach(s => {
        const dot = document.createElement('span');
        dot.className = `tx-mini-bead bead-${s.result}`;
        dot.textContent = s.result === 'tai' ? 'T' : (s.result === 'xiu' ? 'X' : 'B');
        dot.title = `Tổng: ${s.sum} (${s.dice ? s.dice.join('-') : ''})`;
        beadRow.appendChild(dot);
      });
    }
  }

  // ==========================================
  // Start Scanner, Hook & Observer
  // ==========================================
  function init() {
    injectMainWorldHook();
    injectFloatingHud();

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
