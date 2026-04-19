// viewer.js

const ALLOWED_URL_SCHEMES = ['https:'];

// FIX F7: Canonical format list including 'cif'
const ALLOWED_FORMATS = new Set(['pdb', 'cif', 'mmcif', 'gro', 'mol', 'mol2', 'sdf', 'xyz', 'bcif']);
const MAX_BYTES = 25 * 1024 * 1024;

// FIX F2: Comprehensive SSRF IP-range blocking
const BLOCKED_RANGES = [
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/,
  /^127\.\d+\.\d+\.\d+$/,
  /^\[?::1\]?$/,
  /^\[?fc[0-9a-f]{2}:/i,
  /^localhost$/
];

function isSafeUrl(urlStr) {
    try {
        const u = new URL(urlStr);
        if (!ALLOWED_URL_SCHEMES.includes(u.protocol)) return false;
        if (BLOCKED_RANGES.some(r => r.test(u.hostname))) return false;
        return true;
    } catch {
        return false;
    }
}

let currentIframe = null;

// --- Core iframe spawner ---
// All four entry points (remote URL, empty session, drag-and-drop, options blob
// handoff) funnel through here. dataUri is null for empty sessions.
function spawnIframe(dataUri, format, rawUrl) {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) loadingDiv.remove();

    // Replace any existing iframe (e.g. user drops a second file)
    if (currentIframe) {
        currentIframe.remove();
        currentIframe = null;
    }

    chrome.storage.sync.get(null, (storedSettings) => {
        const defaults = AppConfig.getDefaults();
        const finalSettings = { ...defaults };

        // FIX F6: Only copy keys that exist in the schema — never let rogue
        // storage keys (e.g. from a crafted import) flow into mvs-builder.
        const VALID_KEYS = new Set(Object.keys(defaults));
        for (const key of Object.keys(storedSettings)) {
            if (VALID_KEYS.has(key)) finalSettings[key] = storedSettings[key];
        }
        if (Array.isArray(storedSettings.customRules)) {
            finalSettings.customRules = storedSettings.customRules;
        }

        const iframe = document.createElement('iframe');
        iframe.src = 'sandbox.html';
        iframe.allow = 'xr-spatial-tracking';
        iframe.style.cssText = 'width: 100%; height: 100%; border: none;';

        // FIX F1: Sandboxed extension pages always have origin 'null' (the string).
        // postMessage(data, 'null') throws a SyntaxError — 'null' is not a valid
        // structured origin. We use '*' but gate strictly on e.source === iframe
        // so only our own sandbox can trigger this branch.
        const messageListener = (e) => {
            if (e.data && e.data.action === 'SANDBOX_READY' && e.source === iframe.contentWindow) {
                window.removeEventListener('message', messageListener);
                iframe.contentWindow.postMessage({
                    action: 'INIT_MOLSTAR',
                    url: dataUri,   // null → empty session; data URI → load structure
                    format: format,
                    settings: finalSettings,
                    originalUrl: rawUrl
                }, '*'); // '*' required: sandboxed iframes report origin 'null'
            }
        };
        window.addEventListener('message', messageListener);

        document.body.appendChild(iframe);
        currentIframe = iframe;
    });
}

// --- Remote fetch (GitHub / RCSB / custom domain links) ---
async function bootWorkspace(rawUrl, safeFormat) {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) loadingDiv.innerText = 'Downloading structure securely...';

    try {
        const response = await fetch(rawUrl);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

        const contentLength = response.headers.get('Content-Length');
        if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
            throw new Error('File exceeds the 25 MB size limit.');
        }

        const blob = await response.blob();
        if (blob.size > MAX_BYTES) throw new Error('File exceeds the 25 MB size limit.');

        const dataUri = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });

        spawnIframe(dataUri, safeFormat, rawUrl);

    } catch (error) {
        console.error("Workspace Fetch Error:", error);
        const ld = document.getElementById('loading');
        if (ld) ld.innerText = `Failed to load structure file. ${error.message}`;
    }
}

// --- Full-page drag & drop ---
function setupDragAndDrop() {
    const overlay = document.createElement('div');
    overlay.id = 'dnd-overlay';
    overlay.style.cssText = [
        'position:fixed;top:0;left:0;width:100%;height:100%',
        'background:rgba(0,0,0,0.85);color:white;display:none',
        'align-items:center;justify-content:center',
        'font-size:28px;font-weight:bold;font-family:sans-serif',
        'z-index:9999;border:4px dashed #2da44e;box-sizing:border-box',
        'flex-direction:column;gap:15px'
    ].join(';');
    overlay.innerHTML = [
        '<span>\uD83D\uDCC2 Drop Structure File Here</span>',
        '<span style="font-size:16px;color:#ccc">Supported: PDB, mmCIF, SDF, GRO, XYZ</span>'
    ].join('');
    document.body.appendChild(overlay);

    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        overlay.style.display = 'flex';
    });

    window.addEventListener('dragleave', () => {
        dragCounter--;
        if (dragCounter === 0) overlay.style.display = 'none';
    });

    window.addEventListener('dragover', (e) => e.preventDefault());

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        overlay.style.display = 'none';

        const file = e.dataTransfer.files[0];
        if (!file) return;

        let ext = file.name.split('.').pop().toLowerCase();
        let format = ext;
        if (ext === 'ent') format = 'pdb';   // .ent is a PDB alias
        if (ext === 'cif') format = 'mmcif'; // bare .cif → mmcif parser

        if (!ALLOWED_FORMATS.has(format)) {
            alert(`Unsupported file format: .${ext}. Please use PDB, mmCIF, SDF, etc.`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            spawnIframe(event.target.result, format, 'local-file://' + file.name);
        };
        reader.readAsDataURL(file);
    });
}

// --- Initialisation ---
document.addEventListener('DOMContentLoaded', async () => {
    // Drag & drop is always active — works even on the empty workspace
    setupDragAndDrop();

    const urlParams  = new URLSearchParams(window.location.search);
    const rawUrl     = urlParams.get('fileUrl');
    const format     = urlParams.get('format');
    const localBlob  = urlParams.get('localBlob');
    const filename   = urlParams.get('filename');
    const loadingDiv = document.getElementById('loading');

    // SCENARIO 0: Blob handoff from the Options page
    // Options page creates a short-lived blob URL and passes it here so the
    // file never travels over the network.
    if (localBlob && (
        localBlob.startsWith('blob:chrome-extension://') ||
        localBlob.startsWith('blob:moz-extension://')
    )) {
        if (loadingDiv) loadingDiv.innerText = 'Transferring local file...';
        try {
            const response = await fetch(localBlob);
            const blob = await response.blob();
            URL.revokeObjectURL(localBlob);
            const dataUri = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
            spawnIframe(dataUri, format, 'local-file://' + (filename || 'structure'));
        } catch (err) {
            console.error("Blob Transfer Error:", err);
            if (loadingDiv) loadingDiv.innerText = 'Failed to transfer local file.';
        }
        return;
    }

    // SCENARIO 1: No URL — open an empty workspace (popup "Open Empty Studio")
    if (!rawUrl) {
        if (loadingDiv) loadingDiv.innerText = 'Loading empty workspace...';
        spawnIframe(null, null, null);
        return;
    }

    // SCENARIO 2: URL present but unsafe
    if (!isSafeUrl(rawUrl)) {
        if (loadingDiv) loadingDiv.innerText = 'Error: Blocked request to unsafe or missing URL.';
        return;
    }

    // SCENARIO 3: Remote URL with unknown format (right-click context menu path)
    if (!ALLOWED_FORMATS.has(format)) {
        loadingDiv.innerHTML = `
            <div style="background:white;padding:20px 30px;border-radius:8px;
                        box-shadow:0 4px 12px rgba(0,0,0,.15);text-align:center;
                        color:#333;max-width:400px;margin:0 auto">
                <h3 style="margin-top:0;color:#2c3e50">Unknown File Format</h3>
                <p style="font-size:14px;color:#666;margin-bottom:20px">
                    We couldn't detect the structure format automatically.<br>
                    Please select it below:
                </p>
                <select id="format-select"
                    style="padding:8px;font-size:14px;border-radius:4px;
                           border:1px solid #ccc;width:100%;margin-bottom:15px">
                    <option value="pdb">PDB</option>
                    <option value="mmcif">mmCIF / CIF</option>
                    <option value="gro">GRO (Gromacs)</option>
                    <option value="sdf">SDF</option>
                    <option value="mol">MOL</option>
                    <option value="xyz">XYZ</option>
                </select>
                <button id="format-confirm"
                    style="background:#2da44e;color:white;border:none;
                           padding:10px 20px;font-weight:bold;border-radius:4px;
                           cursor:pointer;width:100%">
                    Launch Workspace
                </button>
            </div>`;

        document.getElementById('format-confirm').addEventListener('click', () => {
            const selectedFormat = document.getElementById('format-select').value;
            bootWorkspace(rawUrl, selectedFormat);
        });
        return;
    }

    // SCENARIO 4: Remote URL with known format — boot instantly
    bootWorkspace(rawUrl, format);
});
