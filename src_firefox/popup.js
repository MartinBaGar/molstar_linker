// popup.js

// --- BROWSER ABSTRACTION ---
const extApi = typeof globalThis.browser !== 'undefined' ? globalThis.browser : chrome;

document.addEventListener('DOMContentLoaded', async () => {
  const presetSelect = document.getElementById('preset-select');
  const statusDiv = document.getElementById('status');
  let customTemplates = {};

  // 1. Fetch built-in presets AND custom user templates
  extApi.storage.sync.get(['customTemplates'], (result) => {
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

  // 2. Apply Preset Button
  document.getElementById('apply-preset').addEventListener('click', () => {
    const val = presetSelect.value;
    let presetOverrides = {};
    
    if (val.startsWith('builtin_')) {
      presetOverrides = AppConfig.presets[val.replace('builtin_', '')].settings;
    } else {
      presetOverrides = customTemplates[val.replace('custom_', '')].settings;
    }
    
    const newSettings = { ...AppConfig.getDefaults(), ...presetOverrides };

    extApi.storage.sync.set(newSettings, () => {
      extApi.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) extApi.tabs.reload(tabs[0].id);
      });
      window.close();
    });
  });

  // 3. Load from JSON File
  document.getElementById('file-upload').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const customSettings = JSON.parse(e.target.result);
        const newSettings = { ...AppConfig.getDefaults(), ...customSettings };
        
        extApi.storage.sync.set(newSettings, () => {
          statusDiv.textContent = "JSON preset loaded!";
          statusDiv.style.color = "var(--success)";
          setTimeout(() => {
            extApi.tabs.query({active: true, currentWindow: true}, (tabs) => {
              if (tabs[0]) extApi.tabs.reload(tabs[0].id);
            });
            window.close();
          }, 1000);
        });
      } catch (err) {
        statusDiv.textContent = "Error: Invalid JSON file.";
        statusDiv.style.color = "var(--danger)";
      }
    };
    reader.readAsText(file);
  });

  // 4. Link to Advanced Options
  document.getElementById('open-options').addEventListener('click', () => {
    extApi.runtime.openOptionsPage();
  });

// --- 5. CUSTOM DOMAIN DETECTION LOGIC ---
  try {
    const tabs = await new Promise(resolve => extApi.tabs.query({ active: true, currentWindow: true }, resolve));
    const tab = tabs[0];
    
    if (tab && tab.url && tab.url.startsWith('http')) {
      const currentDomain = PermissionsManager.cleanDomain(tab.url);
      
      const defaultDomains = ['github.com', 'gitlab.com', 'rcsb.org', 'alphafold.ebi.ac.uk'];
      const isDefault = defaultDomains.some(d => currentDomain.includes(d));
      
      const storageData = await new Promise(resolve => extApi.storage.sync.get({ customDomains: [] }, resolve));
      const isCustomAuthorized = storageData.customDomains.includes(currentDomain);
      
      if (!isDefault && !isCustomAuthorized) {
        const promptDiv = document.getElementById('custom-domain-prompt');
        const enableBtn = document.getElementById('enable-domain-btn');
        
        if (promptDiv && enableBtn) {
          promptDiv.style.display = 'block';
          enableBtn.textContent = "Authorize in Studio";
          enableBtn.style.backgroundColor = "var(--primary)";
          
          enableBtn.addEventListener('click', () => {
            // Open Options page in a full tab and pass the domain in the URL!
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
