// src/options.ts
import { AppConfig } from './config.js';
import { PermissionsManager } from './permissions.js';
const extApi = (typeof browser !== 'undefined' ? browser : chrome);
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Exact DOM Elements mapped to your HTML
    const ruleList = document.getElementById('custom-rules-container');
    const addRuleBtn = document.getElementById('add-custom-rule');
    const saveBtn = document.getElementById('save');
    const templateSelect = document.getElementById('template-select');
    const templateNameInput = document.getElementById('new-template-name');
    const saveTemplateBtn = document.getElementById('save-template');
    const domainList = document.getElementById('custom-domains-list');
    const settingsContainer = document.getElementById('settings-container');
    const sceneContainer = document.getElementById('scene-settings-container');
    const settings = await new Promise(resolve => extApi.storage.sync.get(AppConfig.getDefaults(), (data) => resolve(data)));
    // 2. MISSING LOGIC RESTORED: Render Global Scene Settings
    sceneContainer.innerHTML = `
        <div style="margin-bottom: 12px;">
            <label style="display:block; font-weight:bold; margin-bottom:4px;">Canvas Color</label>
            <input type="color" id="canvas_color" value="${settings.canvas_color || '#ffffff'}">
        </div>
        <div style="margin-bottom: 12px;">
            <label style="display:block; font-weight:bold; margin-bottom:4px;">Camera JSON (Optional)</label>
            <input type="text" id="camera_json" placeholder="{...}" value="${settings.camera_json || ''}" style="width:100%; padding:8px;">
        </div>
    `;
    // 3. MISSING LOGIC RESTORED: Render Global Targets (Proteins, Ligands, etc.)
    let targetsHTML = '';
    AppConfig.targets.forEach(t => {
        const repOptions = Object.keys(AppConfig.RepSchema).map(r => `<option value="${r}" ${settings[`${t.id}_rep`] === r ? 'selected' : ''}>${r}</option>`).join('');
        targetsHTML += `
        <div style="background: #f6f8fa; padding: 12px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #d0d7de;">
            <h4 style="margin: 0 0 10px 0;">${t.label}</h4>
            <div style="display:flex; gap:10px;">
                <div style="flex:1;">
                    <label style="display:block; font-size:12px;">Representation</label>
                    <select id="${t.id}_rep" style="width:100%; padding:6px;">${repOptions}</select>
                </div>
                <div style="flex:1;">
                    <label style="display:block; font-size:12px;">Color Value</label>
                    <input type="text" id="${t.id}_colorVal" value="${settings[`${t.id}_colorVal`] || t.color}" style="width:100%; padding:6px;">
                </div>
            </div>
        </div>`;
    });
    settingsContainer.innerHTML = targetsHTML;
    // 4. Custom Domain Management
    async function refreshDomainList() {
        const data = await new Promise(resolve => extApi.storage.sync.get({ customDomains: [] }, resolve));
        const domains = data.customDomains || [];
        domainList.innerHTML = domains.length === 0 ? '<p style="color: #57606a; font-size: 13px;">No custom domains authorized yet.</p>' : '';
        domains.forEach(domain => {
            const item = document.createElement('div');
            item.innerHTML = `<span style="font-weight:bold; margin-right:15px;">${escapeHTML(domain)}</span><button class="btn-remove" data-domain="${escapeHTML(domain)}" style="color:red; cursor:pointer;">Remove</button>`;
            item.querySelector('.btn-remove')?.addEventListener('click', async (e) => {
                const target = e.target;
                const d = target.getAttribute('data-domain');
                if (d) {
                    await PermissionsManager.revokeAndUnregister(d);
                    refreshDomainList();
                }
            });
            domainList.appendChild(item);
        });
    }
    refreshDomainList();
    // 5. Custom Rules Logic
    function createRuleUI(rule = {}) {
        const id = Math.random().toString(36).substr(2, 9);
        const card = document.createElement('div');
        card.className = 'rule-card';
        card.style.cssText = 'background: white; padding: 12px; border: 1px solid #d0d7de; margin-bottom: 10px; border-radius: 6px;';
        card.innerHTML = `
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <input type="text" class="rule-name" placeholder="Rule Name" value="${escapeHTML(rule.name || '')}" style="flex:1;">
                <button class="btn-delete-rule" style="color:red; cursor:pointer;">Delete</button>
            </div>
            <div style="display:flex; gap:10px;">
                <input type="text" class="rule-selector" placeholder="Selector (e.g. :A)" value="${escapeHTML(rule.selector || '')}" style="flex:2;">
                <select class="rule-rep" style="flex:1;">
                    ${Object.keys(AppConfig.RepSchema).map(r => `<option value="${r}" ${rule.rep === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
                <input type="color" class="rule-color" value="${rule.colorVal || '#ffffff'}">
            </div>
        `;
        card.querySelector('.btn-delete-rule')?.addEventListener('click', () => card.remove());
        ruleList.appendChild(card);
    }
    if (settings.customRules)
        settings.customRules.forEach(r => createRuleUI(r));
    addRuleBtn.addEventListener('click', () => createRuleUI());
    // 6. Global Save Logic
    async function gatherCurrentUIAsSettings() {
        const newSettings = { ...AppConfig.getDefaults() };
        newSettings.canvas_color = document.getElementById('canvas_color').value;
        newSettings.camera_json = document.getElementById('camera_json').value;
        AppConfig.targets.forEach(t => {
            const r = document.getElementById(`${t.id}_rep`).value;
            const c = document.getElementById(`${t.id}_colorVal`).value;
            newSettings[`${t.id}_rep`] = r;
            newSettings[`${t.id}_colorVal`] = c;
        });
        const rules = [];
        document.querySelectorAll('.rule-card').forEach(card => {
            const c = card;
            rules.push({
                name: c.querySelector('.rule-name').value,
                selector: c.querySelector('.rule-selector').value,
                rep: c.querySelector('.rule-rep').value,
                colorVal: c.querySelector('.rule-color').value,
                colorType: 'solid', size: '1.0', opacity: '1.0', mode: 'simple', scheme: 'auth', chain: '', ranges: '', specific: '', atomName: '', element: '', atomIndex: '', label: '', tooltip: '', focus: false, rawJson: '', rawParamsJson: '', subParams: {}
            });
        });
        newSettings.customRules = rules;
        return newSettings;
    }
    saveBtn.addEventListener('click', async () => {
        const finalSettings = await gatherCurrentUIAsSettings();
        extApi.storage.sync.set(finalSettings, () => alert("Settings saved successfully!"));
    });
    // 7. GESTURE SAFE DOMAIN AUTHORIZATION
    const urlParams = new URLSearchParams(window.location.search);
    const domainToAuth = urlParams.get('domain');
    if (domainToAuth) {
        // Create an overlay so the user HAS to click a button (satisfies Chrome's User Gesture rule)
        const overlay = document.createElement('div');
        overlay.innerHTML = `
            <div style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:9999;">
                <div style="background:white; padding:30px; border-radius:8px; text-align:center; max-width:400px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                    <h2 style="margin-top:0; color:#0969da;">Authorize Domain</h2>
                    <p>Would you like to allow Mol* Linker to run on <br><strong>${escapeHTML(domainToAuth)}</strong>?</p>
                    <div style="margin-top:20px;">
                        <button id="btn-auth-yes" style="background:#2da44e; color:white; padding:10px 20px; border:none; border-radius:4px; cursor:pointer; font-weight:bold; margin-right:10px;">Yes, Authorize</button>
                        <button id="btn-auth-no" style="background:#eee; color:#333; padding:10px 20px; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('btn-auth-yes')?.addEventListener('click', async () => {
            const success = await PermissionsManager.requestAndRegister(domainToAuth);
            if (success)
                refreshDomainList();
            overlay.remove();
        });
        document.getElementById('btn-auth-no')?.addEventListener('click', () => overlay.remove());
    }
});
