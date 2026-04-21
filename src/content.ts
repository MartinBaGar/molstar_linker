// src/content.ts

// 1. NO IMPORTS AT ALL. This guarantees TS treats this as a "Classic Script"
interface LocalExtensionMessage {
    action: "open_viewer" | string;
    url?: string;
    format?: string;
}

// Define the supported extensions for the scanner
const SUPPORTED_EXTENSIONS = ['.pdb', '.cif', '.mmcif', '.bcif', '.gro', '.sdf', '.mol', '.mol2', '.xyz', '.ent'];

/**
 * The Smart Scanner: Identifies structural links while ignoring Git UI clutter
 */
function scanAndInject() {
    // Look for all anchor tags on the page
    const links = document.querySelectorAll('a');

    links.forEach((link: HTMLAnchorElement) => {
        // Skip if we already injected a badge here
        if (link.dataset.molstarInjected) return;

        const href = link.href.toLowerCase();
        const text = link.textContent?.toLowerCase() || '';

        // 1. Identify if the link points to a supported structural file
        const hasExtension = SUPPORTED_EXTENSIONS.some(ext => href.endsWith(ext) || text.includes(ext));
        
        // 2. Filter out Git UI elements like blame, commits, or anchor jumps
        const isGitUI = href.includes('/blame/') || href.includes('/commits/') || href.includes('#');

        if (hasExtension && !isGitUI) {
            injectBadge(link);
        }
    });
}

/**
 * Injects the green Mol* (MVS) badge next to the link
 */
function injectBadge(anchor: HTMLAnchorElement) {
    const badge = document.createElement('button');
    badge.innerText = 'Mol* (MVS)';
    badge.className = 'molstar-linker-badge'; // Styles should be in a global CSS or injected
    
    // Style the badge to match your brand
    badge.style.cssText = `
        background-color: #2da44e;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 2px 6px;
        margin-left: 8px;
        font-size: 10px;
        font-weight: bold;
        cursor: pointer;
        vertical-align: middle;
    `;

    badge.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent SPA navigation

        const message: LocalExtensionMessage = {
            action: 'open_viewer',
            url: anchor.href,
            format: anchor.href.split('.').pop()
        };

        // Send the request to the background router
        chrome.runtime.sendMessage(message);
    });

    anchor.parentNode?.insertBefore(badge, anchor.nextSibling);
    anchor.dataset.molstarInjected = 'true';
}

// Initial scan
scanAndInject();

// Handle SPA navigation (GitHub/GitLab) without page reloads
const observer = new MutationObserver(() => scanAndInject());
observer.observe(document.body, { childList: true, subtree: true });
