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

  // src/mvs-builder.ts
  var ALLOWED_SUB_KEYS, ALLOWED_THEMES, MvsBuilder;
  var init_mvs_builder = __esm({
    "src/mvs-builder.ts"() {
      "use strict";
      init_config();
      ALLOWED_SUB_KEYS = {
        ball_and_stick: ["ignore_hydrogens"],
        line: ["ignore_hydrogens"],
        spacefill: ["ignore_hydrogens"],
        surface: ["surface_type", "ignore_hydrogens"],
        putty: ["size_theme"],
        cartoon: ["tubular_helices"]
      };
      ALLOWED_THEMES = /* @__PURE__ */ new Set([
        "chain-id",
        "element-symbol",
        "secondary-structure",
        "residue-name",
        "sequence-id",
        "uniform",
        "uncertainty",
        "b-factor"
      ]);
      MvsBuilder = {
        // -------------------------------------------------------------------------
        // Security: string sanitizer
        // Strips null bytes and non-printable control characters, caps length.
        // MVS nodes are JSON (not HTML) so HTML-escaping is intentionally skipped.
        // -------------------------------------------------------------------------
        _sanitizeString(value, maxLength = 512) {
          if (typeof value !== "string") return "";
          return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, maxLength);
        },
        // -------------------------------------------------------------------------
        // Security: color sanitizer
        // -------------------------------------------------------------------------
        _sanitizeColor(colorType, colorVal) {
          if (colorType === "theme") {
            return ALLOWED_THEMES.has(colorVal) ? colorVal : "chain-id";
          }
          if (/^#[0-9a-fA-F]{6}$/.test(colorVal)) return colorVal;
          const SAFE_NAMED = /* @__PURE__ */ new Set(["white", "red", "blue", "green", "black"]);
          return SAFE_NAMED.has(colorVal) ? colorVal : "white";
        },
        // -------------------------------------------------------------------------
        // Security: rep-type sanitizer
        // -------------------------------------------------------------------------
        _sanitizeRepType(repType) {
          const allowed = new Set(Object.keys(AppConfig.RepSchema));
          return allowed.has(repType) ? repType : "ball_and_stick";
        },
        // -------------------------------------------------------------------------
        // Security: deep-sanitize an arbitrary object before embedding as MVS params.
        // Caps depth at 2, rejects arrays and prototype-polluting keys.
        // Used for camera_json and other free-form JSON fields.
        // -------------------------------------------------------------------------
        _deepSanitize(obj, depth = 0) {
          if (depth > 2 || typeof obj !== "object" || obj === null || Array.isArray(obj)) {
            return {};
          }
          const result = /* @__PURE__ */ Object.create(null);
          for (const [k, v] of Object.entries(obj)) {
            if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
            result[k] = typeof v === "object" && v !== null ? this._deepSanitize(v, depth + 1) : v;
          }
          return result;
        },
        // -------------------------------------------------------------------------
        // Apply sub-params from user storage using the strict ALLOWED_SUB_KEYS list
        // -------------------------------------------------------------------------
        _applySafeSubParams(target, repType, rawParams) {
          if (!rawParams || typeof rawParams !== "object" || Array.isArray(rawParams)) return;
          const allowed = ALLOWED_SUB_KEYS[repType] ?? [];
          const params = rawParams;
          for (const key of allowed) {
            if (key in params) target[key] = params[key];
          }
        },
        // -------------------------------------------------------------------------
        // Public: build a Mol* Viewer URL with embedded MVS data
        // -------------------------------------------------------------------------
        createViewerUrl(rawStructureUrl, format, settings) {
          const parserFormat = format === "cif" ? "mmcif" : format;
          const mvsDataString = JSON.stringify(this._buildBaseTemplate(rawStructureUrl, parserFormat, settings));
          return `https://molstar.org/viewer/?mvs-format=mvsj&mvs-data=${encodeURIComponent(mvsDataString)}`;
        },
        // -------------------------------------------------------------------------
        // Public: build the raw MVS JSON object
        // -------------------------------------------------------------------------
        _buildBaseTemplate(url, format, settings) {
          const rootChildren = [
            {
              kind: "download",
              params: { url },
              children: [{
                kind: "parse",
                params: { format },
                children: [{
                  kind: "structure",
                  params: { type: "model" },
                  children: this._buildComponentBranches(settings)
                }]
              }]
            }
          ];
          if (settings.canvas_color && settings.canvas_color !== "#ffffff" && settings.canvas_color !== "white") {
            const safeColor = /^#[0-9a-fA-F]{6}$/.test(settings.canvas_color) ? settings.canvas_color : "#ffffff";
            rootChildren.push({ kind: "canvas", params: { background_color: safeColor } });
          }
          if (settings.camera_json) {
            try {
              const raw = JSON.parse(settings.camera_json);
              const camParams = this._deepSanitize(raw);
              if (Object.keys(camParams).length > 0) {
                rootChildren.push({ kind: "camera", params: camParams });
              }
            } catch {
              console.warn("Mol* Builder: invalid camera_json, skipped");
            }
          }
          return {
            metadata: { version: "1" },
            root: { kind: "root", children: rootChildren }
          };
        },
        // -------------------------------------------------------------------------
        // Build a color MVS node
        // -------------------------------------------------------------------------
        _getColorNode(colorType, colorVal) {
          const safeColor = this._sanitizeColor(colorType, colorVal);
          if (colorType === "theme") {
            return {
              kind: "color",
              params: { color: "white" },
              custom: { molstar_color_theme_name: safeColor }
            };
          }
          return { kind: "color", params: { color: safeColor } };
        },
        // -------------------------------------------------------------------------
        // Build all component branches (custom rules + global targets)
        // -------------------------------------------------------------------------
        _buildComponentBranches(settings) {
          const branches = [];
          const polymerColorOverrides = [];
          const customComponentBranches = [];
          const customRules = Array.isArray(settings.customRules) ? settings.customRules : [];
          const MAX_RULES = 50;
          customRules.slice(0, MAX_RULES).forEach((rule) => {
            if (!rule || typeof rule !== "object") return;
            const componentChildren = [];
            const safeLabel = rule.label ? this._sanitizeString(rule.label, 256) : null;
            const safeTooltip = rule.tooltip ? this._sanitizeString(rule.tooltip, 512) : null;
            let safeSelector = null;
            if (rule.selector !== void 0 && rule.selector !== null && rule.selector !== "") {
              if (typeof rule.selector === "string") {
                safeSelector = this._sanitizeString(rule.selector, 256) || null;
              } else if (typeof rule.selector === "object") {
                safeSelector = rule.selector;
              }
            }
            if (!safeSelector) return;
            if (safeLabel) componentChildren.push({ kind: "label", params: { text: safeLabel } });
            if (safeTooltip) componentChildren.push({ kind: "tooltip", params: { text: safeTooltip } });
            if (rule.focus) componentChildren.push({ kind: "focus", params: {} });
            const ruleType = rule.rep ? this._sanitizeRepType(rule.rep) : "highlight";
            if (ruleType === "highlight") {
              const colorNode = this._getColorNode(rule.colorType, rule.colorVal);
              colorNode.params.selector = safeSelector;
              polymerColorOverrides.push(colorNode);
              if (componentChildren.length > 0) {
                customComponentBranches.push({
                  kind: "component",
                  params: { selector: safeSelector },
                  children: componentChildren
                });
              }
            } else {
              const repParams = { type: ruleType };
              if (rule.size !== void 0) {
                const sz = parseFloat(rule.size);
                if (!isNaN(sz) && sz > 0 && sz <= 10) repParams.size_factor = sz;
              }
              this._applySafeSubParams(repParams, ruleType, rule.subParams);
              this._applySafeSubParams(repParams, ruleType, rule.advancedParams);
              const repChildren = [this._getColorNode(rule.colorType, rule.colorVal)];
              if (rule.opacity !== void 0) {
                const op = parseFloat(rule.opacity);
                if (!isNaN(op) && op >= 0 && op <= 1) {
                  repChildren.push({ kind: "opacity", params: { opacity: op } });
                }
              }
              componentChildren.push({ kind: "representation", params: repParams, children: repChildren });
              customComponentBranches.push({
                kind: "component",
                params: { selector: safeSelector },
                children: componentChildren
              });
            }
          });
          for (const target of AppConfig.targets) {
            const repType = settings[`${target.id}_rep`];
            if (!repType || repType === "off") continue;
            const sizeVal = settings[`${target.id}_size`];
            const repParams = { type: this._sanitizeRepType(repType) };
            if (sizeVal !== void 0 && sizeVal !== "") {
              const sz = parseFloat(String(sizeVal));
              if (!isNaN(sz) && sz > 0 && sz <= 10) repParams.size_factor = sz;
            }
            this._applySafeSubParams(
              repParams,
              repParams.type,
              settings[`${target.id}_subParams`]
            );
            const repChildren = [
              this._getColorNode(
                settings[`${target.id}_colorType`],
                settings[`${target.id}_colorVal`]
              )
            ];
            const opacityVal = settings[`${target.id}_opacity`];
            if (opacityVal !== void 0) {
              const op = parseFloat(String(opacityVal));
              if (!isNaN(op) && op >= 0 && op <= 1) {
                repChildren.push({ kind: "opacity", params: { opacity: op } });
              }
            }
            const representationNode = {
              kind: "representation",
              params: repParams,
              children: repChildren
            };
            if (["protein", "nucleic"].includes(target.selector)) {
              representationNode.children.push(...polymerColorOverrides);
            }
            const mvsSelector = "mvsSelector" in target ? target.mvsSelector : target.selector;
            if (mvsSelector === null || mvsSelector === void 0) continue;
            branches.push({
              kind: "component",
              params: { selector: target.selector },
              children: [representationNode]
            });
          }
          branches.push(...customComponentBranches);
          return branches;
        }
      };
    }
  });

  // src/sandbox.ts
  var require_sandbox = __commonJS({
    "src/sandbox.ts"() {
      init_mvs_builder();
      var ALLOWED_FORMATS = /* @__PURE__ */ new Set([
        "pdb",
        "cif",
        "mmcif",
        "bcif",
        "gro",
        "mol",
        "mol2",
        "sdf",
        "xyz"
      ]);
      window.parent.postMessage({ action: "SANDBOX_READY" }, "*");
      var viewerInstance = null;
      window.history.replaceState = () => {
      };
      window.history.pushState = () => {
      };
      if ("xr" in navigator) {
        Object.defineProperty(navigator, "xr", { value: void 0, configurable: true });
      }
      window.addEventListener("message", async (event) => {
        const msg = event.data;
        if (!msg || msg.action !== "INIT_MOLSTAR") return;
        const { url, format, settings, originalUrl } = msg;
        if (url !== null && (typeof url !== "string" || !url.startsWith("data:"))) {
          console.error("Mol* Sandbox: rejected non-data URL");
          return;
        }
        if (url !== null && (typeof format !== "string" || !ALLOWED_FORMATS.has(format))) {
          console.error("Mol* Sandbox: rejected unknown format:", format);
          return;
        }
        try {
          if (!viewerInstance) {
            viewerInstance = await molstar.Viewer.create("app", {
              layoutIsExpanded: false,
              layoutShowControls: false,
              layoutShowRemoteState: false,
              layoutShowSequence: true,
              layoutShowLog: true,
              layoutShowLeftPanel: true
            });
          }
          if (url === null) {
            console.log("Mol* Sandbox: empty session opened.");
            return;
          }
          const response = await fetch(url);
          const blob = await response.blob();
          let shortBlobUrl = URL.createObjectURL(blob);
          if (originalUrl) {
            try {
              const filename = new URL(originalUrl).pathname.split("/").pop();
              if (filename) shortBlobUrl += `#${filename}`;
            } catch {
            }
          }
          const mvsTemplate = MvsBuilder._buildBaseTemplate(shortBlobUrl, format, settings);
          const mvsDataString = JSON.stringify(mvsTemplate);
          if (typeof viewerInstance.loadMvsData === "function") {
            await viewerInstance.loadMvsData(mvsDataString, "mvsj");
          } else {
            const mvsData = molstar.PluginExtensions.mvs.MVSData.fromMVSJ(mvsDataString);
            await molstar.PluginExtensions.mvs.loadMVS(
              viewerInstance.plugin,
              mvsData,
              { replaceExisting: true }
            );
          }
        } catch (err) {
          console.error("Mol* Sandbox: failed to load structure", err);
        }
      });
    }
  });
  require_sandbox();
})();
//# sourceMappingURL=sandbox.js.map
