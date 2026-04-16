// content.js

const StorageAPI = {
  core: typeof globalThis.browser !== 'undefined' ? globalThis.browser : chrome,
  get: function(keys, callback) { this.core.storage.sync.get(keys, callback); },
  set: function(data, callback) { this.core.storage.sync.set(data, callback); }
};

const SUPPORTED_EXT = new Set(['.pdb','.cif','.mmcif','.gro','.mol','.mol2','.sdf','.xyz','.ent','.bcif']);

const GITLAB_PATTERNS = [
  {
    regex: /^https?:\/\/([^/]+)\/(.+?)\/-\/(?:blob|raw)\/([^/]+)\/(.+)$/,
    buildApiUrl: (domain, ns, ref, fp) =>
      `https://${domain}/api/v4/projects/${encodeURIComponent(ns)}/repository/files/${encodeURIComponent(fp)}/raw?ref=${encodeURIComponent(ref)}`
  }
];

// Helper to intelligently find an extension even if hidden in query parameters (e.g. ?f=file.gro&name=...)
function extractExtension(urlStr) {
  for (let ext of SUPPORTED_EXT) {
    // Matches the extension followed by a ?, #, &, or the end of the string
    const regex = new RegExp(`\\${ext}(?:[?#&]|$)`, 'i');
    if (regex.test(urlStr)) return ext;
  }
  return null;
}

function getMolstarUrl(href, settings) {
  const ext = extractExtension(href);
  if (!ext) return null;
  const formatStr = ext.slice(1);

  // Parse the URL to ensure we handle it safely as an absolute link
  let parsedUrl;
  try {
    parsedUrl = new URL(href, window.location.origin);
  } catch (e) {
    return null; 
  }
  const urlStr = parsedUrl.href;

  // 1. Handle GitHub URLs
  if (urlStr.includes('github.com')) {
    let rawUrl = null;
    if (urlStr.includes('/blob/')) {
      rawUrl = urlStr.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    } else if (urlStr.includes('/raw/refs/heads/')) {
      rawUrl = urlStr.replace('github.com', 'raw.githubusercontent.com').replace('/raw/refs/heads/', '/');
    }
    if (rawUrl) return MvsBuilder.createViewerUrl(rawUrl, formatStr, settings);
  }

  // 2. Handle GitLab URLs
  for (const p of GITLAB_PATTERNS) {
    const match = urlStr.match(p.regex);
    if (!match) continue;
    const rawUrl = p.buildApiUrl(match[1], match[2], match[3], match[4]);
    return MvsBuilder.createViewerUrl(rawUrl, formatStr, settings);
  }

  // 3. Universal Fallback (for RCSB, ElabFTW, and Custom Domains)
  return MvsBuilder.createViewerUrl(urlStr, formatStr, settings);
}

function makeBadge(molstarUrl) {
  const badge = document.createElement('a');
  badge.textContent = 'Mol* (MVS)';
  badge.href = molstarUrl;
  badge.target = '_blank';
  badge.setAttribute('data-ms-badge', 'true');
  badge.onclick = (e) => e.stopPropagation();
  
  Object.assign(badge.style, {
    marginLeft: '6px',
    fontSize: '10px',
    backgroundColor: molstarUrl.includes('gitlab') ? '#6a1b9a' : '#2da44e',
    color: 'white',
    padding: '1px 5px',
    borderRadius: '3px',
    textDecoration: 'none',
    fontWeight: 'bold',
    display: 'inline-block',
    verticalAlign: 'middle'
  });
  return badge;
}

function injectMolstarLinker() {
  StorageAPI.get(AppConfig.getDefaults(), (settings) => {
    try {
      document.querySelectorAll('a[href]').forEach(a => {
        // SPA FIX: Store the actual URL we processed to avoid infinite loops.
        if (a.getAttribute('data-ms-processed') === a.href) return;
        
        const molstarUrl = getMolstarUrl(a.href, settings);
        if (!molstarUrl) return;
        
        // Mark the link as processed
        a.setAttribute('data-ms-processed', a.href);
        
        // Prevent stacking badges if one is already physically right next to this element
        if (a.nextElementSibling && a.nextElementSibling.hasAttribute('data-ms-badge')) {
          return;
        }

        // Direct DOM Injection: Place the badge immediately after the <a> tag
        a.insertAdjacentElement('afterend', makeBadge(molstarUrl));
      });
    } catch (e) { 
      console.warn("Linker Error:", e); 
    }
  });
}

// --- SPA NAVIGATION HANDLING ---
let debounceTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(injectMolstarLinker, 500);
});
observer.observe(document.body, { childList: true, subtree: true });

injectMolstarLinker();
