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

  // src/viewer.ts
  var require_viewer = __commonJS({
    "src/viewer.ts"() {
      init_config();
      var extApi = typeof browser !== "undefined" ? browser : chrome;
      var ALLOWED_URL_SCHEMES = /* @__PURE__ */ new Set(["https:"]);
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
      var BLOCKED_RANGES = [
        /^10\.\d+\.\d+\.\d+$/,
        /^192\.168\.\d+\.\d+$/,
        /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
        /^169\.254\.\d+\.\d+$/,
        /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/,
        /^127\.\d+\.\d+\.\d+$/,
        /^\[?::1\]?$/,
        /^\[?fc[0-9a-f]{2}:/i,
        /^localhost$/i
      ];
      var MAX_BYTES = 25 * 1024 * 1024;
      function isSafeUrl(urlStr) {
        try {
          const u = new URL(urlStr);
          if (!ALLOWED_URL_SCHEMES.has(u.protocol)) return false;
          if (BLOCKED_RANGES.some((r) => r.test(u.hostname))) return false;
          return true;
        } catch {
          return false;
        }
      }
      var currentIframe = null;
      function spawnIframe(dataUri, format, rawUrl) {
        const loadingDiv = document.getElementById("loading");
        if (loadingDiv) loadingDiv.remove();
        if (currentIframe) {
          currentIframe.remove();
          currentIframe = null;
        }
        extApi.storage.sync.get(AppConfig.getDefaults(), (storedSettings) => {
          const defaults = AppConfig.getDefaults();
          const VALID_KEYS = new Set(Object.keys(defaults));
          const finalSettings = { ...defaults };
          for (const key of Object.keys(storedSettings)) {
            if (VALID_KEYS.has(key)) {
              finalSettings[key] = storedSettings[key];
            }
          }
          if (Array.isArray(storedSettings.customRules)) {
            finalSettings.customRules = storedSettings.customRules;
          }
          const iframe = document.createElement("iframe");
          iframe.src = "sandbox.html";
          iframe.style.cssText = "width:100%; height:100%; border:none;";
          const messageListener = (e) => {
            if (e.data?.action !== "SANDBOX_READY" || e.source !== iframe.contentWindow) return;
            window.removeEventListener("message", messageListener);
            const payload = {
              action: "INIT_MOLSTAR",
              url: dataUri,
              format,
              settings: finalSettings,
              originalUrl: rawUrl
            };
            iframe.contentWindow.postMessage(payload, "*");
          };
          window.addEventListener("message", messageListener);
          document.body.appendChild(iframe);
          currentIframe = iframe;
        });
      }
      async function bootWorkspace(rawUrl, safeFormat) {
        const loadingDiv = document.getElementById("loading");
        if (loadingDiv) loadingDiv.innerText = "Downloading structure securely\u2026";
        try {
          const response = await fetch(rawUrl);
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
          const contentLength = response.headers.get("Content-Length");
          if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
            throw new Error("File exceeds the 25 MB size limit.");
          }
          const blob = await response.blob();
          if (blob.size > MAX_BYTES) throw new Error("File exceeds the 25 MB size limit.");
          const preview = await blob.slice(0, 150).text();
          if (preview.trim().startsWith("<?xml") || preview.includes("<Error>")) {
            throw new Error(
              "Download blocked by browser tracking protection. Please authorize this domain in the Studio settings."
            );
          }
          const dataUri = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          spawnIframe(dataUri, safeFormat, rawUrl);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("Workspace fetch error:", error);
          const ld = document.getElementById("loading");
          if (ld) {
            ld.innerHTML = `
        <div style="background:white;padding:20px 30px;border-radius:8px;
                    box-shadow:0 4px 12px rgba(0,0,0,.15);text-align:center;
                    color:#333;max-width:400px;margin:0 auto">
          <h3 style="margin-top:0;color:#d73a49">Download Blocked</h3>
          <p style="font-size:14px;color:#555;margin-bottom:0;line-height:1.5">${message}</p>
        </div>`;
          }
        }
      }
      function setupDragAndDrop() {
        const overlay = document.createElement("div");
        overlay.id = "dnd-overlay";
        overlay.style.cssText = [
          "position:fixed;top:0;left:0;width:100%;height:100%",
          "background:rgba(0,0,0,0.85);color:white;display:none",
          "align-items:center;justify-content:center",
          "font-size:28px;font-weight:bold;font-family:sans-serif",
          "z-index:9999;border:4px dashed #2da44e;box-sizing:border-box",
          "flex-direction:column;gap:15px"
        ].join(";");
        overlay.innerHTML = [
          "<span>\u{1F4C2} Drop Structure File Here</span>",
          '<span style="font-size:16px;color:#ccc">Supported: PDB, mmCIF, SDF, GRO, XYZ, MOL2, BCIF</span>'
        ].join("");
        document.body.appendChild(overlay);
        let dragCounter = 0;
        window.addEventListener("dragenter", (e) => {
          e.preventDefault();
          dragCounter++;
          overlay.style.display = "flex";
        });
        window.addEventListener("dragleave", () => {
          if (--dragCounter === 0) overlay.style.display = "none";
        });
        window.addEventListener("dragover", (e) => e.preventDefault());
        window.addEventListener("drop", (e) => {
          e.preventDefault();
          dragCounter = 0;
          overlay.style.display = "none";
          const file = e.dataTransfer?.files[0];
          if (!file) return;
          let ext = file.name.split(".").pop()?.toLowerCase() ?? "";
          let format = ext;
          if (ext === "ent") format = "pdb";
          if (ext === "cif") format = "mmcif";
          if (!ALLOWED_FORMATS.has(format)) {
            alert(`Unsupported format: .${ext}. Please use PDB, mmCIF, SDF, GRO, MOL2, XYZ, or BCIF.`);
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
            spawnIframe(ev.target.result, format, "local-file://" + file.name);
          };
          reader.readAsDataURL(file);
        });
      }
      function showUnauthorizedDomainUI(loadingDiv, targetDomain) {
        loadingDiv.innerHTML = `
    <div style="background:white;padding:20px 30px;border-radius:8px;
                box-shadow:0 4px 12px rgba(0,0,0,.15);text-align:center;
                color:#333;max-width:400px;margin:0 auto">
      <h3 style="margin-top:0;color:#d73a49">Unauthorized Domain</h3>
      <p style="font-size:14px;color:#666;margin-bottom:20px">
        Trying to open a link from <strong>${targetDomain}</strong>.<br><br>
        Would you like to authorize this domain in the Studio?
      </p>
      <div style="display:flex;gap:10px">
        <button id="auth-cancel"
          style="background:#eee;color:#333;border:none;padding:10px;
                 font-weight:bold;border-radius:4px;cursor:pointer;flex:1">
          Cancel
        </button>
        <button id="auth-confirm"
          style="background:#0969da;color:white;border:none;padding:10px;
                 font-weight:bold;border-radius:4px;cursor:pointer;flex:1">
          Yes, Authorize
        </button>
      </div>
    </div>`;
        document.getElementById("auth-confirm")?.addEventListener("click", () => {
          extApi.tabs.create({ url: `options.html?domain=${encodeURIComponent(targetDomain)}` });
          window.close();
        });
        document.getElementById("auth-cancel")?.addEventListener("click", () => {
          loadingDiv.innerHTML = `
      <div style="background:white;padding:20px 30px;border-radius:8px;
                  box-shadow:0 4px 12px rgba(0,0,0,.15);text-align:center;
                  color:#d73a49;max-width:400px;margin:0 auto;
                  font-weight:bold;font-size:16px">
        Not authorized. Operation cancelled.
      </div>`;
        });
      }
      function showFormatSelectorUI(loadingDiv, rawUrl) {
        loadingDiv.innerHTML = `
    <div style="background:white;padding:20px 30px;border-radius:8px;
                box-shadow:0 4px 12px rgba(0,0,0,.15);text-align:center;
                color:#333;max-width:400px;margin:0 auto">
      <h3 style="margin-top:0;color:#2c3e50">Unknown File Format</h3>
      <p style="font-size:14px;color:#666;margin-bottom:20px">
        Format could not be detected automatically.<br>Please select it below:
      </p>
      <select id="format-select"
        style="padding:8px;font-size:14px;border-radius:4px;
               border:1px solid #ccc;width:100%;margin-bottom:15px">
        <option value="pdb">PDB</option>
        <option value="mmcif">mmCIF / CIF</option>
        <option value="gro">GRO (Gromacs)</option>
        <option value="sdf">SDF</option>
        <option value="mol">MOL</option>
        <option value="mol2">MOL2</option>
        <option value="xyz">XYZ</option>
        <option value="bcif">BCIF (binary CIF)</option>
      </select>
      <button id="format-confirm"
        style="background:#2da44e;color:white;border:none;
               padding:10px 20px;font-weight:bold;border-radius:4px;
               cursor:pointer;width:100%">
        Launch Workspace
      </button>
    </div>`;
        document.getElementById("format-confirm")?.addEventListener("click", () => {
          const sel = document.getElementById("format-select");
          bootWorkspace(rawUrl, sel.value);
        });
      }
      document.addEventListener("DOMContentLoaded", async () => {
        setupDragAndDrop();
        const urlParams = new URLSearchParams(window.location.search);
        const rawUrl = urlParams.get("fileUrl");
        const format = urlParams.get("format") ?? "";
        const loadingDiv = document.getElementById("loading");
        if (!rawUrl) {
          if (loadingDiv) loadingDiv.innerText = "Loading empty workspace\u2026";
          spawnIframe(null, null, null);
          return;
        }
        if (!isSafeUrl(rawUrl)) {
          if (loadingDiv) loadingDiv.innerText = "Error: request to unsafe or restricted URL blocked.";
          return;
        }
        if (!ALLOWED_FORMATS.has(format)) {
          const targetDomain = new URL(rawUrl).hostname.replace(/^www\./, "");
          const DEFAULT_DOMAINS = ["github.com", "raw.githubusercontent.com", "gitlab.com", "rcsb.org", "alphafold.ebi.ac.uk"];
          const isDefault = DEFAULT_DOMAINS.some((d) => targetDomain.includes(d));
          if (!isDefault) {
            const storageData = await new Promise(
              (resolve) => extApi.storage.sync.get({ customDomains: [] }, resolve)
            );
            if (!storageData.customDomains.includes(targetDomain)) {
              if (loadingDiv) showUnauthorizedDomainUI(loadingDiv, targetDomain);
              return;
            }
          }
          if (loadingDiv) showFormatSelectorUI(loadingDiv, rawUrl);
          return;
        }
        bootWorkspace(rawUrl, format);
      });
    }
  });
  require_viewer();
})();
//# sourceMappingURL=viewer.js.map
