// content.js

const SUPPORTED_EXT = new Set(['.pdb','.cif','.mmcif','.gro','.mol','.mol2','.sdf','.xyz','.ent','.bcif']);
const MAX_URL_LENGTH = 2048; 

const GITLAB_PATTERNS = [{
  regex: /^https?:\/\/([^/]+)\/(.+?)\/-\/(?:blob|raw)\/([^/]+)\/(.+)$/,
  buildApiUrl: (domain, ns, ref, fp) =>
    `https://${domain}/api/v4/projects/${encodeURIComponent(ns)}/repository/files/${encodeURIComponent(fp)}/raw?ref=${encodeURIComponent(ref)}`
}];

// Helper: Fast text search for generalized DOM scraping
function extractExtensionFromText(text) {
  if (!text) return null;
  const lowerText = text.toLowerCase();
  for (let ext of SUPPORTED_EXT) {
    if (lowerText.includes(ext)) return ext;
  }
  return null;
}

// Helper: Strict Regex search for standard URLs
function extractExtensionFromUrl(urlStr) {
  for (let ext of SUPPORTED_EXT) {
    if (new RegExp(`\\${ext}(?:[?#&]|$)`, 'i').test(urlStr)) return ext;
  }
  return null;
}

function getStructureInfo(href, linkElement) {
  if (!href || href.length > MAX_URL_LENGTH) return null;

  let parsedUrl;
  try { parsedUrl = new URL(href, window.location.origin); } 
  catch (e) { return null; }

  if (parsedUrl.protocol !== 'https:') return null;
  if (parsedUrl.hash) return null; 

  // Step 1: Standard URL check (GitHub, GitLab, RCSB)
  let extWithQuery = extractExtensionFromUrl(parsedUrl.href);

  // Step 2: The Generalized "3-Ring" DOM Scanner for Opaque URLs
  if (!extWithQuery && linkElement) {
    
    // Ring 1: The link text itself (e.g., <button>Download SITO.pdb</button>)
    extWithQuery = extractExtensionFromText(linkElement.textContent);
    
    // Ring 2: Standard HTML Attributes (title, download, etc.)
    if (!extWithQuery) {
        const attrStr = (linkElement.title || '') + ' ' + 
                        (linkElement.getAttribute('download') || '') + ' ' + 
                        (linkElement.getAttribute('data-filename') || '');
        extWithQuery = extractExtensionFromText(attrStr);
    }
    
    // Ring 2.5: Closest parent container with a 'title' attribute (Figshare pattern)
    if (!extWithQuery) {
        const titleContainer = linkElement.closest('[title]');
        if (titleContainer) extWithQuery = extractExtensionFromText(titleContainer.title);
    }

    // Ring 3: The immediate parent's visible text
    if (!extWithQuery) {
        const parent = linkElement.parentElement;
        // Cap at 500 characters so we don't accidentally parse a massive paragraph of text
        if (parent && parent.textContent && parent.textContent.length < 500) {
            extWithQuery = extractExtensionFromText(parent.textContent);
        }
    }
  }

  if (!extWithQuery) return null; // If it failed all 3 rings, it's not a structure file
  const formatStr = extWithQuery === '.cif' ? 'mmcif' : extWithQuery.slice(1);
  const cleanUrl = parsedUrl.origin + parsedUrl.pathname; 

  // Reject Git UI pages that aren't physical raw files
  if (['/blame/', '/commits/', '/commit/', '/edit/', '/tree/', '/network/', '/compare/'].some(p => cleanUrl.includes(p))) return null;

  if (cleanUrl.includes('github.com')) {
    const rawUrl = cleanUrl
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/')
      .replace('/raw/', '/');
    return { rawUrl, formatStr };
  }

  for (const p of GITLAB_PATTERNS) {
    const match = cleanUrl.match(p.regex); 
    if (match) return { rawUrl: p.buildApiUrl(match[1], match[2], match[3], match[4]), formatStr };
  }

  return { rawUrl: parsedUrl.href, formatStr }; 
}

function makeBadge(rawUrl, formatStr, originalHref) {
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.textContent = 'Mol* (Workspace)';
  badge.dataset.msBadge = 'true';
  badge.dataset.originalHref = originalHref;
  
  const blockEvent = (e) => { e.preventDefault(); e.stopPropagation(); };

  badge.addEventListener('click', (e) => {
    blockEvent(e);
    try {
      if (!rawUrl.startsWith('https://')) return; 
      chrome.runtime.sendMessage({ action: "open_viewer", url: rawUrl, format: formatStr });
    } catch (err) {
      if (err.message.includes("Extension context invalidated")) {
        alert("Mol* Linker has been updated. Please refresh this page to open the workspace.");
      } else {
        console.error("Mol* Workspace Error:", err);
      }
    }
  });
  
  badge.addEventListener('mousedown', blockEvent);
  badge.addEventListener('mouseup', blockEvent);
  
  Object.assign(badge.style, {
    marginLeft: '6px', fontSize: '10px', border: 'none',
    backgroundColor: rawUrl.includes('gitlab') ? '#6a1b9a' : '#2da44e',
    color: 'white', padding: '2px 6px', borderRadius: '3px',
    textDecoration: 'none', fontWeight: 'bold', display: 'inline-block',
    verticalAlign: 'middle', cursor: 'pointer', lineHeight: 'normal'
  });
  return badge;
}

function injectMolstarLinker() {
  observer.disconnect();
  try {
    document.querySelectorAll('a[href]:not([data-ms-badge])').forEach(a => {
      if (a.dataset.msProcessed === 'true') return;
      
      const text = a.textContent.trim();
      if (/^\d+$/.test(text)) {
        a.dataset.msProcessed = 'true';
        return;
      }
      
      const info = getStructureInfo(a.href, a); // Passing the DOM element here!
      if (!info) {
        a.dataset.msProcessed = 'true';
        return;
      }
      
      const parent = a.parentNode;
      if (parent && Array.from(parent.children).some(node => node.dataset.msBadge === 'true' && node.dataset.originalHref === a.href)) {
        a.dataset.msProcessed = 'true';
        return;
      }

      a.dataset.msProcessed = 'true';
      a.insertAdjacentElement('afterend', makeBadge(info.rawUrl, info.formatStr, a.href));
    });
  } catch (e) { console.warn("Mol* Linker Error:", e); }
  
  observer.observe(document.body, { childList: true, subtree: true });
}

let debounceTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(injectMolstarLinker, 500);
});
observer.observe(document.body, { childList: true, subtree: true });
injectMolstarLinker();
