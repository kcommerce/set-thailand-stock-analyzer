// SET Thailand Stock Analyzer — background.js

const SET_DOMAIN = "www.set.or.th";
const RULE_ID = 1;

/**
 * Configure declarativeNetRequest to spoof headers for SET.OR.TH requests.
 * This ensures the server sees the request as coming from its own domain,
 * bypassing common WAF (Incapsula) blocks.
 */
async function setupRequestRules() {
  const rules = [{
    id: RULE_ID,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        { header: "Referer", operation: "set", value: "https://www.set.or.th/" },
        { header: "Origin",  operation: "set", value: "https://www.set.or.th" },
        // Some APIs check for specific User-Agent, but extension default is usually OK.
        // We can add "User-Agent" here if needed.
      ]
    },
    condition: {
      urlFilter: `*://${SET_DOMAIN}/*`,
      resourceTypes: ["xmlhttprequest"]
    }
  }];

  try {
    // Get existing rules to avoid duplicates or conflicts
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existingRules.map(r => r.id);

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: rules
    });
    console.log("[SET] Request header rules applied successfully.");
  } catch (err) {
    console.error("[SET] Failed to apply request rules:", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("[SET] Stock Analyzer installed");
  setupRequestRules();
});

chrome.runtime.onStartup.addListener(() => {
  setupRequestRules();
});
