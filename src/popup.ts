// src/popup.ts

import { AppConfig } from './config.js';
import { PermissionsManager } from './permissions.js';
import { Preset } from './types.js';

declare const browser: typeof chrome;
const extApi = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Cast DOM elements so TS knows exactly what they are
  const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
  // const statusDiv = document.getElementById('status') as HTMLDivElement | null;
  let customTemplates: Record<string, Preset> = {};

  // 2. Fetch built-in presets AND custom user templates
  extApi.storage.sync.get(['customTemplates'], (result: { customTemplates?: Record<string, Preset> }) => {
    customTemplates = result.customTemplates || {};

    const optGroupBuiltIn = document.createElement('optgroup');
    optGroupBuiltIn.label = "Built-in Presets";
    for (const [key, preset] of Object.entries(AppConfig.presets)) {
      const option = document.createElement('option');
      option.value = `builtin_${key}`;
      option.textContent = preset.name;
      optGroupBuiltIn.appendChild(option);
    }
    presetSelect.appendChild(optGroupBuiltIn);

    if (Object.keys(customTemplates).length > 0) {
      const optGroupCustom = document.createElement('optgroup');
      optGroupCustom.label = "My Custom Templates";
      for (const [key, tpl] of Object.entries(customTemplates)) {
        const option = document.createElement('option');
        option.value = `custom_${key}`;
        option.textContent = tpl.name;
        optGroupCustom.appendChild(option);
      }
      presetSelect.appendChild(optGroupCustom);
    }
  });

  // 3. Apply Preset Button
  const applyBtn = document.getElementById('apply-preset') as HTMLButtonElement | null;
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const val = presetSelect.value;
      let presetOverrides: any = {};
      
      if (val.startsWith('builtin_')) {
        presetOverrides = AppConfig.presets[val.replace('builtin_', '')].settings;
      } else {
        presetOverrides = customTemplates[val.replace('custom_', '')].settings;
      }
      
      const newSettings = { ...AppConfig.getDefaults(), ...presetOverrides };

      extApi.storage.sync.set(newSettings, () => {
        extApi.tabs.query({active: true, currentWindow: true}, (tabs) => {
          if (tabs[0] && tabs[0].id) extApi.tabs.reload(tabs[0].id);
        });
        window.close();
      });
    });
  }

  // 4. Link to Advanced Options
  const openOptionsBtn = document.getElementById('open-options') as HTMLButtonElement | null;
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      extApi.runtime.openOptionsPage();
    });
  }

  // 5. Open Empty Viewer
  const openViewerBtn = document.getElementById('open-empty-viewer') as HTMLButtonElement | null;
  if (openViewerBtn) {
    openViewerBtn.addEventListener('click', () => {
      const viewerUrl = extApi.runtime.getURL("viewer.html");
      extApi.tabs.create({ url: viewerUrl });
      window.close();
    });
  }

  // --- 6. CUSTOM DOMAIN DETECTION LOGIC ---
  try {
    // Explicitly type the Promise resolution so TS knows 'tabs' is an array of chrome tabs
    const tabs = await new Promise<chrome.tabs.Tab[]>(resolve => extApi.tabs.query({ active: true, currentWindow: true }, resolve));
    const tab = tabs[0];
    
    if (tab && tab.url && tab.url.startsWith('http')) {
      const currentDomain = PermissionsManager.cleanDomain(tab.url);
      
      const defaultDomains = ['github.com', 'gitlab.com', 'rcsb.org', 'alphafold.ebi.ac.uk'];
      const isDefault = defaultDomains.some(d => currentDomain.includes(d));
      
      // Explicitly type the expected storage response
      const storageData = await new Promise<{ customDomains: string[] }>(
        resolve => extApi.storage.sync.get({ customDomains: [] }, resolve)
      );
      
      const isCustomAuthorized = storageData.customDomains.includes(currentDomain);
      
      if (!isDefault && !isCustomAuthorized) {
        const promptDiv = document.getElementById('custom-domain-prompt') as HTMLDivElement | null;
        const enableBtn = document.getElementById('enable-domain-btn') as HTMLButtonElement | null;
        
        if (promptDiv && enableBtn) {
          promptDiv.style.display = 'block';
          enableBtn.textContent = "Authorize in Studio";
          enableBtn.style.backgroundColor = "var(--primary)";
          
          enableBtn.addEventListener('click', () => {
            extApi.tabs.create({ url: `options.html?domain=${encodeURIComponent(currentDomain)}` });
            window.close();
          });
        }
      }
    }
  } catch (err) {
    console.error("Molstar Linker: Permission check failed", err);
  }
});
