// src/options.ts

import { AppConfig } from './config.js';
import { PermissionsManager } from './permissions.js';
import type { ExtensionSettings, CustomRule, Preset } from './types.js';

declare const browser: typeof chrome;
const extApi = (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome;

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
const StorageAPI = {
  get(keys: Record<string, unknown> | null, cb: (r: Record<string, unknown>) => void): void {
    extApi.storage.sync.get(keys as Record<string, unknown>, cb as (r: Record<string, unknown>) => void);
  },
  set(data: Record<string, unknown>, cb?: () => void): void {
    if (cb) {
      extApi.storage.sync.set(data, cb);
    } else {
      extApi.storage.sync.set(data);
    }
  },
};

// ---------------------------------------------------------------------------
// XSS helper — used whenever injecting user strings into innerHTML
// ---------------------------------------------------------------------------
function escapeHTML(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[tag as '&'] ?? ''));
}

function showStatus(message: string, isError = false): void {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent   = message;
  el.style.color   = isError ? 'var(--danger)' : 'var(--success)';
  setTimeout(() => { el.textContent = ''; }, 3000);
}

// ---------------------------------------------------------------------------
// Dynamic UI helpers
// ---------------------------------------------------------------------------

function buildRepSelect(currentVal = 'cartoon'): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'rep-selector';
  for (const [key, schema] of Object.entries(AppConfig.RepSchema)) {
    select.add(new Option(schema.label, key));
  }
  select.value = currentVal;
  return select;
}

function updateSubParamsDrawer(
  drawer: HTMLDivElement,
  repType: string,
  storedValues: Record<string, unknown> = {},
): void {
  drawer.innerHTML = '';
  const schema = AppConfig.RepSchema[repType]?.params;

  if (!schema || Object.keys(schema).length === 0) {
    drawer.style.display = 'none';
    return;
  }

  drawer.style.display = 'block';
  for (const [paramName, paramType] of Object.entries(schema)) {
    const row   = document.createElement('div');
    row.className = 'drawer-row';
    const label = document.createElement('label');
    label.textContent = paramName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    row.appendChild(label);

    if (paramType === 'boolean') {
      const cb = document.createElement('input');
      cb.type  = 'checkbox';
      cb.dataset.param = paramName;
      cb.className     = 'subparam-input';
      cb.checked       = storedValues[paramName] === true;
      row.appendChild(cb);
    } else if (Array.isArray(paramType)) {
      const sel = document.createElement('select');
      sel.dataset.param = paramName;
      sel.className     = 'subparam-input';
      for (const opt of paramType) sel.add(new Option(opt as string, opt as string));
      if (storedValues[paramName]) sel.value = storedValues[paramName] as string;
      row.appendChild(sel);
    }
    drawer.appendChild(row);
  }
}

function buildColorInput(typeVal?: string, colorVal?: string): HTMLDivElement {
  const wrapper    = document.createElement('div');
  const typeSelect = document.createElement('select');
  typeSelect.className = 'color-type-selector';
  typeSelect.add(new Option('Mol* Theme',      'theme'));
  typeSelect.add(new Option('Solid Hex / X11', 'solid'));
  typeSelect.value = typeVal ?? 'theme';

  const dynamicArea = document.createElement('div');
  dynamicArea.className = 'color-dynamic-area';

  const renderDynamic = (): void => {
    dynamicArea.innerHTML = '';
    if (typeSelect.value === 'theme') {
      const themeSel = document.createElement('select');
      themeSel.className = 'color-val-input';
      themeSel.add(new Option('By Chain',           'chain-id'));
      themeSel.add(new Option('By Atom Type',       'element-symbol'));
      themeSel.add(new Option('Secondary Structure','secondary-structure'));
      const THEME_COLORS = new Set(['chain-id', 'element-symbol', 'secondary-structure']);
      themeSel.value = colorVal && THEME_COLORS.has(colorVal) ? colorVal : 'chain-id';
      dynamicArea.appendChild(themeSel);
    } else {
      const group  = document.createElement('div');
      group.className = 'color-input-group';
      const picker = document.createElement('input');
      picker.type  = 'color';
      picker.className = 'color-picker';
      const text   = document.createElement('input');
      text.type    = 'text';
      text.className = 'color-val-input color-text';
      text.placeholder = 'e.g. #ff0000';

      const THEME_COLORS = new Set(['chain-id', 'element-symbol', 'secondary-structure']);
      const initVal = colorVal && !THEME_COLORS.has(colorVal) ? colorVal : '#ff0000';
      text.value   = initVal;
      if (initVal.startsWith('#') && initVal.length === 7) picker.value = initVal;
      picker.addEventListener('input', (e) => { text.value = (e.target as HTMLInputElement).value; });

      group.appendChild(picker);
      group.appendChild(text);
      dynamicArea.appendChild(group);
    }
  };

  typeSelect.addEventListener('change', renderDynamic);
  renderDynamic();
  wrapper.appendChild(typeSelect);
  wrapper.appendChild(dynamicArea);
  return wrapper;
}

// ---------------------------------------------------------------------------
// 1. Build the main UI (scene settings + per-target cards)
// ---------------------------------------------------------------------------

const sceneContainer  = document.getElementById('scene-settings-container') as HTMLDivElement;
const targetContainer = document.getElementById('settings-container')       as HTMLDivElement;
const rulesContainer  = document.getElementById('custom-rules-container')   as HTMLDivElement;

function buildUI(): void {
  sceneContainer.innerHTML = `
    <details class="target-card" id="scene-card">
      <summary><span>Canvas &amp; Camera</span><span style="font-size:10px;opacity:.5">▼</span></summary>
      <div class="card-content">
        <div class="setting-row">
          <label>Background Color</label>
          <div class="color-input-group">
            <input type="color" class="color-picker" id="canvas_color_picker" value="#ffffff">
            <input type="text"  class="color-text"   id="canvas_color" placeholder="e.g. white or #ffffff" value="#ffffff">
          </div>
        </div>
        <div class="setting-row">
          <label>Camera JSON (optional)</label>
          <textarea id="camera_json" placeholder='{"target":[0,0,0],"position":[50,50,50]}'></textarea>
        </div>
      </div>
    </details>`;

  (document.getElementById('canvas_color_picker') as HTMLInputElement)
    .addEventListener('input', (e) => {
      (document.getElementById('canvas_color') as HTMLInputElement).value =
        (e.target as HTMLInputElement).value;
    });

  targetContainer.innerHTML = '';

  for (const target of AppConfig.targets) {
    const card = document.createElement('details');
    card.className = 'target-card';
    card.id        = `card_${target.id}`;
    card.innerHTML = `<summary><span>${target.label}</span><span style="font-size:10px;opacity:.5">▼</span></summary><div class="card-content"></div>`;
    const content  = card.querySelector('.card-content') as HTMLDivElement;

    // — Representation row
    const repRow    = document.createElement('div');
    repRow.className = 'setting-row';
    repRow.innerHTML = '<label>Style</label>';
    const repSelect  = buildRepSelect();
    const repDrawer  = document.createElement('div');
    repDrawer.className = 'params-drawer target-drawer';
    repSelect.addEventListener('change', (e) => {
      updateSubParamsDrawer(repDrawer, (e.target as HTMLSelectElement).value);
    });
    repRow.appendChild(repSelect);
    repRow.appendChild(repDrawer);
    content.appendChild(repRow);

    // — Color row
    const colorRow = document.createElement('div');
    colorRow.className = 'setting-row';
    colorRow.innerHTML = '<label>Color</label>';
    colorRow.appendChild(buildColorInput());
    content.appendChild(colorRow);

    // — Size / Opacity row
    const modRow = document.createElement('div');
    modRow.className = 'flex-row';
    modRow.innerHTML = `
      <div style="flex:1"><label>Size Factor</label>
        <input type="number" class="size-input"    step="0.5" min="0.5" max="5.0" placeholder="1.0">
      </div>
      <div style="flex:1"><label>Opacity</label>
        <input type="number" class="opacity-input" step="0.1" min="0.0" max="1.0" placeholder="1.0">
      </div>`;
    content.appendChild(modRow);
    targetContainer.appendChild(card);
  }
}

// ---------------------------------------------------------------------------
// 2. Custom rule cards
// ---------------------------------------------------------------------------

function addCustomRuleCard(ruleData?: Partial<CustomRule>): void {
  const data: CustomRule = {
    name: 'New Rule', rep: 'highlight', colorType: 'solid', colorVal: 'red',
    size: '', opacity: '', mode: 'simple', scheme: 'auth',
    chain: '', ranges: '', specific: '', atomName: '', element: '', atomIndex: '',
    label: '', labelTextColor: '#000000', labelSize: '1.0',
    labelBorderWidth: '0.2', labelBorderColor: '#000000', tooltip: '', focus: false,
    rawJson: '{"auth_asym_id":"A"}', rawParamsJson: '{}', subParams: {},
    ...(ruleData ?? {}),
  };

  const card = document.createElement('details');
  card.className = 'target-card custom-rule-card';
  card.open      = true;

  card.innerHTML = `
    <summary>
      <span class="rule-title-display">${escapeHTML(data.name)}</span>
      <div style="display:flex;align-items:center;gap:10px">
        <button class="danger-outline delete-rule-btn"
          style="padding:2px 8px;width:auto;font-size:11px">Delete</button>
        <span style="font-size:10px;opacity:.5">▼</span>
      </div>
    </summary>
    <div class="card-content">
      <div class="flex-row">
        <div style="flex:2"><label>Rule Name</label>
          <input type="text" class="cr-name" value="${escapeHTML(data.name)}">
        </div>
        <div style="flex:1"><label>Mode</label>
          <select class="cr-mode">
            <option value="simple">Simple</option>
            <option value="expert">Expert</option>
          </select>
        </div>
        <div style="flex:1"><label>Numbering</label>
          <select class="cr-scheme">
            <option value="auth">auth_*</option>
            <option value="label">label_*</option>
          </select>
        </div>
      </div>

      <div class="rule-section cr-simple-container">
        <div class="rule-section-title">Target Selection</div>
        <div class="grid-6">
          <div><label>Chain</label>
            <input type="text" class="cr-chain"      value="${escapeHTML(data.chain)}"      placeholder="A">
          </div>
          <div><label>Res Range</label>
            <input type="text" class="cr-ranges"     value="${escapeHTML(data.ranges)}"     placeholder="5-50">
          </div>
          <div><label>Specific Res</label>
            <input type="text" class="cr-specific"   value="${escapeHTML(data.specific)}"   placeholder="10,15">
          </div>
          <div><label>Atom</label>
            <input type="text" class="cr-atom"       value="${escapeHTML(data.atomName)}"   placeholder="CA">
          </div>
          <div><label>Element</label>
            <input type="text" class="cr-element"    value="${escapeHTML(data.element)}"    placeholder="FE">
          </div>
          <div><label>Atom Idx</label>
            <input type="text" class="cr-atom-index" value="${escapeHTML(data.atomIndex)}"  placeholder="100">
          </div>
        </div>
      </div>

      <div class="rule-section cr-expert-container" style="display:none">
        <div class="rule-section-title">Raw JSON Selectors (Legacy)</div>
        <div class="flex-row">
          <div><label>Target Selector</label>
            <textarea class="cr-json">${escapeHTML(data.rawJson)}</textarea>
          </div>
          <div><label>Advanced Rep Params</label>
            <textarea class="cr-params-json" placeholder='{"ignore_hydrogens":true}'>${escapeHTML(data.rawParamsJson)}</textarea>
          </div>
        </div>
      </div>

      <div class="rule-section">
        <div class="rule-section-title">Appearance</div>
        <div class="flex-row">
          <div style="flex:1.5" class="cr-rep-container">
            <label>Style</label>
            <select class="cr-rep">
              <option value="highlight">Color Highlight Only</option>
              ${Object.keys(AppConfig.RepSchema)
                .filter(k => k !== 'off')
                .map(k => `<option value="${k}">Spawn: ${AppConfig.RepSchema[k].label}</option>`)
                .join('')}
            </select>
            <div class="params-drawer cr-drawer"></div>
          </div>
          <div style="flex:1.5" class="cr-color-container"><label>Color</label></div>
          <div style="flex:.5">
            <label>Size</label>
            <input type="number" class="cr-size"    value="${escapeHTML(data.size)}"    step="0.5" min="0.5" max="5.0" placeholder="1.0">
          </div>
          <div style="flex:.5">
            <label>Opacity</label>
            <input type="number" class="cr-opacity" value="${escapeHTML(data.opacity)}" step="0.1" min="0"   max="1.0" placeholder="1.0">
          </div>
        </div>
      </div>

      <div class="rule-section">
        <div class="rule-section-title">Annotations &amp; View</div>
        
        <div class="flex-row" style="align-items:flex-end; margin-bottom: 8px;">
          <div style="flex:2">
            <label>Floating 3D Label</label>
            <input type="text" class="cr-label" value="${escapeHTML(data.label)}" placeholder="e.g. Active Site">
          </div>
          <div style="flex:0.8">
            <label>Text Size</label>
            <input type="number" class="cr-label-size" value="${escapeHTML(data.labelSize || '1.0')}" step="0.1" min="0.1" max="5.0" placeholder="1.0">
          </div>
          <div style="flex:0.8">
            <label>Text Color</label>
            <div style="display:flex; align-items:center;">
               <input type="color" class="cr-label-text-color" value="${escapeHTML(data.labelTextColor || '#ffffff')}" style="height:26px; padding:0; cursor:pointer;">
            </div>
          </div>
          <div style="flex:0.8">
            <label>Border Size</label>
            <input type="number" class="cr-label-border-width" value="${escapeHTML(data.labelBorderWidth)}" step="0.1" min="0" max="1.0" placeholder="0.2">
          </div>
          <div style="flex:0.8">
            <label>Border Color</label>
            <div style="display:flex; align-items:center;">
               <input type="color" class="cr-label-border-color" value="${escapeHTML(data.labelBorderColor)}" style="height:26px; padding:0; cursor:pointer;">
            </div>
          </div>
        </div>

        <div class="flex-row" style="align-items:center">
          <div style="flex:4">
            <label>Hover Tooltip Badge</label>
            <input type="text" class="cr-tooltip" value="${escapeHTML(data.tooltip)}" placeholder="e.g. Binds ATP">
          </div>
          <div style="flex:1.5; padding-left: 10px;">
            <label style="display:inline-flex;align-items:center;cursor:pointer;margin:0;">
              <input type="checkbox" class="cr-focus" ${data.focus ? 'checked' : ''} style="width:16px;height:16px;margin:0 8px 0 0">
              Focus Camera
            </label>
          </div>
        </div>
      </div>
      </div>
    </div>`;

  // Inject color input widget
  (card.querySelector('.cr-color-container') as HTMLDivElement)
    .appendChild(buildColorInput(data.colorType, data.colorVal));

  // Restore select values
  (card.querySelector('.cr-mode')   as HTMLSelectElement).value = data.mode;
  (card.querySelector('.cr-scheme') as HTMLSelectElement).value = data.scheme ?? 'auth';

  const repSelect = card.querySelector('.cr-rep')    as HTMLSelectElement;
  const repDrawer = card.querySelector('.cr-drawer') as HTMLDivElement;
  repSelect.value = data.rep ?? 'highlight';
  repSelect.addEventListener('change', (e) => {
    updateSubParamsDrawer(repDrawer, (e.target as HTMLSelectElement).value);
  });
  updateSubParamsDrawer(repDrawer, repSelect.value, data.subParams as Record<string, unknown>);

  // Delete button
  card.querySelector('.delete-rule-btn')?.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation(); card.remove();
  });

  // Live-update summary title
  (card.querySelector('.cr-name') as HTMLInputElement).addEventListener('input', (e) => {
    (card.querySelector('.rule-title-display') as HTMLSpanElement).textContent =
      (e.target as HTMLInputElement).value || 'Unnamed Rule';
  });

  // Simple ↔ Expert mode toggle
  const modeSelect  = card.querySelector('.cr-mode')             as HTMLSelectElement;
  const schemeSelect= card.querySelector('.cr-scheme')           as HTMLSelectElement;
  const simpleDiv   = card.querySelector('.cr-simple-container') as HTMLDivElement;
  const expertDiv   = card.querySelector('.cr-expert-container') as HTMLDivElement;
  const jsonBox     = card.querySelector('.cr-json')             as HTMLTextAreaElement;

  const updateVisibility = (): void => {
    if (modeSelect.value === 'simple') {
      simpleDiv.style.display = 'block';
      expertDiv.style.display = 'none';
      (schemeSelect.parentElement as HTMLElement).style.display = 'block';
    } else {
      // Auto-populate the JSON textarea from the simple fields
      const prefix = schemeSelect.value === 'label' ? 'label' : 'auth';
      const base: Record<string, unknown> = {};
      const ch = (card.querySelector('.cr-chain')   as HTMLInputElement).value.trim();
      const at = (card.querySelector('.cr-atom')    as HTMLInputElement).value.trim();
      const el = (card.querySelector('.cr-element') as HTMLInputElement).value.trim();
      if (ch) base[`${prefix}_asym_id`] = ch;
      if (at) base[`${prefix}_atom_id`] = at;
      if (el) base['type_symbol']       = el;

      const selectors: Record<string, unknown>[] = [];
      const ranges   = (card.querySelector('.cr-ranges')     as HTMLInputElement).value.trim();
      const specific = (card.querySelector('.cr-specific')   as HTMLInputElement).value.trim();
      const idxs     = (card.querySelector('.cr-atom-index') as HTMLInputElement).value.trim();

      if (ranges)   ranges.split(',').forEach(p => {
        const b = p.trim().split('-');
        if (b.length === 2) selectors.push({ ...base,
          [`beg_${prefix}_seq_id`]: parseInt(b[0]), [`end_${prefix}_seq_id`]: parseInt(b[1]) });
      });
      if (specific) specific.split(',').forEach(p => {
        if (!isNaN(parseInt(p))) selectors.push({ ...base, [`${prefix}_seq_id`]: parseInt(p) });
      });
      if (idxs)     idxs.split(',').forEach(p => {
        if (!isNaN(parseInt(p))) selectors.push({ ...base, atom_index: parseInt(p) });
      });

      if (selectors.length === 0 && Object.keys(base).length > 0) selectors.push(base);
      jsonBox.value = JSON.stringify(selectors.length === 1 ? selectors[0] : selectors.length > 1 ? selectors : {}, null, 2);

      simpleDiv.style.display = 'none';
      expertDiv.style.display = 'block';
      (schemeSelect.parentElement as HTMLElement).style.display = 'none';
    }
  };

  modeSelect.addEventListener('change',  updateVisibility);
  schemeSelect.addEventListener('change', updateVisibility);
  updateVisibility();

  rulesContainer.appendChild(card);
}

document.getElementById('add-custom-rule')?.addEventListener('click', () => addCustomRuleCard());

// ---------------------------------------------------------------------------
// 3. Extract current UI state into an ExtensionSettings object
// ---------------------------------------------------------------------------

function extractCurrentSettings(): ExtensionSettings {
  const s: Record<string, unknown> = { ...AppConfig.getDefaults() };

  s.canvas_color = (document.getElementById('canvas_color') as HTMLInputElement).value;
  s.camera_json  = (document.getElementById('camera_json')  as HTMLTextAreaElement).value;

  for (const target of AppConfig.targets) {
    const card = document.getElementById(`card_${target.id}`);
    if (!card) continue;
    s[`${target.id}_rep`]       = (card.querySelector('.rep-selector')       as HTMLSelectElement).value;
    s[`${target.id}_colorType`] = (card.querySelector('.color-type-selector') as HTMLSelectElement).value;
    s[`${target.id}_colorVal`]  = (card.querySelector('.color-val-input')     as HTMLInputElement).value;
    s[`${target.id}_size`]      = (card.querySelector('.size-input')          as HTMLInputElement).value;
    s[`${target.id}_opacity`]   = (card.querySelector('.opacity-input')       as HTMLInputElement).value;

    const subParams: Record<string, unknown> = {};
    card.querySelectorAll<HTMLInputElement>('.target-drawer .subparam-input').forEach(input => {
      subParams[input.dataset.param!] = input.type === 'checkbox' ? input.checked : input.value;
    });
    s[`${target.id}_subParams`] = subParams;
  }

  const customRules: CustomRule[] = [];
  document.querySelectorAll<HTMLElement>('.custom-rule-card').forEach(card => {
    const rule: CustomRule = {
      name:         (card.querySelector('.cr-name')       as HTMLInputElement).value,
      rep:          (card.querySelector('.cr-rep')         as HTMLSelectElement).value as CustomRule['rep'],
      colorType:    (card.querySelector('.color-type-selector') as HTMLSelectElement).value as 'theme' | 'solid',
      colorVal:     (card.querySelector('.color-val-input')     as HTMLInputElement).value,
      size:         (card.querySelector('.cr-size')        as HTMLInputElement).value,
      opacity:      (card.querySelector('.cr-opacity')     as HTMLInputElement).value,
      mode:         (card.querySelector('.cr-mode')        as HTMLSelectElement).value as 'simple' | 'expert',
      scheme:       (card.querySelector('.cr-scheme')      as HTMLSelectElement).value as 'auth' | 'label',
      chain:        (card.querySelector('.cr-chain')       as HTMLInputElement).value.trim(),
      ranges:       (card.querySelector('.cr-ranges')      as HTMLInputElement).value.trim(),
      specific:     (card.querySelector('.cr-specific')    as HTMLInputElement).value.trim(),
      atomName:     (card.querySelector('.cr-atom')        as HTMLInputElement).value.trim(),
      element:      (card.querySelector('.cr-element')     as HTMLInputElement).value.trim(),
      atomIndex:    (card.querySelector('.cr-atom-index')  as HTMLInputElement).value.trim(),
      label:            (card.querySelector('.cr-label')               as HTMLInputElement).value.trim(),
      labelSize:        (card.querySelector('.cr-label-size')          as HTMLInputElement)?.value || '1.0',
      labelTextColor:   (card.querySelector('.cr-label-text-color')    as HTMLInputElement)?.value || '#ffffff',
      labelBorderWidth: (card.querySelector('.cr-label-border-width')  as HTMLInputElement)?.value || '0.2',
      labelBorderColor: (card.querySelector('.cr-label-border-color')  as HTMLInputElement)?.value || '#000000',
      tooltip:          (card.querySelector('.cr-tooltip')             as HTMLInputElement).value.trim(),
      focus:        (card.querySelector('.cr-focus')       as HTMLInputElement).checked,
      rawJson:      (card.querySelector('.cr-json')        as HTMLTextAreaElement).value,
      rawParamsJson:(card.querySelector('.cr-params-json') as HTMLTextAreaElement).value,
      subParams:    {},
    };

    card.querySelectorAll<HTMLInputElement>('.cr-drawer .subparam-input').forEach(input => {
      rule.subParams[input.dataset.param!] = input.type === 'checkbox' ? input.checked : input.value;
    });

    // Compute the structured selector from the active mode
    try {
      const raw = rule.rawJson.trim();
      rule.selector = (raw.startsWith('{') || raw.startsWith('['))
        ? JSON.parse(raw) as Record<string, unknown>
        : raw;
    } catch { rule.selector = {}; }

    if (rule.mode === 'expert') {
      try { rule.advancedParams = JSON.parse(rule.rawParamsJson); } catch { rule.advancedParams = {}; }
    }

    customRules.push(rule);
  });

  s.customRules = customRules;
  return s as ExtensionSettings;
}

// ---------------------------------------------------------------------------
// 4. Inject a settings object back into the UI
// ---------------------------------------------------------------------------

function injectSettingsIntoUI(settingsObj: ExtensionSettings): void {
  sceneContainer.innerHTML  = '';
  targetContainer.innerHTML = '';
  rulesContainer.innerHTML  = '';
  buildUI();

  const canvasInput = document.getElementById('canvas_color') as HTMLInputElement;
  const pickerInput = document.getElementById('canvas_color_picker') as HTMLInputElement;
  if (settingsObj.canvas_color) {
    canvasInput.value = settingsObj.canvas_color as string;
    if ((settingsObj.canvas_color as string).startsWith('#')) pickerInput.value = settingsObj.canvas_color as string;
  }
  if (settingsObj.camera_json) {
    (document.getElementById('camera_json') as HTMLTextAreaElement).value = settingsObj.camera_json as string;
  }

  for (const target of AppConfig.targets) {
    const card = document.getElementById(`card_${target.id}`);
    if (!card) continue;

    const repVal = settingsObj[`${target.id}_rep`] as string | undefined;
    if (repVal) {
      const repSel = card.querySelector('.rep-selector') as HTMLSelectElement;
      repSel.value = repVal;
      updateSubParamsDrawer(
        card.querySelector('.target-drawer') as HTMLDivElement,
        repVal,
        (settingsObj[`${target.id}_subParams`] as Record<string, unknown>) ?? {},
      );
    }

    const colorType = settingsObj[`${target.id}_colorType`] as string | undefined;
    const colorVal  = settingsObj[`${target.id}_colorVal`]  as string | undefined;
    if (colorType) {
      const existing = card.querySelector('.color-type-selector');
      existing?.parentElement?.replaceWith(buildColorInput(colorType, colorVal));
    }

    const sizeVal    = settingsObj[`${target.id}_size`]    as string | undefined;
    const opacityVal = settingsObj[`${target.id}_opacity`] as string | undefined;
    if (sizeVal)    (card.querySelector('.size-input')    as HTMLInputElement).value = sizeVal;
    if (opacityVal) (card.querySelector('.opacity-input') as HTMLInputElement).value = opacityVal;
  }

  if (Array.isArray(settingsObj.customRules)) {
    settingsObj.customRules.forEach(rule => addCustomRuleCard(rule));
  }
}

// ---------------------------------------------------------------------------
// 5. Template / preset management
// ---------------------------------------------------------------------------

let customTemplates: Record<string, Preset> = {};

function updateTemplateDropdown(): void {
  const select = document.getElementById('template-select') as HTMLSelectElement;
  select.innerHTML = '';
  for (const [key, preset] of Object.entries(AppConfig.presets)) {
    select.add(new Option(`[Built-in] ${preset.name}`, `builtin_${key}`));
  }
  for (const [key, tpl] of Object.entries(customTemplates)) {
    select.add(new Option(`[Custom] ${tpl.name}`, `custom_${key}`));
  }
}

document.getElementById('load-template')?.addEventListener('click', () => {
  const val = (document.getElementById('template-select') as HTMLSelectElement).value;
  const overrides = val.startsWith('builtin_')
    ? AppConfig.presets[val.replace('builtin_', '')]?.settings ?? {}
    : customTemplates[val.replace('custom_', '')]?.settings    ?? {};
  injectSettingsIntoUI({ ...AppConfig.getDefaults(), ...overrides });
  showStatus('Template loaded!');
});

document.getElementById('delete-template')?.addEventListener('click', () => {
  const val = (document.getElementById('template-select') as HTMLSelectElement).value;
  if (val.startsWith('builtin_')) { alert('Cannot delete built-in presets.'); return; }
  const id = val.replace('custom_', '');
  if (confirm(`Delete "${customTemplates[id]?.name}"?`)) {
    delete customTemplates[id];
    StorageAPI.set({ customTemplates: customTemplates as unknown as Record<string, unknown> }, () => {
      updateTemplateDropdown();
      showStatus('Deleted.');
    });
  }
});

document.getElementById('save-template')?.addEventListener('click', () => {
  const name = (document.getElementById('new-template-name') as HTMLInputElement).value.trim();
  if (!name) { alert('A template name is required.'); return; }

  const current = extractCurrentSettings();
  const existingId = Object.keys(customTemplates).find(
    k => customTemplates[k].name.toLowerCase() === name.toLowerCase(),
  );
  if (existingId && !confirm(`Overwrite "${name}"?`)) return;

  const id = existingId ?? `user_tpl_${Date.now()}`;
  customTemplates[id] = { name, settings: current };
  StorageAPI.set({ customTemplates: customTemplates as unknown as Record<string, unknown> }, () => {
    updateTemplateDropdown();
    (document.getElementById('new-template-name') as HTMLInputElement).value = '';
    showStatus('Saved!');
  });
});

// ---------------------------------------------------------------------------
// 6. Export / Import
// ---------------------------------------------------------------------------

document.getElementById('export-json')?.addEventListener('click', () => {
  const a = document.createElement('a');
  a.setAttribute(
    'href',
    'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(extractCurrentSettings(), null, 2)),
  );
  a.setAttribute('download', 'molstar_settings.json');
  document.body.appendChild(a);
  a.click();
  a.remove();
});

document.getElementById('import-json')?.addEventListener('change', (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target?.result as string) as Record<string, unknown>;
      const safe   = { ...AppConfig.getDefaults() } as Record<string, unknown>;

      // FIX F5: Only import keys that exist in the schema (prevents rogue-key injection)
      for (const key of Object.keys(safe)) {
        if (key in parsed) safe[key] = parsed[key];
      }

      // Validate and cap custom rules array
      if (Array.isArray(parsed.customRules)) {
        safe.customRules = (parsed.customRules as unknown[])
          .filter(r => r && typeof r === 'object')
          .map(r => {
            const rule = r as Partial<CustomRule>;
            return {
              name: rule.name ?? '', rep: rule.rep ?? 'highlight',
              colorType: rule.colorType ?? 'solid', colorVal: rule.colorVal ?? '#ffffff',
              size: rule.size ?? '', opacity: rule.opacity ?? '',
              mode: rule.mode ?? 'simple', scheme: rule.scheme ?? 'auth',
              chain: rule.chain ?? '', ranges: rule.ranges ?? '',
              specific: rule.specific ?? '', atomName: rule.atomName ?? '',
              element: rule.element ?? '', atomIndex: rule.atomIndex ?? '',
              label: rule.label ?? '', tooltip: rule.tooltip ?? '',
              focus: !!rule.focus, rawJson: rule.rawJson ?? '{}',
              rawParamsJson: rule.rawParamsJson ?? '{}',
              subParams: (typeof rule.subParams === 'object' && rule.subParams) ? rule.subParams : {},
            } satisfies CustomRule;
          })
          .slice(0, 50);
      }

      injectSettingsIntoUI(safe as ExtensionSettings);
      showStatus('Imported!');
    } catch {
      showStatus('Invalid JSON file.', true);
    }
  };
  reader.readAsText(file);
  (e.target as HTMLInputElement).value = '';
});

// ---------------------------------------------------------------------------
// 7. Save button
// ---------------------------------------------------------------------------

document.getElementById('save')?.addEventListener('click', () => {
  StorageAPI.set(extractCurrentSettings() as unknown as Record<string, unknown>, () => showStatus('Applied!'));
});

// ---------------------------------------------------------------------------
// 8. Domain management
// ---------------------------------------------------------------------------

function refreshCustomDomainList(): void {
  const list = document.getElementById('custom-domains-list');
  if (!list) return;

  StorageAPI.get({ customDomains: [] }, (data) => {
    const domains = (data.customDomains as string[]) ?? [];

    if (domains.length === 0) {
      list.innerHTML = '<p style="color:#57606a;font-style:italic;font-size:13px">No custom domains authorized yet.</p>';
      return;
    }

    list.innerHTML = '';
    for (const domain of domains) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;margin-bottom:8px';
      // escapeHTML used for domain before injecting into innerHTML
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
          <span>🌐</span><span style="font-weight:500">${escapeHTML(domain)}</span>
        </div>
        <button class="danger-outline remove-domain-btn"
          data-domain="${escapeHTML(domain)}"
          style="padding:4px 10px;font-size:12px">Remove</button>`;
      list.appendChild(row);
    }

    list.querySelectorAll<HTMLButtonElement>('.remove-domain-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const dom = (e.target as HTMLButtonElement).dataset.domain!;
        if (confirm(`Revoke access for ${dom}?`)) {
          await PermissionsManager.revokeAndUnregister(dom);
          refreshCustomDomainList();
        }
      });
    });
  });
}

document.getElementById('add-manual-domain')?.addEventListener('click', async () => {
  const input = document.getElementById('manual-domain-input') as HTMLInputElement;
  const dom   = input.value.trim();
  if (!dom) return;
  if (await PermissionsManager.requestAndRegister(dom)) {
    input.value = '';
    refreshCustomDomainList();
  }
});

// ---------------------------------------------------------------------------
// 9. Initialisation
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  StorageAPI.get(null, (savedItems) => {
    customTemplates = (savedItems.customTemplates as Record<string, Preset>) ?? {};
    updateTemplateDropdown();
    injectSettingsIntoUI({ ...AppConfig.getDefaults(), ...savedItems } as ExtensionSettings);
  });

  refreshCustomDomainList();

  // If the popup or viewer redirected here with a ?domain= param,
  // pre-fill the manual domain input and scroll to it
  const autoDomain = new URLSearchParams(window.location.search).get('domain');
  if (autoDomain) {
    const input = document.getElementById('manual-domain-input') as HTMLInputElement | null;
    if (input) {
      input.value = autoDomain;
      input.focus();
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  }
});
