// background.js

const ALLOWED_FORMATS = new Set(['pdb', 'mmcif', 'gro', 'mol', 'mol2', 'sdf', 'xyz', 'bcif']);

function isSafeUrl(urlStr) {
    try {
        const u = new URL(urlStr);
        return u.protocol === 'https:';
    } catch {
        return false;
    }
}

// FEATURE 1: Create the Context Menu on installation
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "open-molstar",
        title: "Open in Mol* Workspace",
        contexts: ["link"] // Only appears when right-clicking a link
    });
});

// FEATURE 2: Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "open-molstar" && info.linkUrl) {
        if (!isSafeUrl(info.linkUrl)) {
            console.warn('Mol* Linker: Blocked unsafe context menu URL:', info.linkUrl);
            return;
        }
        
        // Because we couldn't scrape the DOM, we pass 'unknown' as the format.
        // The viewer will catch this and prompt the user.
        const viewerUrl = chrome.runtime.getURL(
            `viewer.html?fileUrl=${encodeURIComponent(info.linkUrl)}&format=unknown`
        );
    chrome.tabs.create({ url: viewerUrl });
    }
});

// ORIGINAL: Handle standard Content Script Clicks
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.action !== "open_viewer") return;
    if (!sender.tab || !sender.tab.id) return;
    if (!message.url || !isSafeUrl(message.url)) return;
    if (!ALLOWED_FORMATS.has(message.format)) return;

    const viewerUrl = chrome.runtime.getURL(
        `viewer.html?fileUrl=${encodeURIComponent(message.url)}&format=${encodeURIComponent(message.format)}`
    );
    chrome.tabs.create({ url: viewerUrl });
});

// FEATURE 3: Dynamic Permissions Injector
// When a user authorizes a new Custom Domain via the extension popup, 
// dynamically register the content script to run there in the future!
chrome.permissions.onAdded.addListener((permissions) => {
    if (permissions.origins && permissions.origins.length > 0) {
        if (chrome.scripting && chrome.scripting.registerContentScripts) {
            chrome.scripting.registerContentScripts([{
                id: `dynamic-molstar-${Date.now()}`,
                matches: permissions.origins,
                js: ["content.js"],
                runAt: "document_end"
            }]).catch(err => console.error("Dynamic Script Registration Failed:", err));
        }
    }
});
