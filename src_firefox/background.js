// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "open_viewer" && message.url) {
    // Generate the URL for our internal extension tab
    const viewerUrl = chrome.runtime.getURL(
      `viewer.html?fileUrl=${encodeURIComponent(message.url)}&format=${message.format}`
    );
    
    // Open it in a new tab
    chrome.tabs.create({ url: viewerUrl });
    
    sendResponse({ status: "opened" });
  }
  return true; 
});
