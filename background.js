/**
 * TAI XIU PRO - Background Service Worker (Manifest V3)
 * Manages extension lifecycle, storage sync, and Desktop Notifications.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[TAI XIU PRO] Tiện ích được cài đặt thành công.');
    
    // Check if initial storage is present
    chrome.storage.local.get(['sessions', 'settings'], (result) => {
      if (!result.sessions) {
        chrome.storage.local.set({ sessions: [] });
      }
      if (!result.settings) {
        chrome.storage.local.set({
          settings: {
            viewMode: 'compact',
            autoDetect: true,
            voiceEnabled: true,
            notifyEnabled: true,
            hudVisible: true
          }
        });
      }
    });
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Show system desktop notification
  if (message.action === 'SHOW_NOTIFICATION') {
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon128.png',
        title: message.title || 'byHuwng - Kết Quả Mới',
        message: message.body || 'Đã có kết quả phiên mới',
        priority: 2
      });
    }
    sendResponse({ success: true });
    return true;
  }

  // Open expanded popup in new tab
  if (message.action === 'OPEN_EXPANDED_TAB') {
    const url = chrome.runtime.getURL('popup.html?mode=expanded');
    chrome.tabs.create({ url });
    sendResponse({ success: true });
    return true;
  }

  return false;
});
