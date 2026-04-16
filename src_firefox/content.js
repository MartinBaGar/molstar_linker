// content.js

const SUPPORTED_EXT = new Set(['.pdb','.cif','.mmcif','.gro','.mol','.mol2','.sdf','.xyz','.ent','.bcif']);

const GITLAB_PATTERNS = [
  {
    regex: /^https?:\/\/([^/]+)\/(.+?)\/-\/(?:blob|raw)\/([^/]+)\/(.+)$/,
    buildApiUrl: (domain, ns, ref, fp) =>
      `https://${domain}/api/v4/projects/${encodeURIComponent(ns)}/repository/files/${encodeURIComponent(fp)}/raw?ref=${encodeURIComponent(ref)}`
  }
];

function extractExtension(urlStr) {
  for (let ext of SUPPORTED_EXT) {
    const regex = new RegExp(`\\${ext}(?:[?#&]|$)`, 'i');
    if (regex.test(urlStr)) return ext;
  }
  return null;
}

function getStructureInfo(href) {
  let parsedUrl;
  try { parsedUrl = new URL(href, window.location.origin); } 
  catch (e) { return null; }

  // FIX 2a: Instantly reject anchor jump links (e.g., #content-body, #L1)
  if (parsedUrl.hash) return null;

  const extWithQuery = extractExtension(parsedUrl.href);
  if (!extWithQuery) return null;
  const formatStr = extWithQuery === '.cif' ? 'mmcif' : extWithQuery.slice(1);

  const cleanUrl = parsedUrl.origin + parsedUrl.pathname;

  // FIX 2b: Explicitly block Git interface paths that are not valid raw files
  const blockedGitPaths = ['/blame/', '/commits/', '/commit/', '/edit/', '/tree/', '/network/', '/compare/'];
  if (blockedGitPaths.some(p => cleanUrl.includes(p))) return null;

  if (cleanUrl.includes('github.com')) {
    let rawUrl = null;
    if (cleanUrl.includes('/blob/')) {
      rawUrl = cleanUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    } else if (cleanUrl.includes('/raw/refs/heads/')) {
      rawUrl = cleanUrl.replace('github.com', 'raw.githubusercontent.com').replace('/raw/refs/heads/', '/');
    }
    if (rawUrl) return { rawUrl, formatStr };
  }

  for (const p of GITLAB_PATTERNS) {
    const match = cleanUrl.match(p.regex); 
    if (!match) continue;
    const rawUrl = p.buildApiUrl(match[1], match[2], match[3], match[4]);
    return { rawUrl, formatStr };
  }

  return { rawUrl: parsedUrl.href, formatStr };
}

function makeBadge(rawUrl, formatStr, originalHref) {
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.textContent = 'Mol* (Workspace)';
  badge.setAttribute('data-ms-badge', 'true');
  badge.setAttribute('data-original-href', originalHref);
  
  // FIX 1: Aggressively block all mouse events so GitLab's framework 
  // doesn't trigger row navigation when we click the button
  const blockEvent = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const triggerWorkspace = (e) => {
    blockEvent(e);
    chrome.runtime.sendMessage({
      action: "open_viewer",
      url: rawUrl,
      format: formatStr
    });
  };
  
  badge.addEventListener('click', triggerWorkspace);
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
      if (!text || /^\d+$/.test(text)) {
        a.dataset.msProcessed = 'true';
        return;
      }
      
      const structureInfo = getStructureInfo(a.href);
      if (!structureInfo) {
        a.dataset.msProcessed = 'true';
        return;
      }
      
      const parent = a.parentNode;
      if (parent) {
        const existingBadge = Array.from(parent.children).find(
          node => node.getAttribute('data-ms-badge') === 'true' && 
                  node.getAttribute('data-original-href') === a.href
        );
        if (existingBadge) {
          a.dataset.msProcessed = 'true';
          return;
        }
      }

      a.dataset.msProcessed = 'true';
      a.insertAdjacentElement('afterend', makeBadge(structureInfo.rawUrl, structureInfo.formatStr, a.href));
    });
  } catch (e) { 
    console.warn("Mol* Linker Error:", e); 
  }
  
  observer.observe(document.body, { childList: true, subtree: true });
}

let debounceTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(injectMolstarLinker, 500);
});
observer.observe(document.body, { childList: true, subtree: true });

injectMolstarLinker();
