// src/content.ts
//
// IMPORTANT: No ES module imports. Content scripts are injected as classic
// scripts; AppConfig is loaded via a separate script tag listed earlier in
// the manifest (config.js) and is available as a global.
//
/// <reference types="chrome" />

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_EXT = new Set([
  '.pdb', '.cif', '.mmcif', '.bcif', '.gro',
  '.mol', '.mol2', '.sdf', '.xyz', '.ent',
]);

const MAX_URL_LENGTH = 2048;

// GitLab blob/raw URL → GitLab API raw URL
const GITLAB_PATTERN = /^https?:\/\/([^/]+)\/(.+?)\/-\/(?:blob|raw)\/([^/]+)\/(.+)$/;

function buildGitlabApiUrl(
  domain: string, ns: string, ref: string, fp: string,
): string {
  return `https://${domain}/api/v4/projects/${encodeURIComponent(ns)}/repository/files/${encodeURIComponent(fp)}/raw?ref=${encodeURIComponent(ref)}`;
}

// UI paths that are never raw file downloads
const GIT_UI_PATHS = [
  '/blame/', '/commits/', '/commit/', '/edit/',
  '/tree/', '/network/', '/compare/',
];

// ---------------------------------------------------------------------------
// Extension detection helpers
// ---------------------------------------------------------------------------

function extractExtFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const ext of SUPPORTED_EXT) {
    if (lower.includes(ext)) return ext;
  }
  return null;
}

function extractExtFromUrl(urlStr: string): string | null {
  for (const ext of SUPPORTED_EXT) {
    if (new RegExp(`\\${ext}(?:[?#&]|$)`, 'i').test(urlStr)) return ext;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Core scanner: given a link and its DOM element, return the raw download URL
// and format string, or null if this is not a structure file link.
//
// Uses a 3-ring DOM scan for sites with opaque URLs (e.g. Figshare, Zenodo):
//   Ring 1 — link text
//   Ring 2 — standard HTML attributes (title, download, data-filename)
//   Ring 2.5 — closest ancestor with a title attribute
//   Ring 3 — immediate parent's visible text (capped at 500 chars)
// ---------------------------------------------------------------------------

interface StructureInfo { rawUrl: string; formatStr: string }

function getStructureInfo(
  href: string,
  linkElement: HTMLAnchorElement,
): StructureInfo | null {

  if (!href || href.length > MAX_URL_LENGTH) return null;

  let parsed: URL;
  try {
    parsed = new URL(href, window.location.origin);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.hash) return null; // fragment-only / anchor links

  const urlNoQuery = parsed.origin + parsed.pathname;

  // Reject Git UI pages that aren't physical raw files
  if (GIT_UI_PATHS.some(p => urlNoQuery.includes(p))) return null;

  // --- Extension detection ---

  // Step 1: Standard URL check
  let ext = extractExtFromUrl(parsed.href);

  // Step 2: 3-ring DOM scanner for opaque URLs
  if (!ext) {
    // Ring 1: link text
    ext = extractExtFromText(linkElement.textContent);
  }
  if (!ext) {
    // Ring 2: HTML attributes
    const attrStr = [
      linkElement.title,
      linkElement.getAttribute('download'),
      linkElement.getAttribute('data-filename'),
    ].join(' ');
    ext = extractExtFromText(attrStr);
  }
  if (!ext) {
    // Ring 2.5: nearest ancestor with a title attribute
    const titled = linkElement.closest('[title]');
    if (titled) ext = extractExtFromText((titled as HTMLElement).title);
  }
  if (!ext) {
    // Ring 3: immediate parent's visible text (capped)
    const parent = linkElement.parentElement;
    if (parent && (parent.textContent?.length ?? 0) < 500) {
      ext = extractExtFromText(parent.textContent);
    }
  }

  if (!ext) return null;

  // Normalise extension to a Mol* format string
  const formatStr = ext === '.cif' ? 'mmcif'
                  : ext === '.ent' ? 'pdb'
                  : ext.slice(1);

  // --- URL transformation ---

  // GitHub: turn UI blob URL into raw.githubusercontent.com URL
  if (urlNoQuery.includes('github.com')) {
    const rawUrl = urlNoQuery
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/')
      .replace('/raw/', '/');
    return { rawUrl, formatStr };
  }

  // GitLab: self-hosted or gitlab.com — use the API endpoint
  const glMatch = urlNoQuery.match(GITLAB_PATTERN);
  if (glMatch) {
    return {
      rawUrl: buildGitlabApiUrl(glMatch[1], glMatch[2], glMatch[3], glMatch[4]),
      formatStr,
    };
  }

  // Everything else (RCSB, AlphaFold, custom domains): use URL as-is
  return { rawUrl: parsed.href, formatStr };
}

// ---------------------------------------------------------------------------
// Badge factory
// ---------------------------------------------------------------------------

function makeBadge(
  rawUrl: string,
  formatStr: string,
  originalHref: string,
): HTMLButtonElement {
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.textContent = 'Mol*';
  badge.dataset.msBadge      = 'true';
  badge.dataset.originalHref = originalHref;

  const isGitLab = rawUrl.includes('gitlab');
  Object.assign(badge.style, {
    marginLeft:      '6px',
    fontSize:        '10px',
    border:          'none',
    backgroundColor: isGitLab ? '#6a1b9a' : '#2da44e',
    color:           'white',
    padding:         '2px 6px',
    borderRadius:    '3px',
    fontWeight:      'bold',
    display:         'inline-block',
    verticalAlign:   'middle',
    cursor:          'pointer',
    lineHeight:      'normal',
  });

  const blockEvent = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  badge.addEventListener('click', (e: MouseEvent) => {
    blockEvent(e);
    if (!rawUrl.startsWith('https://')) return;
    try {
      chrome.runtime.sendMessage({ action: 'open_viewer', url: rawUrl, format: formatStr });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Extension context invalidated')) {
        alert('Mol* Linker has been updated. Please refresh this page.');
      } else {
        console.error('Mol* Workspace Error:', err);
      }
    }
  });

  badge.addEventListener('mousedown', blockEvent);
  badge.addEventListener('mouseup',   blockEvent);

  return badge;
}

// ---------------------------------------------------------------------------
// Main injection pass
// ---------------------------------------------------------------------------

function injectMolstarLinker(): void {
  observer.disconnect();
  try {
    document.querySelectorAll<HTMLAnchorElement>('a[href]:not([data-ms-badge])').forEach(a => {
      if (a.dataset.msProcessed === 'true') return;

      // Skip links that are nothing but a number (e.g. line-number anchors on GitHub)
      if (/^\d+$/.test(a.textContent?.trim() ?? '')) {
        a.dataset.msProcessed = 'true';
        return;
      }

      const info = getStructureInfo(a.href, a);
      if (!info) {
        a.dataset.msProcessed = 'true';
        return;
      }

      // Skip if a badge for this exact href already exists next to this link
      const parent = a.parentNode;
      if (
        parent &&
        Array.from(parent.children).some(
          n => (n as HTMLElement).dataset.msBadge === 'true' &&
               (n as HTMLElement).dataset.originalHref === a.href,
        )
      ) {
        a.dataset.msProcessed = 'true';
        return;
      }

      a.dataset.msProcessed = 'true';
      a.insertAdjacentElement('afterend', makeBadge(info.rawUrl, info.formatStr, a.href));
    });
  } catch (err) {
    console.warn('Mol* Linker error:', err);
  }
  observer.observe(document.body, { childList: true, subtree: true });
}

// ---------------------------------------------------------------------------
// MutationObserver with debounce (handles SPA navigation)
// ---------------------------------------------------------------------------

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const observer = new MutationObserver(() => {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(injectMolstarLinker, 500);
});

// Disconnect cleanly on SPA unload / extension context invalidation
window.addEventListener('unload', () => {
  observer.disconnect();
  if (debounceTimer !== null) clearTimeout(debounceTimer);
});

observer.observe(document.body, { childList: true, subtree: true });
injectMolstarLinker();
