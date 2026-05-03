// src/background.ts

/// <reference types="chrome" />

import type { OpenViewerMessage } from './types.js';

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

/** Only HTTPS links are permitted — no http, file, javascript, data, etc. */
function isSafeUrl(urlStr: string): boolean {
  try {
    return new URL(urlStr).protocol === 'https:';
  } catch {
    return false;
  }
}

const ALLOWED_FORMATS = new Set([
  'pdb', 'cif', 'mmcif', 'bcif', 'gro', 'mol', 'mol2', 'sdf', 'xyz',
]);

// ---------------------------------------------------------------------------
// FEATURE 1: Context menu — "Open in Mol* Workspace"
// Created once on install; clicking opens the viewer with format=unknown so
// the viewer's format-selector UI is triggered automatically.
// ---------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id:       'open-molstar',
    title:    'Open in Mol* Workspace',
    contexts: ['link'],
  });
});

chrome.contextMenus.onClicked.addListener((info, _tab) => {
  if (info.menuItemId !== 'open-molstar' || !info.linkUrl) return;

  if (!isSafeUrl(info.linkUrl)) {
    console.warn('Mol* Linker: blocked unsafe context-menu URL:', info.linkUrl);
    return;
  }

  // Pass format=unknown so the viewer shows the manual format selector
  const viewerUrl = chrome.runtime.getURL(
    `viewer.html?fileUrl=${encodeURIComponent(info.linkUrl)}&format=unknown`,
  );
  chrome.tabs.create({ url: viewerUrl });
});

// ---------------------------------------------------------------------------
// FEATURE 2: Message router — handles "open_viewer" from content scripts
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener(
  (message: OpenViewerMessage, sender: chrome.runtime.MessageSender) => {
    if (message.action !== 'open_viewer') return;

    // Must come from a real tab
    if (!sender.tab?.id) return;

    // Validate URL and format before building the viewer URL
    if (!message.url || !isSafeUrl(message.url)) return;
    if (!ALLOWED_FORMATS.has(message.format)) return;

    const viewerUrl = chrome.runtime.getURL(
      `viewer.html?fileUrl=${encodeURIComponent(message.url)}&format=${encodeURIComponent(message.format)}`,
    );
    chrome.tabs.create({ url: viewerUrl });
  },
);

// ---------------------------------------------------------------------------
// FEATURE 3: Dynamic permissions injector
// When the user authorizes a new custom domain via the Options page, this
// listener fires and registers the content script for that domain on the fly
// so the user doesn't have to restart the browser or reload the extension.
// ---------------------------------------------------------------------------
chrome.permissions.onAdded.addListener((permissions) => {
  const origins = permissions.origins ?? [];
  if (origins.length === 0 || !chrome.scripting?.registerContentScripts) return;

  chrome.scripting.registerContentScripts([{
    id:      `dynamic-molstar-${Date.now()}`,
    matches: origins,
    js:      ['config.js', 'content.js'],
    runAt:   'document_end',
  }]).catch(err => console.error('Mol* Linker — dynamic script registration failed:', err));
});
