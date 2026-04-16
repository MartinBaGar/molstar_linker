// options.js

const StorageAPI = {
  core: typeof globalThis.browser !== 'undefined' ? globalThis.browser : chrome,
  get: function(keys, callback) { this.core.storage.sync.get(keys, callback); },
  set: function(data, callback) { this.core.storage.sync.set(data, callback); }
};

const sceneContainer = document.getElementById('scene-settings-container');
const container = document.getElementById('settings-container');
const rulesContainer = document.getElementById('custom-rules-container');
let customTemplates = {}; 

function showStatus(message, isError = false) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = isError ? "var(--danger)" : "var(--success)";
  setTimeout(() => { status.textContent = ''; }, 3000);
}

// --- DYNAMIC UI HELPERS ---
function buildRepSelect(currentVal = "cartoon") {
  const select = document.createElement('select');
  select.className = "rep-selector";
  Object.keys(AppConfig.RepSchema).forEach(key => select.add(new Option(AppConfig.RepSchema[key].label, key)));
  select.value = currentVal;
  return select;
}

function updateSubParamsDrawer(drawer, repType, storedValues = {}) {
  drawer.innerHTML = '';
  const schema = AppConfig.RepSchema[repType]?.params;
  
  if (!schema || Object.keys(schema).length === 0) {
    drawer.style.display = 'none';
    return;
  }
  
  drawer.style.display = 'block';
  Object.entries(schema).forEach(([paramName, paramType]) => {
    const row = document.createElement('div');
    row.className = 'drawer-row';
    const label = document.createElement('label');
    label.textContent = paramName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    row.appendChild(label);

    if (paramType === 'boolean') {
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.dataset.param = paramName; cb.className = "subparam-input";
      cb.checked = storedValues[paramName] === true;
      row.appendChild(cb);
    } else if (Array.isArray(paramType)) {
      const sel = document.createElement('select'); sel.dataset.param = paramName; sel.className = "subparam-input";
      paramType.forEach(opt => sel.add(new Option(opt, opt)));
      if (storedValues[paramName]) sel.value = storedValues[paramName];
      row.appendChild(sel);
    }
    drawer.appendChild(row);
  });
}

function buildColorInput(typeVal, colorVal) {
  const wrapper = document.createElement('div');
  const typeSelect = document.createElement('select'); typeSelect.className = "color-type-selector";
  typeSelect.add(new Option("Mol* Theme", "theme")); typeSelect.add(new Option("Solid Hex / X11", "solid")); typeSelect.value = typeVal || "theme";

  const dynamicArea = document.createElement('div'); dynamicArea.className = "color-dynamic-area";

  const renderDynamic = () => {
    dynamicArea.innerHTML = '';
    if (typeSelect.value === 'theme') {
      const themeSel = document.createElement('select'); themeSel.className = "color-val-input";
      themeSel.add(new Option("By Chain", "chain-id")); themeSel.add(new Option("By Atom Type", "element-symbol")); themeSel.add(new Option("Secondary Structure", "secondary-structure"));
      themeSel.value = ['chain-id', 'element-symbol', 'secondary-structure'].includes(colorVal) ? colorVal : 'chain-id';
      dynamicArea.appendChild(themeSel);
    } else {
      const group = document.createElement('div'); group.className = "color-input-group";
      const picker = document.createElement('input'); picker.type = "color"; picker.className = "color-picker";
      const text = document.createElement('input'); text.type = "text"; text.className = "color-val-input color-text"; text.placeholder = "e.g. #ff0000";
      
      const initVal = (!['chain-id', 'element-symbol', 'secondary-structure'].includes(colorVal) && colorVal) ? colorVal : '#ff0000';
      text.value = initVal;
      if (initVal.startsWith('#') && initVal.length === 7) picker.value = initVal;
      picker.addEventListener('input', (e) => text.value = e.target.value);
      
      group.appendChild(picker); group.appendChild(text); dynamicArea.appendChild(group);
    }
  };

  typeSelect.addEventListener('change', renderDynamic); renderDynamic();
  wrapper.appendChild(typeSelect); wrapper.appendChild(dynamicArea);
  return wrapper;
}

// --- 1. BUILD MAIN UI ---
function buildUI() {
  sceneContainer.innerHTML = `
    <details class="target-card" id="scene-card">
      <summary><span>Canvas & Camera</span><span style="font-size: 10px; opacity: 0.5;">▼</span></summary>
      <div class="card-content">
        <div class="setting-row">
          <label>Background Color (Hex or Name)</label>
          <div class="color-input-group">
            <input type="color" class="color-picker" id="canvas_color_picker" value="#ffffff">
            <input type="text" class="color-text" id="canvas_color" placeholder="e.g. white or #ffffff" value="#ffffff">
          </div>
        </div>
        <div class="setting-row">
          <label>Expert Camera Coordinates (JSON)</label>
          <textarea id="camera_json" placeholder='{"target": [0,0,0], "position": [50,50,50]}'></textarea>
        </div>
      </div>
    </details>
  `;
  document.getElementById('canvas_color_picker').addEventListener('input', (e) => document.getElementById('canvas_color').value = e.target.value);

  AppConfig.targets.forEach(target => {
    const card = document.createElement('details'); card.className = 'target-card'; card.id = `card_${target.id}`;
    card.innerHTML = `<summary><span>${target.label}</span><span style="font-size: 10px; opacity: 0.5;">▼</span></summary><div class="card-content"></div>`;
    const content = card.querySelector('.card-content');

    const repRow = document.createElement('div'); repRow.className = 'setting-row'; repRow.innerHTML = `<label>Style</label>`;
    const repSelect = buildRepSelect(); const repDrawer = document.createElement('div'); repDrawer.className = 'params-drawer target-drawer';
    repSelect.addEventListener('change', (e) => updateSubParamsDrawer(repDrawer, e.target.value));
    repRow.appendChild(repSelect); repRow.appendChild(repDrawer); content.appendChild(repRow);

    const colorRow = document.createElement('div'); colorRow.className = 'setting-row'; colorRow.innerHTML = `<label>Color</label>`;
    colorRow.appendChild(buildColorInput()); content.appendChild(colorRow);

    const modRow = document.createElement('div'); modRow.className = 'flex-row';
    modRow.innerHTML = `
      <div style="flex:1"><label>Size Factor</label><input type="number" class="size-input" step="0.5" min="0.5" max="5.0" placeholder="1.0"></div>
      <div style="flex:1"><label>Opacity</label><input type="number" class="opacity-input" step="0.1" min="0.0" max="1.0" placeholder="1.0"></div>
    `;
    content.appendChild(modRow);
    container.appendChild(card);
  });
}

// --- 2. CUSTOM RULES ---
function addCustomRuleCard(ruleData = null) {
  const data = ruleData || { 
    name: "New Rule", rep: "highlight", colorType: "solid", colorVal: "red", 
    size: "", opacity: "", mode: "simple", scheme: "auth", chain: "", ranges: "", specific: "", atomName: "", element: "", atomIndex: "",
    label: "", tooltip: "", focus: false, rawJson: '{"auth_asym_id": "A"}', rawParamsJson: '{}', subParams: {}
  };
  
  const card = document.createElement('details'); card.className = 'target-card custom-rule-card'; card.open = true; 
  
  card.innerHTML = `
    <summary>
      <span class="rule-title-display">${data.name || "New Rule"}</span>
      <div style="display:flex; align-items:center; gap: 10px;"><button class="danger-outline delete-rule-btn" style="padding: 2px 8px; width: auto; font-size: 11px;">Delete</button><span style="font-size: 10px; opacity: 0.5;">▼</span></div>
    </summary>
    <div class="card-content">
      <div class="flex-row">
        <div style="flex: 2;"><label>Rule Name (Internal)</label><input type="text" class="cr-name" value="${data.name}"></div>
        <div style="flex: 1;"><label>Mode</label><select class="cr-mode"><option value="simple">Simple</option><option value="expert">Expert</option></select></div>
        <div style="flex: 1;"><label>Numbering</label><select class="cr-scheme"><option value="auth">auth_*</option><option value="label">label_*</option></select></div>
      </div>
      <div class="rule-section cr-simple-container">
        <div class="rule-section-title">Target Selection</div>
        <div class="grid-6">
          <div><label>Chain</label><input type="text" class="cr-chain" value="${data.chain || ''}" placeholder="A"></div>
          <div><label>Res Range</label><input type="text" class="cr-ranges" value="${data.ranges || ''}" placeholder="5-50"></div>
          <div><label>Specific Res</label><input type="text" class="cr-specific" value="${data.specific || ''}" placeholder="10, 15"></div>
          <div><label>Atom</label><input type="text" class="cr-atom" value="${data.atomName || ''}" placeholder="CA"></div>
          <div><label>Element</label><input type="text" class="cr-element" value="${data.element || ''}" placeholder="FE"></div>
          <div><label>Atom Idx</label><input type="text" class="cr-atom-index" value="${data.atomIndex || ''}" placeholder="100"></div>
        </div>
      </div>
      <div class="rule-section cr-expert-container" style="display: none;">
        <div class="rule-section-title">Raw MVS JSON</div>
        <div class="flex-row">
          <div><label>Target Selector</label><textarea class="cr-json">${data.rawJson}</textarea></div>
          <div><label>Advanced Rep Params</label><textarea class="cr-params-json" placeholder='{"ignore_hydrogens": true}'>${data.rawParamsJson}</textarea></div>
        </div>
      </div>
      <div class="rule-section">
        <div class="rule-section-title">Appearance</div>
        <div class="flex-row">
          <div style="flex: 1.5;" class="cr-rep-container"><label>Style</label>
             <select class="cr-rep"><option value="highlight">Color Highlight Only</option>${Object.keys(AppConfig.RepSchema).filter(k => k !== 'off').map(k => `<option value="${k}">Spawn: ${AppConfig.RepSchema[k].label}</option>`).join('')}</select>
             <div class="params-drawer cr-drawer"></div>
          </div>
          <div style="flex: 1.5;" class="cr-color-container"><label>Color</label></div>
          <div style="flex: 0.5;"><label>Size</label><input type="number" class="cr-size" value="${data.size || ''}" step="0.5" min="0.5" max="5.0" placeholder="1.0"></div>
          <div style="flex: 0.5;"><label>Opacity</label><input type="number" class="cr-opacity" value="${data.opacity || ''}" step="0.1" min="0" max="1.0" placeholder="1.0"></div>
        </div>
      </div>
      <div class="rule-section">
        <div class="rule-section-title">Annotations & View</div>
        <div class="flex-row" style="align-items: flex-end;">
          <div style="flex: 1.5;"><label>Floating Label</label><input type="text" class="cr-label" value="${data.label || ''}" placeholder="e.g. Active Site"></div>
          <div style="flex: 1.5;"><label>Hover Tooltip</label><input type="text" class="cr-tooltip" value="${data.tooltip || ''}" placeholder="e.g. Binds ATP"></div>
          <div style="flex: 1; margin-bottom: 8px;">
            <label style="display:inline-flex; align-items:center; cursor:pointer;">
              <input type="checkbox" class="cr-focus" ${data.focus ? 'checked' : ''} style="width:16px; height:16px; margin:0 8px 0 0;"> Focus Camera Here
            </label>
          </div>
        </div>
      </div>
    </div>
  `;

  card.querySelector('.cr-color-container').appendChild(buildColorInput(data.colorType, data.colorVal));
  card.querySelector('.cr-mode').value = data.mode;
  card.querySelector('.cr-scheme').value = data.scheme || "auth";
  
  const repSelect = card.querySelector('.cr-rep'); repSelect.value = data.rep || "highlight";
  const repDrawer = card.querySelector('.cr-drawer');
  repSelect.addEventListener('change', (e) => updateSubParamsDrawer(repDrawer, e.target.value));
  updateSubParamsDrawer(repDrawer, repSelect.value, data.subParams);

  card.querySelector('.delete-rule-btn').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); card.remove(); });
  card.querySelector('.cr-name').addEventListener('input', (e) => card.querySelector('.rule-title-display').textContent = e.target.value || "Unnamed Rule");

  const modeSelect = card.querySelector('.cr-mode');
  const simpleDiv = card.querySelector('.cr-simple-container');
  const expertDiv = card.querySelector('.cr-expert-container');
  const jsonBox = card.querySelector('.cr-json');

  const updateVisibility = () => {
    if (modeSelect.value === 'simple') { 
      simpleDiv.style.display = 'block'; expertDiv.style.display = 'none'; card.querySelector('.cr-scheme').parentElement.style.display = 'block';
    } else { 
      const scheme = card.querySelector('.cr-scheme').value; const prefix = scheme === 'label' ? 'label' : 'auth';
      const baseSel = {};
      const ch = card.querySelector('.cr-chain').value.trim(); if (ch) baseSel[`${prefix}_asym_id`] = ch;
      const at = card.querySelector('.cr-atom').value.trim(); if (at) baseSel[`${prefix}_atom_id`] = at;
      const el = card.querySelector('.cr-element').value.trim(); if (el) baseSel.type_symbol = el;
      let selectors = [];
      const ranges = card.querySelector('.cr-ranges').value.trim();
      if (ranges) ranges.split(',').forEach(p => { const b = p.split('-'); if (b.length===2) selectors.push({...baseSel, [`beg_${prefix}_seq_id`]: parseInt(b[0]), [`end_${prefix}_seq_id`]: parseInt(b[1])}); });
      const specific = card.querySelector('.cr-specific').value.trim();
      if (specific) specific.split(',').forEach(p => { if (!isNaN(parseInt(p))) selectors.push({...baseSel, [`${prefix}_seq_id`]: parseInt(p)}); });
      const idxs = card.querySelector('.cr-atom-index').value.trim();
      if (idxs) idxs.split(',').forEach(p => { if (!isNaN(parseInt(p))) selectors.push({...baseSel, atom_index: parseInt(p)}); });
      if (selectors.length === 0 && Object.keys(baseSel).length > 0) selectors.push(baseSel);
      jsonBox.value = JSON.stringify(selectors.length === 1 ? selectors[0] : (selectors.length > 1 ? selectors : {}), null, 2);
      simpleDiv.style.display = 'none'; expertDiv.style.display = 'block'; card.querySelector('.cr-scheme').parentElement.style.display = 'none'; 
    }
  };
  
  modeSelect.addEventListener('change', updateVisibility);
  card.querySelector('.cr-scheme').addEventListener('change', updateVisibility);
  updateVisibility();

  rulesContainer.appendChild(card);
}

document.getElementById('add-custom-rule').addEventListener('click', () => addCustomRuleCard());

// --- 3. SETTINGS EXTRACTION & INJECTION ---
function extractCurrentSettings() {
  const currentValues = {};
  currentValues.canvas_color = document.getElementById('canvas_color').value;
  currentValues.camera_json = document.getElementById('camera_json').value;

  AppConfig.targets.forEach(target => {
    const card = document.getElementById(`card_${target.id}`);
    if (!card) return;
    currentValues[`${target.id}_rep`] = card.querySelector('.rep-selector').value;
    currentValues[`${target.id}_colorType`] = card.querySelector('.color-type-selector').value;
    currentValues[`${target.id}_colorVal`] = card.querySelector('.color-val-input').value;
    currentValues[`${target.id}_size`] = card.querySelector('.size-input').value;
    currentValues[`${target.id}_opacity`] = card.querySelector('.opacity-input').value;

    const subParams = {};
    card.querySelectorAll('.target-drawer .subparam-input').forEach(input => {
      subParams[input.dataset.param] = input.type === 'checkbox' ? input.checked : input.value;
    });
    currentValues[`${target.id}_subParams`] = subParams;
  });

  const customRules = [];
  document.querySelectorAll('.custom-rule-card').forEach(card => {
    const rule = {
      name: card.querySelector('.cr-name').value,
      rep: card.querySelector('.cr-rep').value,
      colorType: card.querySelector('.color-type-selector').value,
      colorVal: card.querySelector('.color-val-input').value,
      size: card.querySelector('.cr-size').value,
      opacity: card.querySelector('.cr-opacity').value,
      mode: card.querySelector('.cr-mode').value,
      scheme: card.querySelector('.cr-scheme').value,
      chain: card.querySelector('.cr-chain').value.trim(),
      ranges: card.querySelector('.cr-ranges').value.trim(),
      specific: card.querySelector('.cr-specific').value.trim(),
      atomName: card.querySelector('.cr-atom').value.trim(),
      element: card.querySelector('.cr-element').value.trim(),
      atomIndex: card.querySelector('.cr-atom-index').value.trim(),
      label: card.querySelector('.cr-label').value.trim(),
      tooltip: card.querySelector('.cr-tooltip').value.trim(),
      focus: card.querySelector('.cr-focus').checked,
      rawJson: card.querySelector('.cr-json').value,
      rawParamsJson: card.querySelector('.cr-params-json').value,
      subParams: {}
    };

    card.querySelectorAll('.cr-drawer .subparam-input').forEach(input => { rule.subParams[input.dataset.param] = input.type === 'checkbox' ? input.checked : input.value; });
    if (rule.mode === 'simple') { try { rule.selector = JSON.parse(rule.rawJson); } catch (e) { rule.selector = {}; } } 
    else { try { rule.selector = rule.rawJson.trim().startsWith('{') || rule.rawJson.trim().startsWith('[') ? JSON.parse(rule.rawJson) : rule.rawJson.replace(/['"]/g, ''); } catch (e) { rule.selector = {}; } }
    if (rule.mode === 'expert') { try { rule.advancedParams = JSON.parse(rule.rawParamsJson); } catch (e) { rule.advancedParams = {}; } }
    customRules.push(rule);
  });
  
  currentValues.customRules = customRules;
  return currentValues;
}

function injectSettingsIntoUI(settingsObj) {
  sceneContainer.innerHTML = ''; container.innerHTML = ''; rulesContainer.innerHTML = '';
  buildUI();

  if (settingsObj.canvas_color) {
    document.getElementById('canvas_color').value = settingsObj.canvas_color;
    if (settingsObj.canvas_color.startsWith('#')) document.getElementById('canvas_color_picker').value = settingsObj.canvas_color;
  }
  if (settingsObj.camera_json) document.getElementById('camera_json').value = settingsObj.camera_json;

  AppConfig.targets.forEach(target => {
    const card = document.getElementById(`card_${target.id}`);
    if (!card) return;
    if (settingsObj[`${target.id}_rep`]) {
      const repSel = card.querySelector('.rep-selector'); repSel.value = settingsObj[`${target.id}_rep`];
      updateSubParamsDrawer(card.querySelector('.target-drawer'), repSel.value, settingsObj[`${target.id}_subParams`]);
    }
    if (settingsObj[`${target.id}_colorType`]) {
      card.querySelector('.color-type-selector').parentElement.replaceWith(buildColorInput(settingsObj[`${target.id}_colorType`], settingsObj[`${target.id}_colorVal`]));
    }
    if (settingsObj[`${target.id}_size`]) card.querySelector('.size-input').value = settingsObj[`${target.id}_size`];
    if (settingsObj[`${target.id}_opacity`]) card.querySelector('.opacity-input').value = settingsObj[`${target.id}_opacity`];
  });

  if (settingsObj.customRules) settingsObj.customRules.forEach(rule => addCustomRuleCard(rule));
}

// --- 4. TEMPLATES & EXPORT ---
function updateTemplateDropdown() {
  const select = document.getElementById('template-select'); select.innerHTML = '';
  Object.keys(AppConfig.presets).forEach(key => select.add(new Option(`[Built-in] ${AppConfig.presets[key].name}`, `builtin_${key}`)));
  Object.keys(customTemplates).forEach(key => select.add(new Option(`[Custom] ${customTemplates[key].name}`, `custom_${key}`)));
}

document.getElementById('load-template').onclick = () => {
  const val = document.getElementById('template-select').value;
  let tplSettings = val.startsWith('builtin_') ? AppConfig.presets[val.replace('builtin_', '')].settings : customTemplates[val.replace('custom_', '')].settings;
  injectSettingsIntoUI({ ...AppConfig.getDefaults(), ...tplSettings }); showStatus('Template loaded!');
};

document.getElementById('delete-template').onclick = () => {
  const val = document.getElementById('template-select').value;
  if (val.startsWith('builtin_')) return alert("You cannot delete Built-in presets.");
  const customId = val.replace('custom_', '');
  if (confirm(`Delete "${customTemplates[customId].name}"?`)) {
    delete customTemplates[customId]; StorageAPI.set({ customTemplates }, () => { updateTemplateDropdown(); showStatus('Deleted.'); });
  }
};

document.getElementById('save-template').onclick = () => {
  const name = document.getElementById('new-template-name').value.trim();
  if (!name) return alert('Name required.');
  const currentValues = extractCurrentSettings();
  let existingId = Object.keys(customTemplates).find(key => customTemplates[key].name.toLowerCase() === name.toLowerCase());
  if (existingId && !confirm(`Overwrite "${name}"?`)) return;
  const id = existingId || ('user_tpl_' + Date.now());
  customTemplates[id] = { name, settings: currentValues };
  StorageAPI.set({ customTemplates }, () => { updateTemplateDropdown(); document.getElementById('new-template-name').value = ''; showStatus('Saved!'); });
};

document.getElementById('export-json').onclick = () => {
  const dlAnchor = document.createElement('a'); dlAnchor.setAttribute("href", "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(extractCurrentSettings(), null, 2)));
  dlAnchor.setAttribute("download", "molstar_settings.json"); document.body.appendChild(dlAnchor); dlAnchor.click(); dlAnchor.remove();
};

document.getElementById('import-json').onchange = (e) => {
  if (!e.target.files[0]) return; const reader = new FileReader();
  reader.onload = function(evt) { try { injectSettingsIntoUI({ ...AppConfig.getDefaults(), ...JSON.parse(evt.target.result) }); showStatus('Imported!'); } catch { showStatus('Error.', true); } };
  reader.readAsText(e.target.files[0]); e.target.value = '';
};

document.getElementById('save').onclick = () => StorageAPI.set(extractCurrentSettings(), () => showStatus('Applied!'));

// --- 5. DOMAIN MANAGEMENT ---
function refreshCustomDomainList() {
  const container = document.getElementById('custom-domains-list');
  if (!container) return;
  
  // Use your callback wrapper instead of 'await chrome...' to support Firefox MV2
  StorageAPI.get({ customDomains: [] }, (data) => {
    if (!data || data.customDomains.length === 0) {
      container.innerHTML = `<p style="color: #57606a; font-style: italic; font-size: 13px;">No custom domains authorized yet.</p>`;
      return;
    }
    
    container.innerHTML = '';
    data.customDomains.forEach(domain => {
      const row = document.createElement('div');
      row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; margin-bottom: 8px;";
      row.innerHTML = `<div style="display: flex; align-items: center; gap: 10px;"><span>🌐</span><span style="font-weight: 500;">${domain}</span></div>
                       <button class="danger-outline remove-domain-btn" data-domain="${domain}" style="padding: 4px 10px; font-size: 12px;">Remove</button>`;
      container.appendChild(row);
    });
    
    document.querySelectorAll('.remove-domain-btn').forEach(btn => {
      btn.onclick = async (e) => {
        const dom = e.target.getAttribute('data-domain');
        if (confirm(`Revoke access for ${dom}?`)) {
          await PermissionsManager.revokeAndUnregister(dom);
          refreshCustomDomainList();
        }
      };
    });
  });
}

document.getElementById('add-manual-domain').onclick = async () => {
  const input = document.getElementById('manual-domain-input');
  const dom = input.value.trim();
  if (!dom) return;
  if (await PermissionsManager.requestAndRegister(dom)) {
    input.value = ''; refreshCustomDomainList();
  }
};

// --- 6. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  StorageAPI.get(null, (savedItems) => {
    customTemplates = savedItems.customTemplates || {};
    updateTemplateDropdown();
    injectSettingsIntoUI({ ...AppConfig.getDefaults(), ...savedItems });
  });
  refreshCustomDomainList();

  // NEW: Check if the popup sent us here to authorize a new domain
  const urlParams = new URLSearchParams(window.location.search);
  const autoDomain = urlParams.get('domain');
  if (autoDomain) {
    const input = document.getElementById('manual-domain-input');
    if (input) {
      input.value = autoDomain;
      input.focus();
      // Scroll to the bottom so the user sees the input
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  }
});
