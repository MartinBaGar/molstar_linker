"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/config.ts
  function getDefaults() {
    const THEME_COLORS = /* @__PURE__ */ new Set(["chain-id", "element-symbol", "secondary-structure"]);
    const defaults = {
      canvas_color: "#ffffff",
      camera_json: "",
      customRules: []
    };
    for (const t of targets) {
      defaults[`${t.id}_rep`] = t.rep;
      defaults[`${t.id}_colorType`] = THEME_COLORS.has(t.color) ? "theme" : "solid";
      defaults[`${t.id}_colorVal`] = t.color;
      if (t.size !== null) defaults[`${t.id}_size`] = t.size;
    }
    return defaults;
  }
  var RepSchema, targets, presets, AppConfig;
  var init_config = __esm({
    "src/config.ts"() {
      "use strict";
      RepSchema = {
        cartoon: { label: "Cartoon", params: { tubular_helices: "boolean" } },
        backbone: { label: "Backbone", params: {} },
        ball_and_stick: { label: "Ball & Stick", params: { ignore_hydrogens: "boolean" } },
        line: { label: "Line", params: { ignore_hydrogens: "boolean" } },
        spacefill: { label: "Spacefill", params: { ignore_hydrogens: "boolean" } },
        carbohydrate: { label: "Carbohydrate", params: {} },
        putty: { label: "Putty", params: { size_theme: ["uniform", "uncertainty"] } },
        surface: { label: "Surface", params: { surface_type: ["molecular", "gaussian"], ignore_hydrogens: "boolean" } },
        off: { label: "Hide / Off", params: {} }
      };
      targets = [
        { id: "protein", selector: "protein", label: "Proteins", rep: "cartoon", color: "chain-id", size: null },
        { id: "nucleic", selector: "nucleic", label: "Nucleic Acids (DNA/RNA)", rep: "cartoon", color: "chain-id", size: null },
        { id: "ligand", selector: "ligand", label: "Ligands & Small Molecules", rep: "ball_and_stick", color: "element-symbol", size: 1 },
        { id: "carbs", selector: "branched", label: "Carbohydrates & Glycans", rep: "carbohydrate", color: "chain-id", size: null },
        { id: "ion", selector: "ion", label: "Single Ions", rep: "ball_and_stick", color: "element-symbol", size: 0.7 },
        { id: "lipid", selector: "lipid", label: "Lipids", rep: "line", color: "element-symbol", size: 0.7, mvsSelector: null },
        { id: "water", selector: "water", label: "Water / Solvent", rep: "line", color: "element-symbol", size: null },
        { id: "all", selector: "all", label: "All", rep: "ball_and_stick", color: "element-symbol", size: 1 }
      ];
      presets = {
        standard: {
          name: "Standard Mol* (Smart Guess)",
          settings: {}
        },
        surface_focus: {
          name: "Protein Surface + Spacefill Ligands",
          settings: {
            protein_rep: "surface",
            protein_colorType: "theme",
            protein_colorVal: "chain-id",
            nucleic_rep: "surface",
            nucleic_colorType: "theme",
            nucleic_colorVal: "chain-id",
            ligand_rep: "spacefill",
            ligand_colorType: "theme",
            ligand_colorVal: "element-symbol",
            water_rep: "off",
            canvas_color: "#ffffff"
          }
        },
        dark_mode: {
          name: "Dark Mode Canvas",
          settings: { canvas_color: "#111111" }
        },
        all_uniform: {
          name: "Uniform Ball & Stick",
          settings: { protein_rep: "ball_and_stick", protein_colorType: "theme", protein_colorVal: "element-symbol" }
        }
      };
      AppConfig = {
        RepSchema,
        targets,
        presets,
        getDefaults
      };
    }
  });

  // src/permissions.ts
  var PermissionsManager;
  var init_permissions = __esm({
    "src/permissions.ts"() {
      "use strict";
      PermissionsManager = {
        // Pick the right API object at runtime (Firefox uses `browser`, Chrome uses `chrome`)
        core: typeof browser !== "undefined" ? browser : chrome,
        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------
        cleanDomain(url) {
          try {
            const parsed = new URL(url.includes("://") ? url : `https://${url}`);
            return parsed.hostname;
          } catch {
            return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
          }
        },
        getMatchPattern(domain) {
          return `*://${this.cleanDomain(domain)}/*`;
        },
        getScriptId(domain) {
          return `ms-script-${this.cleanDomain(domain).replace(/\./g, "-")}`;
        },
        // ------------------------------------------------------------------
        // requestAndRegister
        //
        // IMPORTANT (Firefox): We must call permissions.request() IMMEDIATELY
        // inside a user-gesture handler. Any `await` before this call kills the
        // user-gesture context and the permission dialog will be silently blocked.
        // ------------------------------------------------------------------
        async requestAndRegister(url) {
          const domain = this.cleanDomain(url);
          const pattern = this.getMatchPattern(domain);
          const id = this.getScriptId(domain);
          try {
            const granted = await new Promise((resolve) => {
              this.core.permissions.request({ origins: [pattern] }, resolve);
            });
            if (!granted) return false;
            if (this.core.scripting?.registerContentScripts) {
              const existing = await this.core.scripting.getRegisteredContentScripts({ ids: [id] });
              if (existing.length === 0) {
                await this.core.scripting.registerContentScripts([{
                  id,
                  matches: [pattern],
                  js: ["content.js"],
                  runAt: "document_end"
                }]);
              }
            }
            const data = await this.core.storage.sync.get({ customDomains: [] });
            if (!data.customDomains.includes(domain)) {
              data.customDomains.push(domain);
              await this.core.storage.sync.set({ customDomains: data.customDomains });
            }
            return true;
          } catch (err) {
            console.error("Molstar Linker \u2014 permission error:", err);
            return false;
          }
        },
        // ------------------------------------------------------------------
        // revokeAndUnregister
        // ------------------------------------------------------------------
        async revokeAndUnregister(url) {
          const domain = this.cleanDomain(url);
          const pattern = this.getMatchPattern(domain);
          const id = this.getScriptId(domain);
          try {
            await this.core.scripting?.unregisterContentScripts({ ids: [id] }).catch(() => {
            });
            await new Promise((resolve) => this.core.permissions.remove({ origins: [pattern] }, resolve));
            const data = await this.core.storage.sync.get({ customDomains: [] });
            await this.core.storage.sync.set({
              customDomains: data.customDomains.filter((d) => d !== domain)
            });
            return true;
          } catch {
            return false;
          }
        }
      };
    }
  });

  // src/options.ts
  var require_options = __commonJS({
    "src/options.ts"() {
      init_config();
      init_permissions();
      var extApi = typeof browser !== "undefined" ? browser : chrome;
      var StorageAPI = {
        get(keys, cb) {
          extApi.storage.sync.get(keys, cb);
        },
        set(data, cb) {
          if (cb) {
            extApi.storage.sync.set(data, cb);
          } else {
            extApi.storage.sync.set(data);
          }
        }
      };
      function escapeHTML(str) {
        if (typeof str !== "string") return "";
        return str.replace(/[&<>'"]/g, (tag) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;"
        })[tag] ?? "");
      }
      function showStatus(message, isError = false) {
        const el = document.getElementById("status");
        if (!el) return;
        el.textContent = message;
        el.style.color = isError ? "var(--danger)" : "var(--success)";
        setTimeout(() => {
          el.textContent = "";
        }, 3e3);
      }
      function buildRepSelect(currentVal = "cartoon") {
        const select = document.createElement("select");
        select.className = "rep-selector";
        for (const [key, schema] of Object.entries(AppConfig.RepSchema)) {
          select.add(new Option(schema.label, key));
        }
        select.value = currentVal;
        return select;
      }
      function updateSubParamsDrawer(drawer, repType, storedValues = {}) {
        drawer.innerHTML = "";
        const schema = AppConfig.RepSchema[repType]?.params;
        if (!schema || Object.keys(schema).length === 0) {
          drawer.style.display = "none";
          return;
        }
        drawer.style.display = "block";
        for (const [paramName, paramType] of Object.entries(schema)) {
          const row = document.createElement("div");
          row.className = "drawer-row";
          const label = document.createElement("label");
          label.textContent = paramName.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
          row.appendChild(label);
          if (paramType === "boolean") {
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.dataset.param = paramName;
            cb.className = "subparam-input";
            cb.checked = storedValues[paramName] === true;
            row.appendChild(cb);
          } else if (Array.isArray(paramType)) {
            const sel = document.createElement("select");
            sel.dataset.param = paramName;
            sel.className = "subparam-input";
            for (const opt of paramType) sel.add(new Option(opt, opt));
            if (storedValues[paramName]) sel.value = storedValues[paramName];
            row.appendChild(sel);
          }
          drawer.appendChild(row);
        }
      }
      function buildColorInput(typeVal, colorVal) {
        const wrapper = document.createElement("div");
        const typeSelect = document.createElement("select");
        typeSelect.className = "color-type-selector";
        typeSelect.add(new Option("Mol* Theme", "theme"));
        typeSelect.add(new Option("Solid Hex / X11", "solid"));
        typeSelect.value = typeVal ?? "theme";
        const dynamicArea = document.createElement("div");
        dynamicArea.className = "color-dynamic-area";
        const renderDynamic = () => {
          dynamicArea.innerHTML = "";
          if (typeSelect.value === "theme") {
            const themeSel = document.createElement("select");
            themeSel.className = "color-val-input";
            themeSel.add(new Option("By Chain", "chain-id"));
            themeSel.add(new Option("By Atom Type", "element-symbol"));
            themeSel.add(new Option("Secondary Structure", "secondary-structure"));
            const THEME_COLORS = /* @__PURE__ */ new Set(["chain-id", "element-symbol", "secondary-structure"]);
            themeSel.value = colorVal && THEME_COLORS.has(colorVal) ? colorVal : "chain-id";
            dynamicArea.appendChild(themeSel);
          } else {
            const group = document.createElement("div");
            group.className = "color-input-group";
            const picker = document.createElement("input");
            picker.type = "color";
            picker.className = "color-picker";
            const text = document.createElement("input");
            text.type = "text";
            text.className = "color-val-input color-text";
            text.placeholder = "e.g. #ff0000";
            const THEME_COLORS = /* @__PURE__ */ new Set(["chain-id", "element-symbol", "secondary-structure"]);
            const initVal = colorVal && !THEME_COLORS.has(colorVal) ? colorVal : "#ff0000";
            text.value = initVal;
            if (initVal.startsWith("#") && initVal.length === 7) picker.value = initVal;
            picker.addEventListener("input", (e) => {
              text.value = e.target.value;
            });
            group.appendChild(picker);
            group.appendChild(text);
            dynamicArea.appendChild(group);
          }
        };
        typeSelect.addEventListener("change", renderDynamic);
        renderDynamic();
        wrapper.appendChild(typeSelect);
        wrapper.appendChild(dynamicArea);
        return wrapper;
      }
      var sceneContainer = document.getElementById("scene-settings-container");
      var targetContainer = document.getElementById("settings-container");
      var rulesContainer = document.getElementById("custom-rules-container");
      function buildUI() {
        sceneContainer.innerHTML = `
    <details class="target-card" id="scene-card">
      <summary><span>Canvas &amp; Camera</span><span style="font-size:10px;opacity:.5">\u25BC</span></summary>
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
        document.getElementById("canvas_color_picker").addEventListener("input", (e) => {
          document.getElementById("canvas_color").value = e.target.value;
        });
        targetContainer.innerHTML = "";
        for (const target of AppConfig.targets) {
          const card = document.createElement("details");
          card.className = "target-card";
          card.id = `card_${target.id}`;
          card.innerHTML = `<summary><span>${target.label}</span><span style="font-size:10px;opacity:.5">\u25BC</span></summary><div class="card-content"></div>`;
          const content = card.querySelector(".card-content");
          const repRow = document.createElement("div");
          repRow.className = "setting-row";
          repRow.innerHTML = "<label>Style</label>";
          const repSelect = buildRepSelect();
          const repDrawer = document.createElement("div");
          repDrawer.className = "params-drawer target-drawer";
          repSelect.addEventListener("change", (e) => {
            updateSubParamsDrawer(repDrawer, e.target.value);
          });
          repRow.appendChild(repSelect);
          repRow.appendChild(repDrawer);
          content.appendChild(repRow);
          const colorRow = document.createElement("div");
          colorRow.className = "setting-row";
          colorRow.innerHTML = "<label>Color</label>";
          colorRow.appendChild(buildColorInput());
          content.appendChild(colorRow);
          const modRow = document.createElement("div");
          modRow.className = "flex-row";
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
      function addCustomRuleCard(ruleData) {
        const data = {
          name: "New Rule",
          rep: "highlight",
          colorType: "solid",
          colorVal: "red",
          size: "",
          opacity: "",
          mode: "simple",
          scheme: "auth",
          chain: "",
          ranges: "",
          specific: "",
          atomName: "",
          element: "",
          atomIndex: "",
          label: "",
          tooltip: "",
          focus: false,
          rawJson: '{"auth_asym_id":"A"}',
          rawParamsJson: "{}",
          subParams: {},
          ...ruleData ?? {}
        };
        const card = document.createElement("details");
        card.className = "target-card custom-rule-card";
        card.open = true;
        card.innerHTML = `
    <summary>
      <span class="rule-title-display">${escapeHTML(data.name)}</span>
      <div style="display:flex;align-items:center;gap:10px">
        <button class="danger-outline delete-rule-btn"
          style="padding:2px 8px;width:auto;font-size:11px">Delete</button>
        <span style="font-size:10px;opacity:.5">\u25BC</span>
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
        <div class="rule-section-title">Raw MVS JSON</div>
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
              ${Object.keys(AppConfig.RepSchema).filter((k) => k !== "off").map((k) => `<option value="${k}">Spawn: ${AppConfig.RepSchema[k].label}</option>`).join("")}
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
        <div class="flex-row" style="align-items:flex-end">
          <div style="flex:1.5">
            <label>Floating Label</label>
            <input type="text" class="cr-label"   value="${escapeHTML(data.label)}"   placeholder="e.g. Active Site">
          </div>
          <div style="flex:1.5">
            <label>Hover Tooltip</label>
            <input type="text" class="cr-tooltip" value="${escapeHTML(data.tooltip)}" placeholder="e.g. Binds ATP">
          </div>
          <div style="flex:1;margin-bottom:8px">
            <label style="display:inline-flex;align-items:center;cursor:pointer">
              <input type="checkbox" class="cr-focus"
                ${data.focus ? "checked" : ""}
                style="width:16px;height:16px;margin:0 8px 0 0">
              Focus Camera Here
            </label>
          </div>
        </div>
      </div>
    </div>`;
        card.querySelector(".cr-color-container").appendChild(buildColorInput(data.colorType, data.colorVal));
        card.querySelector(".cr-mode").value = data.mode;
        card.querySelector(".cr-scheme").value = data.scheme ?? "auth";
        const repSelect = card.querySelector(".cr-rep");
        const repDrawer = card.querySelector(".cr-drawer");
        repSelect.value = data.rep ?? "highlight";
        repSelect.addEventListener("change", (e) => {
          updateSubParamsDrawer(repDrawer, e.target.value);
        });
        updateSubParamsDrawer(repDrawer, repSelect.value, data.subParams);
        card.querySelector(".delete-rule-btn")?.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          card.remove();
        });
        card.querySelector(".cr-name").addEventListener("input", (e) => {
          card.querySelector(".rule-title-display").textContent = e.target.value || "Unnamed Rule";
        });
        const modeSelect = card.querySelector(".cr-mode");
        const schemeSelect = card.querySelector(".cr-scheme");
        const simpleDiv = card.querySelector(".cr-simple-container");
        const expertDiv = card.querySelector(".cr-expert-container");
        const jsonBox = card.querySelector(".cr-json");
        const updateVisibility = () => {
          if (modeSelect.value === "simple") {
            simpleDiv.style.display = "block";
            expertDiv.style.display = "none";
            schemeSelect.parentElement.style.display = "block";
          } else {
            const prefix = schemeSelect.value === "label" ? "label" : "auth";
            const base = {};
            const ch = card.querySelector(".cr-chain").value.trim();
            const at = card.querySelector(".cr-atom").value.trim();
            const el = card.querySelector(".cr-element").value.trim();
            if (ch) base[`${prefix}_asym_id`] = ch;
            if (at) base[`${prefix}_atom_id`] = at;
            if (el) base["type_symbol"] = el;
            const selectors = [];
            const ranges = card.querySelector(".cr-ranges").value.trim();
            const specific = card.querySelector(".cr-specific").value.trim();
            const idxs = card.querySelector(".cr-atom-index").value.trim();
            if (ranges) ranges.split(",").forEach((p) => {
              const b = p.trim().split("-");
              if (b.length === 2) selectors.push({
                ...base,
                [`beg_${prefix}_seq_id`]: parseInt(b[0]),
                [`end_${prefix}_seq_id`]: parseInt(b[1])
              });
            });
            if (specific) specific.split(",").forEach((p) => {
              if (!isNaN(parseInt(p))) selectors.push({ ...base, [`${prefix}_seq_id`]: parseInt(p) });
            });
            if (idxs) idxs.split(",").forEach((p) => {
              if (!isNaN(parseInt(p))) selectors.push({ ...base, atom_index: parseInt(p) });
            });
            if (selectors.length === 0 && Object.keys(base).length > 0) selectors.push(base);
            jsonBox.value = JSON.stringify(selectors.length === 1 ? selectors[0] : selectors.length > 1 ? selectors : {}, null, 2);
            simpleDiv.style.display = "none";
            expertDiv.style.display = "block";
            schemeSelect.parentElement.style.display = "none";
          }
        };
        modeSelect.addEventListener("change", updateVisibility);
        schemeSelect.addEventListener("change", updateVisibility);
        updateVisibility();
        rulesContainer.appendChild(card);
      }
      document.getElementById("add-custom-rule")?.addEventListener("click", () => addCustomRuleCard());
      function extractCurrentSettings() {
        const s = { ...AppConfig.getDefaults() };
        s.canvas_color = document.getElementById("canvas_color").value;
        s.camera_json = document.getElementById("camera_json").value;
        for (const target of AppConfig.targets) {
          const card = document.getElementById(`card_${target.id}`);
          if (!card) continue;
          s[`${target.id}_rep`] = card.querySelector(".rep-selector").value;
          s[`${target.id}_colorType`] = card.querySelector(".color-type-selector").value;
          s[`${target.id}_colorVal`] = card.querySelector(".color-val-input").value;
          s[`${target.id}_size`] = card.querySelector(".size-input").value;
          s[`${target.id}_opacity`] = card.querySelector(".opacity-input").value;
          const subParams = {};
          card.querySelectorAll(".target-drawer .subparam-input").forEach((input) => {
            subParams[input.dataset.param] = input.type === "checkbox" ? input.checked : input.value;
          });
          s[`${target.id}_subParams`] = subParams;
        }
        const customRules = [];
        document.querySelectorAll(".custom-rule-card").forEach((card) => {
          const rule = {
            name: card.querySelector(".cr-name").value,
            rep: card.querySelector(".cr-rep").value,
            colorType: card.querySelector(".color-type-selector").value,
            colorVal: card.querySelector(".color-val-input").value,
            size: card.querySelector(".cr-size").value,
            opacity: card.querySelector(".cr-opacity").value,
            mode: card.querySelector(".cr-mode").value,
            scheme: card.querySelector(".cr-scheme").value,
            chain: card.querySelector(".cr-chain").value.trim(),
            ranges: card.querySelector(".cr-ranges").value.trim(),
            specific: card.querySelector(".cr-specific").value.trim(),
            atomName: card.querySelector(".cr-atom").value.trim(),
            element: card.querySelector(".cr-element").value.trim(),
            atomIndex: card.querySelector(".cr-atom-index").value.trim(),
            label: card.querySelector(".cr-label").value.trim(),
            tooltip: card.querySelector(".cr-tooltip").value.trim(),
            focus: card.querySelector(".cr-focus").checked,
            rawJson: card.querySelector(".cr-json").value,
            rawParamsJson: card.querySelector(".cr-params-json").value,
            subParams: {}
          };
          card.querySelectorAll(".cr-drawer .subparam-input").forEach((input) => {
            rule.subParams[input.dataset.param] = input.type === "checkbox" ? input.checked : input.value;
          });
          try {
            const raw = rule.rawJson.trim();
            rule.selector = raw.startsWith("{") || raw.startsWith("[") ? JSON.parse(raw) : raw;
          } catch {
            rule.selector = {};
          }
          if (rule.mode === "expert") {
            try {
              rule.advancedParams = JSON.parse(rule.rawParamsJson);
            } catch {
              rule.advancedParams = {};
            }
          }
          customRules.push(rule);
        });
        s.customRules = customRules;
        return s;
      }
      function injectSettingsIntoUI(settingsObj) {
        sceneContainer.innerHTML = "";
        targetContainer.innerHTML = "";
        rulesContainer.innerHTML = "";
        buildUI();
        const canvasInput = document.getElementById("canvas_color");
        const pickerInput = document.getElementById("canvas_color_picker");
        if (settingsObj.canvas_color) {
          canvasInput.value = settingsObj.canvas_color;
          if (settingsObj.canvas_color.startsWith("#")) pickerInput.value = settingsObj.canvas_color;
        }
        if (settingsObj.camera_json) {
          document.getElementById("camera_json").value = settingsObj.camera_json;
        }
        for (const target of AppConfig.targets) {
          const card = document.getElementById(`card_${target.id}`);
          if (!card) continue;
          const repVal = settingsObj[`${target.id}_rep`];
          if (repVal) {
            const repSel = card.querySelector(".rep-selector");
            repSel.value = repVal;
            updateSubParamsDrawer(
              card.querySelector(".target-drawer"),
              repVal,
              settingsObj[`${target.id}_subParams`] ?? {}
            );
          }
          const colorType = settingsObj[`${target.id}_colorType`];
          const colorVal = settingsObj[`${target.id}_colorVal`];
          if (colorType) {
            const existing = card.querySelector(".color-type-selector");
            existing?.parentElement?.replaceWith(buildColorInput(colorType, colorVal));
          }
          const sizeVal = settingsObj[`${target.id}_size`];
          const opacityVal = settingsObj[`${target.id}_opacity`];
          if (sizeVal) card.querySelector(".size-input").value = sizeVal;
          if (opacityVal) card.querySelector(".opacity-input").value = opacityVal;
        }
        if (Array.isArray(settingsObj.customRules)) {
          settingsObj.customRules.forEach((rule) => addCustomRuleCard(rule));
        }
      }
      var customTemplates = {};
      function updateTemplateDropdown() {
        const select = document.getElementById("template-select");
        select.innerHTML = "";
        for (const [key, preset] of Object.entries(AppConfig.presets)) {
          select.add(new Option(`[Built-in] ${preset.name}`, `builtin_${key}`));
        }
        for (const [key, tpl] of Object.entries(customTemplates)) {
          select.add(new Option(`[Custom] ${tpl.name}`, `custom_${key}`));
        }
      }
      document.getElementById("load-template")?.addEventListener("click", () => {
        const val = document.getElementById("template-select").value;
        const overrides = val.startsWith("builtin_") ? AppConfig.presets[val.replace("builtin_", "")]?.settings ?? {} : customTemplates[val.replace("custom_", "")]?.settings ?? {};
        injectSettingsIntoUI({ ...AppConfig.getDefaults(), ...overrides });
        showStatus("Template loaded!");
      });
      document.getElementById("delete-template")?.addEventListener("click", () => {
        const val = document.getElementById("template-select").value;
        if (val.startsWith("builtin_")) {
          alert("Cannot delete built-in presets.");
          return;
        }
        const id = val.replace("custom_", "");
        if (confirm(`Delete "${customTemplates[id]?.name}"?`)) {
          delete customTemplates[id];
          StorageAPI.set({ customTemplates }, () => {
            updateTemplateDropdown();
            showStatus("Deleted.");
          });
        }
      });
      document.getElementById("save-template")?.addEventListener("click", () => {
        const name = document.getElementById("new-template-name").value.trim();
        if (!name) {
          alert("A template name is required.");
          return;
        }
        const current = extractCurrentSettings();
        const existingId = Object.keys(customTemplates).find(
          (k) => customTemplates[k].name.toLowerCase() === name.toLowerCase()
        );
        if (existingId && !confirm(`Overwrite "${name}"?`)) return;
        const id = existingId ?? `user_tpl_${Date.now()}`;
        customTemplates[id] = { name, settings: current };
        StorageAPI.set({ customTemplates }, () => {
          updateTemplateDropdown();
          document.getElementById("new-template-name").value = "";
          showStatus("Saved!");
        });
      });
      document.getElementById("export-json")?.addEventListener("click", () => {
        const a = document.createElement("a");
        a.setAttribute(
          "href",
          "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(extractCurrentSettings(), null, 2))
        );
        a.setAttribute("download", "molstar_settings.json");
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
      document.getElementById("import-json")?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const parsed = JSON.parse(evt.target?.result);
            const safe = { ...AppConfig.getDefaults() };
            for (const key of Object.keys(safe)) {
              if (key in parsed) safe[key] = parsed[key];
            }
            if (Array.isArray(parsed.customRules)) {
              safe.customRules = parsed.customRules.filter((r) => r && typeof r === "object").map((r) => {
                const rule = r;
                return {
                  name: rule.name ?? "",
                  rep: rule.rep ?? "highlight",
                  colorType: rule.colorType ?? "solid",
                  colorVal: rule.colorVal ?? "#ffffff",
                  size: rule.size ?? "",
                  opacity: rule.opacity ?? "",
                  mode: rule.mode ?? "simple",
                  scheme: rule.scheme ?? "auth",
                  chain: rule.chain ?? "",
                  ranges: rule.ranges ?? "",
                  specific: rule.specific ?? "",
                  atomName: rule.atomName ?? "",
                  element: rule.element ?? "",
                  atomIndex: rule.atomIndex ?? "",
                  label: rule.label ?? "",
                  tooltip: rule.tooltip ?? "",
                  focus: !!rule.focus,
                  rawJson: rule.rawJson ?? "{}",
                  rawParamsJson: rule.rawParamsJson ?? "{}",
                  subParams: typeof rule.subParams === "object" && rule.subParams ? rule.subParams : {}
                };
              }).slice(0, 50);
            }
            injectSettingsIntoUI(safe);
            showStatus("Imported!");
          } catch {
            showStatus("Invalid JSON file.", true);
          }
        };
        reader.readAsText(file);
        e.target.value = "";
      });
      document.getElementById("save")?.addEventListener("click", () => {
        StorageAPI.set(extractCurrentSettings(), () => showStatus("Applied!"));
      });
      function refreshCustomDomainList() {
        const list = document.getElementById("custom-domains-list");
        if (!list) return;
        StorageAPI.get({ customDomains: [] }, (data) => {
          const domains = data.customDomains ?? [];
          if (domains.length === 0) {
            list.innerHTML = '<p style="color:#57606a;font-style:italic;font-size:13px">No custom domains authorized yet.</p>';
            return;
          }
          list.innerHTML = "";
          for (const domain of domains) {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:10px;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;margin-bottom:8px";
            row.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
          <span>\u{1F310}</span><span style="font-weight:500">${escapeHTML(domain)}</span>
        </div>
        <button class="danger-outline remove-domain-btn"
          data-domain="${escapeHTML(domain)}"
          style="padding:4px 10px;font-size:12px">Remove</button>`;
            list.appendChild(row);
          }
          list.querySelectorAll(".remove-domain-btn").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
              const dom = e.target.dataset.domain;
              if (confirm(`Revoke access for ${dom}?`)) {
                await PermissionsManager.revokeAndUnregister(dom);
                refreshCustomDomainList();
              }
            });
          });
        });
      }
      document.getElementById("add-manual-domain")?.addEventListener("click", async () => {
        const input = document.getElementById("manual-domain-input");
        const dom = input.value.trim();
        if (!dom) return;
        if (await PermissionsManager.requestAndRegister(dom)) {
          input.value = "";
          refreshCustomDomainList();
        }
      });
      document.addEventListener("DOMContentLoaded", () => {
        StorageAPI.get(null, (savedItems) => {
          customTemplates = savedItems.customTemplates ?? {};
          updateTemplateDropdown();
          injectSettingsIntoUI({ ...AppConfig.getDefaults(), ...savedItems });
        });
        refreshCustomDomainList();
        const autoDomain = new URLSearchParams(window.location.search).get("domain");
        if (autoDomain) {
          const input = document.getElementById("manual-domain-input");
          if (input) {
            input.value = autoDomain;
            input.focus();
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          }
        }
      });
    }
  });
  require_options();
})();
//# sourceMappingURL=options.js.map
