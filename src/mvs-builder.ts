// src/mvs-builder.ts

import { AppConfig } from './config.js';
import type { ExtensionSettings, RepType } from './types.js';

// ---------------------------------------------------------------------------
// Allowed sub-parameter keys per representation type.
// This is a strict allowlist — no arbitrary keys from user storage can leak
// into the MVS tree (prevents prototype pollution and unexpected MVS nodes).
// ---------------------------------------------------------------------------
const ALLOWED_SUB_KEYS: Partial<Record<string, string[]>> = {
  ball_and_stick: ['ignore_hydrogens'],
  line:           ['ignore_hydrogens'],
  spacefill:      ['ignore_hydrogens'],
  surface:        ['surface_type', 'ignore_hydrogens'],
  putty:          ['size_theme'],
  cartoon:        ['tubular_helices'],
};

// ---------------------------------------------------------------------------
// Allowed Mol* color theme names
// ---------------------------------------------------------------------------
const ALLOWED_THEMES = new Set([
  'chain-id', 'element-symbol', 'secondary-structure', 'residue-name',
  'sequence-id', 'uniform', 'uncertainty', 'b-factor',
]);

// ---------------------------------------------------------------------------
// Internal MVS node types (loose — Mol* accepts plain JSON objects)
// ---------------------------------------------------------------------------
type MvsNode = Record<string, unknown>;

// ---------------------------------------------------------------------------
// MvsBuilder
// ---------------------------------------------------------------------------
export const MvsBuilder = {

  // -------------------------------------------------------------------------
  // Security: string sanitizer
  // Strips null bytes and non-printable control characters, caps length.
  // MVS nodes are JSON (not HTML) so HTML-escaping is intentionally skipped.
  // -------------------------------------------------------------------------
  _sanitizeString(value: unknown, maxLength = 512): string {
    if (typeof value !== 'string') return '';
    return value
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .slice(0, maxLength);
  },

  // -------------------------------------------------------------------------
  // Security: color sanitizer
  // -------------------------------------------------------------------------
  _sanitizeColor(colorType: string, colorVal: string): string {
    if (colorType === 'theme') {
      return ALLOWED_THEMES.has(colorVal) ? colorVal : 'chain-id';
    }
    // Solid: only #rrggbb hex strings or a small set of safe named colors
    if (/^#[0-9a-fA-F]{6}$/.test(colorVal)) return colorVal;
    const SAFE_NAMED = new Set(['white', 'red', 'blue', 'green', 'black']);
    return SAFE_NAMED.has(colorVal) ? colorVal : 'white';
  },

  // -------------------------------------------------------------------------
  // Security: rep-type sanitizer
  // -------------------------------------------------------------------------
  _sanitizeRepType(repType: string): RepType {
    const allowed = new Set(Object.keys(AppConfig.RepSchema)) as Set<string>;
    return (allowed.has(repType) ? repType : 'ball_and_stick') as RepType;
  },

  // -------------------------------------------------------------------------
  // Security: deep-sanitize an arbitrary object before embedding as MVS params.
  // Caps depth at 2, rejects arrays and prototype-polluting keys.
  // Used for camera_json and other free-form JSON fields.
  // -------------------------------------------------------------------------
  _deepSanitize(obj: unknown, depth = 0): Record<string, unknown> {
    if (depth > 2 || typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return {};
    }
    const result: Record<string, unknown> = Object.create(null);
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      result[k] = typeof v === 'object' && v !== null
        ? this._deepSanitize(v, depth + 1)
        : v;
    }
    return result;
  },

  // -------------------------------------------------------------------------
  // Apply sub-params from user storage using the strict ALLOWED_SUB_KEYS list
  // -------------------------------------------------------------------------
  _applySafeSubParams(
    target: Record<string, unknown>,
    repType: string,
    rawParams: unknown,
  ): void {
    if (!rawParams || typeof rawParams !== 'object' || Array.isArray(rawParams)) return;
    const allowed = ALLOWED_SUB_KEYS[repType] ?? [];
    const params = rawParams as Record<string, unknown>;
    for (const key of allowed) {
      if (key in params) target[key] = params[key];
    }
  },

  // -------------------------------------------------------------------------
  // Public: build a Mol* Viewer URL with embedded MVS data
  // -------------------------------------------------------------------------
  createViewerUrl(rawStructureUrl: string, format: string, settings: ExtensionSettings): string {
    const parserFormat = format === 'cif' ? 'mmcif' : format;
    const mvsDataString = JSON.stringify(this._buildBaseTemplate(rawStructureUrl, parserFormat, settings));
    return `https://molstar.org/viewer/?mvs-format=mvsj&mvs-data=${encodeURIComponent(mvsDataString)}`;
  },

  // -------------------------------------------------------------------------
  // Public: build the raw MVS JSON object
  // -------------------------------------------------------------------------
  _buildBaseTemplate(url: string, format: string, settings: ExtensionSettings): MvsNode {
    const rootChildren: MvsNode[] = [
      {
        kind: 'download',
        params: { url },
        children: [{
          kind: 'parse',
          params: { format },
          children: [{
            kind: 'structure',
            params: { type: 'model' },
            children: this._buildComponentBranches(settings),
          }],
        }],
      },
    ];

    // Canvas background color (skip the default white to keep the template lean)
    if (settings.canvas_color && settings.canvas_color !== '#ffffff' && settings.canvas_color !== 'white') {
      const safeColor = /^#[0-9a-fA-F]{6}$/.test(settings.canvas_color)
        ? settings.canvas_color
        : '#ffffff';
      rootChildren.push({ kind: 'canvas', params: { background_color: safeColor } });
    }

    // Optional camera position JSON
    if (settings.camera_json) {
      try {
        const raw = JSON.parse(settings.camera_json as string);
        const camParams = this._deepSanitize(raw);
        if (Object.keys(camParams).length > 0) {
          rootChildren.push({ kind: 'camera', params: camParams });
        }
      } catch {
        console.warn('Mol* Builder: invalid camera_json, skipped');
      }
    }

    return {
      metadata: { version: '1' },
      root: { kind: 'root', children: rootChildren },
    };
  },

  // -------------------------------------------------------------------------
  // Build a color MVS node
  // -------------------------------------------------------------------------
  _getColorNode(colorType: string, colorVal: string): MvsNode {
    const safeColor = this._sanitizeColor(colorType, colorVal);
    if (colorType === 'theme') {
      return {
        kind: 'color',
        params: { color: 'white' },
        custom: { molstar_color_theme_name: safeColor },
      };
    }
    return { kind: 'color', params: { color: safeColor } };
  },

  // -------------------------------------------------------------------------
  // Build all component branches (custom rules + global targets)
  // -------------------------------------------------------------------------
  _buildComponentBranches(settings: ExtensionSettings): MvsNode[] {
    const branches: MvsNode[] = [];
    // Color-override nodes applied on top of polymer representations
    const polymerColorOverrides: MvsNode[] = [];
    // Custom component branches appended after the global target branches
    const customComponentBranches: MvsNode[] = [];

    const customRules = Array.isArray(settings.customRules) ? settings.customRules : [];

    // ------------------------------------------------------------------
    // PASS 1: Custom Rules
    // ------------------------------------------------------------------
    const MAX_RULES = 50;
    customRules.slice(0, MAX_RULES).forEach(rule => {
      if (!rule || typeof rule !== 'object') return;

      const componentChildren: MvsNode[] = [];

      const safeLabel    = rule.label    ? this._sanitizeString(rule.label,    256) : null;
      const safeTooltip  = rule.tooltip  ? this._sanitizeString(rule.tooltip,  512) : null;

      // Selector can be a plain object/array (from JSON.parse in options) or a string
      let safeSelector: string | Record<string, unknown> | unknown[] | null = null;
      if (rule.selector !== undefined && rule.selector !== null && rule.selector !== '') {
        if (typeof rule.selector === 'string') {
          safeSelector = this._sanitizeString(rule.selector, 256) || null;
        } else if (typeof rule.selector === 'object') {
          // Structured selector — already validated by options.ts extraction
          safeSelector = rule.selector as Record<string, unknown> | unknown[];
        }
      }
      if (!safeSelector) return; // A rule without a selector is meaningless

      if (safeLabel)   componentChildren.push({ kind: 'label',   params: { text: safeLabel } });
      if (safeTooltip) componentChildren.push({ kind: 'tooltip', params: { text: safeTooltip } });
      if (rule.focus)  componentChildren.push({ kind: 'focus',   params: {} });

      const ruleType = rule.rep ? this._sanitizeRepType(rule.rep) : 'highlight' as RepType;

      if ((ruleType as string) === 'highlight') {
        // Highlight-only: add a color override node onto polymer representations
        const colorNode = this._getColorNode(rule.colorType, rule.colorVal);
        (colorNode.params as Record<string, unknown>).selector = safeSelector;
        polymerColorOverrides.push(colorNode);

        if (componentChildren.length > 0) {
          customComponentBranches.push({
            kind: 'component',
            params: { selector: safeSelector },
            children: componentChildren,
          });
        }
      } else {
        // Spawn a new representation component
        const repParams: Record<string, unknown> = { type: ruleType };

        if (rule.size !== undefined) {
          const sz = parseFloat(rule.size as string);
          if (!isNaN(sz) && sz > 0 && sz <= 10) repParams.size_factor = sz;
        }

        this._applySafeSubParams(repParams, ruleType, rule.subParams);
        this._applySafeSubParams(repParams, ruleType, rule.advancedParams);

        const repChildren: MvsNode[] = [this._getColorNode(rule.colorType, rule.colorVal)];

        if (rule.opacity !== undefined) {
          const op = parseFloat(rule.opacity as string);
          if (!isNaN(op) && op >= 0 && op <= 1) {
            repChildren.push({ kind: 'opacity', params: { opacity: op } });
          }
        }

        componentChildren.push({ kind: 'representation', params: repParams, children: repChildren });
        customComponentBranches.push({
          kind: 'component',
          params: { selector: safeSelector },
          children: componentChildren,
        });
      }
    });

    // ------------------------------------------------------------------
    // PASS 2: Global Targets (protein, nucleic, ligand, …)
    // ------------------------------------------------------------------
    for (const target of AppConfig.targets) {
      const repType = settings[`${target.id}_rep`] as string | undefined;
      if (!repType || repType === 'off') continue;

      const sizeVal  = settings[`${target.id}_size`];
      const repParams: Record<string, unknown> = { type: this._sanitizeRepType(repType) };

      if (sizeVal !== undefined && sizeVal !== '') {
        const sz = parseFloat(String(sizeVal));
        if (!isNaN(sz) && sz > 0 && sz <= 10) repParams.size_factor = sz;
      }

      this._applySafeSubParams(
        repParams,
        repParams.type as string,
        settings[`${target.id}_subParams`],
      );

      const repChildren: MvsNode[] = [
        this._getColorNode(
          settings[`${target.id}_colorType`] as string,
          settings[`${target.id}_colorVal`]  as string,
        ),
      ];

      const opacityVal = settings[`${target.id}_opacity`];
      if (opacityVal !== undefined) {
        const op = parseFloat(String(opacityVal));
        if (!isNaN(op) && op >= 0 && op <= 1) {
          repChildren.push({ kind: 'opacity', params: { opacity: op } });
        }
      }

      const representationNode: MvsNode = {
        kind: 'representation',
        params: repParams,
        children: repChildren,
      };

      // Attach color-override nodes onto polymer components
      if (['protein', 'nucleic'].includes(target.selector)) {
        (representationNode.children as MvsNode[]).push(...polymerColorOverrides);
      }

      const mvsSelector = 'mvsSelector' in target ? target.mvsSelector : target.selector;
      if (mvsSelector === null || mvsSelector === undefined) continue;

      branches.push({
        kind: 'component',
        params: { selector: target.selector },
        children: [representationNode],
      });
    }

    branches.push(...customComponentBranches);
    return branches;
  },
};
