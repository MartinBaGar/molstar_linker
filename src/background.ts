// 1. Cross-browser compatibility (Firefox uses 'browser', Chrome uses 'chrome')
declare const browser: typeof chrome;
const extApi = typeof browser !== 'undefined' ? browser : chrome;

// 2. Define exactly what a message from content.ts is allowed to look like
export interface ExtensionMessage {
    action: "open_viewer" | string;
    url?: string;
    format?: string;
}

// 3. Listen for messages with strict typing
extApi.runtime.onMessage.addListener(
    (
        message: ExtensionMessage, 
        _sender: chrome.runtime.MessageSender, 
        sendResponse: (response?: any) => void
    ) => {
        
        // Handle the "Open Viewer" routing request
        if (message.action === 'open_viewer' && message.url) {
            
            const formatParam = message.format ? `&format=${encodeURIComponent(message.format)}` : '&format=unknown';
            
            // Build the URL pointing to our internal viewer.html
            const viewerUrl = extApi.runtime.getURL(`viewer.html?url=${encodeURIComponent(message.url)}${formatParam}`);
            
            // Open the new tab
            extApi.tabs.create({ url: viewerUrl })
                .then(() => sendResponse({ success: true }))
                .catch((error) => {
                    console.error("Mol* Linker Background Router Error:", error);
                    sendResponse({ success: false, error: String(error) });
                });

            // Return true to tell the browser we will send a response asynchronously via Promises
            return true;
        }

        // Catch-all for unknown actions
        sendResponse({ success: false, error: "Unknown action" });
        return false;
    }
);

// --- CONTEXT MENU SETUP ---
extApi.runtime.onInstalled.addListener(() => {
    extApi.contextMenus.create({
        id: "molstar-open-link",
        title: "Open in Mol* Workspace",
        contexts: ["link"] // Only show on links
    });
});

extApi.contextMenus.onClicked.addListener((info, _tab) => {
    if (info.menuItemId === "molstar-open-link" && info.linkUrl) {
        // Guess the format from the URL, or default to unknown
        const format = info.linkUrl.split('.').pop() || 'unknown';
        const viewerUrl = extApi.runtime.getURL(`viewer.html?url=${encodeURIComponent(info.linkUrl)}&format=${format}`);
        
        extApi.tabs.create({ url: viewerUrl });
    }
});
