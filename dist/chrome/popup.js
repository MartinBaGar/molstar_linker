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

  // src/popup.ts
  var require_popup = __commonJS({
    "src/popup.ts"() {
      init_config();
      init_permissions();
      var extApi = typeof browser !== "undefined" ? browser : chrome;
      document.addEventListener("DOMContentLoaded", async () => {
        const presetSelect = document.getElementById("preset-select");
        let customTemplates = {};
        extApi.storage.sync.get(
          ["customTemplates"],
          (result) => {
            customTemplates = result.customTemplates ?? {};
            const groupBuiltIn = document.createElement("optgroup");
            groupBuiltIn.label = "Built-in Presets";
            for (const [key, preset] of Object.entries(AppConfig.presets)) {
              const opt = document.createElement("option");
              opt.value = `builtin_${key}`;
              opt.textContent = preset.name;
              groupBuiltIn.appendChild(opt);
            }
            presetSelect.appendChild(groupBuiltIn);
            if (Object.keys(customTemplates).length > 0) {
              const groupCustom = document.createElement("optgroup");
              groupCustom.label = "My Custom Templates";
              for (const [key, tpl] of Object.entries(customTemplates)) {
                const opt = document.createElement("option");
                opt.value = `custom_${key}`;
                opt.textContent = tpl.name;
                groupCustom.appendChild(opt);
              }
              presetSelect.appendChild(groupCustom);
            }
          }
        );
        document.getElementById("apply-preset")?.addEventListener("click", () => {
          const val = presetSelect.value;
          const presetOverrides = val.startsWith("builtin_") ? AppConfig.presets[val.replace("builtin_", "")]?.settings ?? {} : customTemplates[val.replace("custom_", "")]?.settings ?? {};
          const newSettings = { ...AppConfig.getDefaults(), ...presetOverrides };
          extApi.storage.sync.set(newSettings, () => {
            extApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              const id = tabs[0]?.id;
              if (id !== void 0) extApi.tabs.reload(id);
            });
            window.close();
          });
        });
        document.getElementById("open-options")?.addEventListener("click", () => {
          extApi.runtime.openOptionsPage();
        });
        document.getElementById("open-empty-viewer")?.addEventListener("click", () => {
          extApi.tabs.create({ url: extApi.runtime.getURL("viewer.html") });
          window.close();
        });
        try {
          const tabs = await new Promise(
            (resolve) => extApi.tabs.query({ active: true, currentWindow: true }, resolve)
          );
          const tab = tabs[0];
          if (tab?.url?.startsWith("http")) {
            const currentDomain = PermissionsManager.cleanDomain(tab.url);
            const DEFAULT_DOMAINS = ["github.com", "raw.githubusercontent.com", "gitlab.com", "rcsb.org", "alphafold.ebi.ac.uk"];
            const isDefault = DEFAULT_DOMAINS.some((d) => currentDomain.includes(d));
            const storage = await new Promise(
              (resolve) => extApi.storage.sync.get({ customDomains: [] }, resolve)
            );
            if (!isDefault && !storage.customDomains.includes(currentDomain)) {
              const promptDiv = document.getElementById("custom-domain-prompt");
              const enableBtn = document.getElementById("enable-domain-btn");
              if (promptDiv && enableBtn) {
                promptDiv.style.display = "block";
                enableBtn.textContent = "Authorize in Studio";
                enableBtn.style.backgroundColor = "var(--primary)";
                enableBtn.addEventListener("click", () => {
                  extApi.tabs.create({
                    url: `options.html?domain=${encodeURIComponent(currentDomain)}`
                  });
                  window.close();
                });
              }
            }
          }
        } catch (err) {
          console.error("Mol* Linker: domain detection failed", err);
        }
      });
    }
  });
  require_popup();
})();
//# sourceMappingURL=popup.js.map
