// Minimal background - kept alive ping only
// All fetching is done directly from popup.js which also has host_permissions
chrome.runtime.onInstalled.addListener(() => {
  console.log('SET Stock Analyzer installed');
});
