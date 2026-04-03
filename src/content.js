// content.js

const StorageAPI = {
  core: typeof globalThis.browser !== 'undefined' ? globalThis.browser : chrome,
  get: function(keys, callback) { this.core.storage.sync.get(keys, callback); },
  set: function(data, callback) { this.core.storage.sync.set(data, callback); }
};

const SUPPORTED_EXT = new Set(['.pdb','.cif','.mmcif','.gro','.mol','.mol2','.sdf','.xyz','.ent','.bcif']);
const SKIP_TAGS = new Set(['SCRIPT','STYLE','CODE','PRE','TEXTAREA','INPUT']);

const GITLAB_PATTERNS = [
  {
    regex: /^https?:\/\/([^/]+)\/(.+?)\/-\/(?:blob|raw)\/([^/]+)\/(.+)$/,
    buildApiUrl: (domain, ns, ref, fp) =>
      `https://${domain}/api/v4/projects/${encodeURIComponent(ns)}/repository/files/${encodeURIComponent(fp)}/raw?ref=${encodeURIComponent(ref)}`
  }
];

function getMolstarUrl(href, settings) {
  const url = href.split('?')[0];
  const ext = '.' + url.split('.').pop().toLowerCase();
  if (!SUPPORTED_EXT.has(ext)) return null;
  const formatStr = ext.slice(1); 

  if (url.includes('github.com')) {
    let rawUrl = null;
    if (url.includes('/blob/')) {
      rawUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    } else if (url.includes('/raw/refs/heads/')) {
      rawUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/raw/refs/heads/', '/');
    }
    if (rawUrl) return MvsBuilder.createViewerUrl(rawUrl, formatStr, settings);
  }

  for (const p of GITLAB_PATTERNS) {
    const match = url.match(p.regex);
    if (!match) continue;
    const rawUrl = p.buildApiUrl(match[1], match[2], match[3], match[4]);
    return MvsBuilder.createViewerUrl(rawUrl, formatStr, settings);
  }
  return null;
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
      const map = {};
      
      // 1. Find structure links
      document.querySelectorAll('a[href]').forEach(a => {
        // SPA FIX: Store the actual URL we processed. If GitLab changes the URL on this element, we will process it again!
        if (a.getAttribute('data-ms-processed') === a.href) return;
        
        const molstarUrl = getMolstarUrl(a.href, settings);
        if (!molstarUrl) return;
        
        const filename = a.href.split('?')[0].split('/').pop();
        if (filename) {
          map[filename] = molstarUrl;
          a.setAttribute('data-ms-processed', a.href);
        }
      });
      
      if (Object.keys(map).length === 0) return;
      
      const pattern = new RegExp(`(${Object.keys(map).map(f => f.replace(/\./g, '\\.')).join('|')})`, 'g');

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (SKIP_TAGS.has(node.parentElement?.tagName)) return NodeFilter.FILTER_REJECT;
          if (node.parentElement?.hasAttribute('data-ms-badge')) return NodeFilter.FILTER_REJECT;
          pattern.lastIndex = 0;
          return pattern.test(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      });

      const hits = [];
      let node;
      while ((node = walker.nextNode())) hits.push(node);

      hits.forEach(textNode => {
        pattern.lastIndex = 0;
        const match = pattern.exec(textNode.textContent);
        if (!match) return;

        const molstarUrl = map[match[1]];
        if (!molstarUrl) return;

        const parent = textNode.parentElement;
        if (!parent) return;

        // SPA FIX: Don't rely on data-tags. Just check if our badge is already physically there.
        if (['SPAN', 'H1', 'H2'].includes(parent.tagName)) {
          if (!parent.querySelector('[data-ms-badge]')) {
            parent.appendChild(makeBadge(molstarUrl));
          }
          return;
        }

        let insertAfter = parent;
        while (insertAfter) {
          const p = insertAfter.parentElement;
          if (!p) break;
          const pClass = p.className || '';
          if (pClass.includes('filename') || pClass.includes('tree-item') || p.tagName === 'TD' || p.tagName === 'LI') break;
          insertAfter = p;
        }

        // SPA FIX: Check if the very next element is our badge
        if (insertAfter.nextElementSibling && insertAfter.nextElementSibling.hasAttribute('data-ms-badge')) {
          return;
        }

        insertAfter.insertAdjacentElement('afterend', makeBadge(molstarUrl));
      });
    } catch (e) { console.warn("Linker Error:", e); }
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
