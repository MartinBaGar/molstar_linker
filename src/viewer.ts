// src/viewer.ts

import { PermissionsManager } from './permissions.js';
import { AppConfig } from './config.js';

declare const browser: typeof chrome;
const extApi = typeof browser !== 'undefined' ? browser : chrome;

const MAX_BYTES = 25 * 1024 * 1024; // 25MB limit
const ALLOWED_FORMATS = new Set(['pdb', 'cif', 'mmcif', 'bcif', 'gro', 'sdf', 'mol', 'mol2', 'xyz', 'ent']);

// --- SECURITY: Blocked IP Ranges (SSRF Protection) ---
const BLOCKED_RANGES = [
    /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./,
    /^169\.254\./, /^fc00:/, /^fe80:/, /^::1$/, /localhost/i
];

function isSafeUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
        return !BLOCKED_RANGES.some(regex => regex.test(parsed.hostname));
    } catch { return false; }
}

async function bootWorkspace(rawUrl: string, safeFormat: string) {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) loadingDiv.innerText = 'Downloading structure securely...';

    try {
        if (!isSafeUrl(rawUrl)) throw new Error("Access to this local or restricted network address is blocked for security.");

        const response = await fetch(rawUrl);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

        // Check content length header
        const contentLength = response.headers.get('Content-Length');
        if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
            throw new Error('File exceeds the 25 MB size limit.');
        }

        const blob = await response.blob();
        if (blob.size > MAX_BYTES) throw new Error('File exceeds the 25 MB size limit.');

        // Firefox/Privacy Guard Sanity Check: Ensure we didn't download an XML error page
        const textPreview = await blob.slice(0, 150).text();
        if (textPreview.trim().startsWith('<?xml') || textPreview.includes('<Error>')) {
            throw new Error("Download blocked by browser tracking protection. Please authorize this domain in the Studio.");
        }

        const dataUri = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });

        spawnIframe(dataUri, safeFormat, rawUrl);
    } catch (error: any) {
        console.error("Workspace Fetch Error:", error);
        const ld = document.getElementById('loading');
        if (ld) {
            ld.innerHTML = `
                <div style="background: white; padding: 20px 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); text-align: center; color: #333; max-width: 400px; margin: 0 auto;">
                    <h3 style="margin-top: 0; color: #d73a49;">Download Blocked</h3>
                    <p style="font-size: 14px; color: #555; margin-bottom: 0; line-height: 1.5;">${error.message}</p>
                </div>`;
        }
    }
}

let currentIframe: HTMLIFrameElement | null = null;

function spawnIframe(dataUri: string, format: string, sourceUrl: string) {
    const container = document.getElementById('viewer-container');
    if (!container) return;

    if (currentIframe) {
        currentIframe.remove();
        currentIframe = null;
    }

    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';

    const iframe = document.createElement('iframe');
    iframe.id = 'sandbox-iframe';
    iframe.src = 'sandbox.html';
    iframe.style.cssText = 'width:100%; height:100%; border:none; display:block;';
    currentIframe = iframe;

    window.addEventListener('message', async (event: MessageEvent) => {
        if (event.source !== iframe.contentWindow) return;
        if (event.data.type === 'sandbox-ready') {
            const data = await extApi.storage.sync.get(AppConfig.getDefaults());
            iframe.contentWindow?.postMessage({
                type: 'load-structure',
                dataUri: dataUri,
                format: format,
                sourceUrl: sourceUrl,
                settings: data
            }, '*');
        }
    }, { once: true });

    container.appendChild(iframe);
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const rawUrl = urlParams.get('url');
    let format = urlParams.get('format') || 'unknown';
    const loadingDiv = document.getElementById('loading') as HTMLDivElement | null;

    if (!rawUrl) {
        if (loadingDiv) loadingDiv.innerText = 'Empty Workspace. Drag and drop a file to begin.';
        return;
    }

    const targetDomain = PermissionsManager.cleanDomain(rawUrl);
    const defaultDomains = ['github.com', 'gitlab.com', 'rcsb.org', 'alphafold.ebi.ac.uk'];
    const isDefault = defaultDomains.some(d => targetDomain.includes(d));

    // 1. Authorization Gatekeeper
    if (!isDefault) {
        const storageData = await new Promise<{ customDomains: string[] }>(resolve => extApi.storage.sync.get({ customDomains: [] }, resolve));
        if (!storageData.customDomains.includes(targetDomain)) {
            if (loadingDiv) {
                loadingDiv.innerHTML = `
                    <div style="background:white;padding:20px 30px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);text-align:center;color:#333;max-width:400px;margin:0 auto">
                        <h3 style="margin-top:0;color:#d73a49">Unauthorized Domain</h3>
                        <p style="font-size:14px;color:#666;margin-bottom:20px">Trying to open a link from <strong>${targetDomain}</strong>. Would you like to authorize this domain?</p>
                        <div style="display:flex; gap: 10px;">
                            <button id="auth-cancel" style="background:#eee;color:#333;border:none;padding:10px;font-weight:bold;border-radius:4px;cursor:pointer;flex:1;">Cancel</button>
                            <button id="auth-confirm" style="background:#0969da;color:white;border:none;padding:10px;font-weight:bold;border-radius:4px;cursor:pointer;flex:1;">Yes, Authorize</button>
                        </div>
                    </div>`;

                document.getElementById('auth-confirm')?.addEventListener('click', () => {
                    extApi.tabs.create({ url: `options.html?domain=${encodeURIComponent(targetDomain)}` });
                    window.close();
                });

                document.getElementById('auth-cancel')?.addEventListener('click', () => {
                    loadingDiv.innerHTML = `<div style="background:white;padding:20px 30px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);text-align:center;color:#d73a49;max-width:400px;margin:0 auto;font-weight:bold;font-size:16px;">Not authorized.</div>`;
                });
            }
            return;
        }
    }

    // 2. Format Selection Gatekeeper
    if (!ALLOWED_FORMATS.has(format)) {
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <div style="background:white;padding:20px 30px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);text-align:center;color:#333;max-width:400px;margin:0 auto">
                    <h3 style="margin-top:0;color:#2c3e50">Unknown File Format</h3>
                    <select id="format-select" style="padding:8px;font-size:14px;border-radius:4px;border:1px solid #ccc;width:100%;margin-bottom:15px">
                        <option value="pdb">PDB</option>
                        <option value="mmcif">mmCIF / CIF</option>
                        <option value="gro">GRO</option>
                        <option value="sdf">SDF</option>
                    </select>
                    <button id="format-confirm" style="background:#2da44e;color:white;border:none;padding:10px 20px;font-weight:bold;border-radius:4px;cursor:pointer;width:100%">Launch Workspace</button>
                </div>`;

            document.getElementById('format-confirm')?.addEventListener('click', () => {
                const sel = document.getElementById('format-select') as HTMLSelectElement;
                bootWorkspace(rawUrl, sel.value);
            });
        }
        return;
    }

    bootWorkspace(rawUrl, format);
});
