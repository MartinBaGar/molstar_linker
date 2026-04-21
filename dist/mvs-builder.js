// src/mvs-builder.ts
import { AppConfig } from './config.js';
export const MvsBuilder = {
    _sanitizeString: function (value, maxLength = 512) {
        if (typeof value !== 'string')
            return '';
        return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, maxLength);
    },
    _sanitizeColor: function (colorType, colorVal) {
        const ALLOWED_THEMES = new Set([
            'chain-id', 'element-symbol', 'secondary-structure', 'residue-name',
            'sequence-id', 'uniform', 'uncertainty', 'b-factor'
        ]);
        if (colorType === 'theme') {
            return ALLOWED_THEMES.has(colorVal) ? colorVal : 'chain-id';
        }
        if (/^#[0-9a-fA-F]{6}$/.test(colorVal))
            return colorVal;
        const ALLOWED_NAMED = new Set(['white', 'red', 'blue', 'green', 'black']);
        if (ALLOWED_NAMED.has(colorVal))
            return colorVal;
        return 'white';
    },
    _sanitizeRepType: function (repType) {
        const ALLOWED_REPS = new Set(Object.keys(AppConfig.RepSchema));
        return ALLOWED_REPS.has(repType) ? repType : 'ball_and_stick';
    },
    _deepSanitize: function (obj, depth = 0) {
        if (depth > 2 || typeof obj !== 'object' || obj === null)
            return obj;
        const result = Object.create(null);
        for (const [k, v] of Object.entries(obj)) {
            if (k === '__proto__' || k === 'constructor' || k === 'prototype')
                continue;
            result[k] = typeof v === 'object' ? this._deepSanitize(v, depth + 1) : v;
        }
        return result;
    },
    createViewerUrl: function (rawStructureUrl, format, settings) {
        const parserFormat = format === 'cif' ? 'mmcif' : format;
        const mvsTemplate = this._buildBaseTemplate(rawStructureUrl, parserFormat, settings);
        const mvsDataString = JSON.stringify(mvsTemplate);
        return `https://molstar.org/viewer/?mvs-format=mvsj&mvs-data=${encodeURIComponent(mvsDataString)}`;
    },
    _buildBaseTemplate: function (url, format, settings) {
        const rootChildren = [
            {
                "kind": "download",
                "params": { "url": url },
                "children": [{
                        "kind": "parse",
                        "params": { "format": format },
                        "children": [{
                                "kind": "structure",
                                "params": { "type": "model" },
                                "children": this._buildComponentBranches(settings)
                            }]
                    }]
            }
        ];
        if (settings.canvas_color && settings.canvas_color !== "#ffffff" && settings.canvas_color !== "white") {
            const safeColor = /^#[0-9a-fA-F]{6}$/.test(settings.canvas_color) ? settings.canvas_color : '#ffffff';
            rootChildren.push({ "kind": "canvas", "params": { "background_color": safeColor } });
        }
        if (settings.camera_json) {
            try {
                const camParams = this._deepSanitize(JSON.parse(settings.camera_json));
                if (camParams && typeof camParams === 'object' && !Array.isArray(camParams)) {
                    rootChildren.push({ "kind": "camera", "params": camParams });
                }
            }
            catch (e) {
                console.warn("Invalid Camera JSON");
            }
        }
        return { "metadata": { "version": "1" }, "root": { "kind": "root", "children": rootChildren } };
    },
    _getColorNode: function (colorType, colorVal) {
        const safeColor = this._sanitizeColor(colorType, colorVal);
        if (colorType === 'theme') {
            return { "kind": "color", "params": { "color": "white" }, "custom": { "molstar_color_theme_name": safeColor } };
        }
        return { "kind": "color", "params": { "color": safeColor } };
    },
    _buildComponentBranches: function (settings) {
        const branches = [];
        const polymerColorOverrides = [];
        const customComponentBranches = [];
        const customRules = Array.isArray(settings.customRules) ? settings.customRules : [];
        const ALLOWED_SUB_KEYS = {
            ball_and_stick: ['ignore_hydrogens'],
            surface: ['surface_type', 'ignore_hydrogens'],
            putty: ['size_theme'],
            cartoon: ['tubular_helices'],
            line: ['ignore_hydrogens'],
            spacefill: ['ignore_hydrogens']
        };
        function applySafeSubParams(targetObj, repType, rawParams) {
            if (!rawParams || typeof rawParams !== 'object' || Array.isArray(rawParams))
                return;
            const allowed = ALLOWED_SUB_KEYS[repType] || [];
            for (const k of allowed) {
                if (k in rawParams)
                    targetObj[k] = rawParams[k];
            }
        }
        const MAX_RULES = 50;
        customRules.slice(0, MAX_RULES).forEach((rule) => {
            if (!rule || typeof rule !== 'object')
                return;
            const componentChildren = [];
            const safeLabel = rule.label ? this._sanitizeString(rule.label, 256) : null;
            const safeTooltip = rule.tooltip ? this._sanitizeString(rule.tooltip, 512) : null;
            const safeSelector = rule.selector ? this._sanitizeString(rule.selector, 256) : null;
            if (!safeSelector)
                return;
            if (safeLabel)
                componentChildren.push({ "kind": "label", "params": { "text": safeLabel } });
            if (safeTooltip)
                componentChildren.push({ "kind": "tooltip", "params": { "text": safeTooltip } });
            if (rule.focus)
                componentChildren.push({ "kind": "focus", "params": {} });
            const ruleType = rule.rep ? this._sanitizeRepType(rule.rep) : "highlight";
            if (ruleType === "highlight") {
                const colorNode = this._getColorNode(rule.colorType, rule.colorVal);
                colorNode.params.selector = safeSelector;
                polymerColorOverrides.push(colorNode);
                if (componentChildren.length > 0) {
                    customComponentBranches.push({ "kind": "component", "params": { "selector": safeSelector }, "children": componentChildren });
                }
            }
            else {
                const repParams = { "type": ruleType };
                if (rule.size !== undefined) {
                    const sz = parseFloat(rule.size);
                    if (!isNaN(sz) && sz > 0 && sz <= 10)
                        repParams.size_factor = sz;
                }
                applySafeSubParams(repParams, ruleType, rule.subParams);
                applySafeSubParams(repParams, ruleType, rule.advancedParams);
                const repChildren = [this._getColorNode(rule.colorType, rule.colorVal)];
                if (rule.opacity !== undefined) {
                    const op = parseFloat(rule.opacity);
                    if (!isNaN(op) && op >= 0 && op <= 1) {
                        repChildren.push({ "kind": "opacity", "params": { "opacity": op } });
                    }
                }
                componentChildren.push({ "kind": "representation", "params": repParams, "children": repChildren });
                customComponentBranches.push({ "kind": "component", "params": { "selector": safeSelector }, "children": componentChildren });
            }
        });
        AppConfig.targets.forEach((target) => {
            const repType = settings[`${target.id}_rep`];
            if (!repType || repType === "off")
                return;
            const sizeVal = settings[`${target.id}_size`];
            const repParams = { "type": this._sanitizeRepType(repType) };
            if (sizeVal !== undefined && sizeVal !== "") {
                const sz = parseFloat(sizeVal);
                if (!isNaN(sz) && sz > 0 && sz <= 10)
                    repParams.size_factor = sz;
            }
            applySafeSubParams(repParams, repParams.type, settings[`${target.id}_subParams`]);
            const repChildren = [this._getColorNode(settings[`${target.id}_colorType`], settings[`${target.id}_colorVal`])];
            const opacityVal = settings[`${target.id}_opacity`];
            if (opacityVal !== undefined) {
                const op = parseFloat(opacityVal);
                if (!isNaN(op) && op >= 0 && op <= 1) {
                    repChildren.push({ "kind": "opacity", "params": { "opacity": op } });
                }
            }
            const representationNode = { "kind": "representation", "params": repParams, "children": repChildren };
            if (['protein', 'nucleic'].includes(target.selector)) {
                representationNode.children.push(...polymerColorOverrides);
            }
            branches.push({ "kind": "component", "params": { "selector": target.selector }, "children": [representationNode] });
        });
        branches.push(...customComponentBranches);
        return branches;
    }
};
