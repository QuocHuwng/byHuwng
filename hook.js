/**
 * TAI XIU PRO - Main World WebSocket & Game Sniffer Hook
 * Injected into the page's main world context to intercept live game packets,
 * session numbers (#3340096), dice results, and countdown clocks from game servers.
 */

(function () {
  'use strict';

  if (window.__TAI_XIU_HOOK_ACTIVE__) return;
  window.__TAI_XIU_HOOK_ACTIVE__ = true;

  console.log('[TAI XIU PRO] Live Game Hook đã được kích hoạt.');

  // Hook Native WebSocket
  const OriginalWebSocket = window.WebSocket;

  window.WebSocket = function (url, protocols) {
    const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);

    ws.addEventListener('message', function (event) {
      try {
        let rawData = event.data;

        // If ArrayBuffer / Blob, try text decode
        if (rawData instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => parseMessageString(reader.result);
          reader.readAsText(rawData);
          return;
        }

        if (typeof rawData === 'string') {
          parseMessageString(rawData);
        }
      } catch (err) {
        // pass
      }
    });

    return ws;
  };

  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;

  function parseMessageString(text) {
    if (!text || text.length < 5) return;

    // 1. JSON Packet format
    if (text.startsWith('{') || text.includes('{')) {
      try {
        // extract json sub-string if wrapped
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonStr = text.substring(firstBrace, lastBrace + 1);
          const obj = JSON.parse(jsonStr);
          inspectGameObject(obj);
        }
      } catch (e) {
        // ignore parse error for non-json
      }
    }

    // 2. Text regex format for games using custom pipe / comma protocols
    // e.g. "3340096,6,2,5,13" or "#3340096|Tài|6|2|5"
    const matchLine = text.match(/(?:#?([0-9]{5,10}))[,\s|]+(?:Tài|Xỉu|1|2)?[,\s|]*([1-6])[,\s|]+([1-6])[,\s|]+([1-6])/i);
    if (matchLine) {
      dispatchSessionFound({
        sessionId: '#' + matchLine[1],
        d1: parseInt(matchLine[2], 10),
        d2: parseInt(matchLine[3], 10),
        d3: parseInt(matchLine[4], 10)
      });
    }
  }

  function inspectGameObject(obj) {
    if (!obj || typeof obj !== 'object') return;

    // Search for dice arrays: e.g. [6, 2, 5]
    let dice = null;
    let sessionId = null;

    // Check common key names
    const diceKeys = ['dice', 'dices', 'result', 'diceResult', 'diceList', 'xiNgau', 'x'];
    for (const k of diceKeys) {
      if (Array.isArray(obj[k]) && obj[k].length === 3 && obj[k].every(d => d >= 1 && d <= 6)) {
        dice = obj[k];
        break;
      }
    }

    // Check individual d1, d2, d3 or x1, x2, x3
    if (!dice) {
      const d1 = obj.d1 || obj.x1 || obj.dice1;
      const d2 = obj.d2 || obj.x2 || obj.dice2;
      const d3 = obj.d3 || obj.x3 || obj.dice3;
      if ([d1, d2, d3].every(d => Number.isInteger(d) && d >= 1 && d <= 6)) {
        dice = [d1, d2, d3];
      }
    }

    // Search for session ID
    const sessionKeys = ['sessionId', 'sessionID', 'session', 'phien', 'phienId', 'id', 'sid', 'roundId'];
    for (const k of sessionKeys) {
      if (obj[k] && (typeof obj[k] === 'number' || typeof obj[k] === 'string')) {
        const strVal = String(obj[k]);
        if (/^[0-9]{5,10}$/.test(strVal)) {
          sessionId = '#' + strVal;
          break;
        }
      }
    }

    if (dice && dice.length === 3) {
      dispatchSessionFound({
        sessionId: sessionId,
        d1: dice[0],
        d2: dice[1],
        d3: dice[2]
      });
    }
  }

  function dispatchSessionFound(data) {
    window.postMessage({
      source: 'TAI_XIU_PRO_HOOK',
      type: 'LIVE_RESULT_DETECTED',
      payload: data
    }, '*');
  }
})();
