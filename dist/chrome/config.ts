// src/config.ts

import type { TargetDefinition, Preset, ExtensionSettings } from './types.js';

// ---------------------------------------------------------------------------
// RepSchema — defines every allowed representation and its configurable params.
// Keys here are the canonical RepType values used everywhere else.
// ---------------------------------------------------------------------------
const RepSchema: Record<string, { label: string; params: Record<string, unknown> }> = {
  cartoon:       { label: "Cartoon",       params: { tubular_helices: 'boolean' } },
  backbone:      { label: "Backbone",      params: {} },
  ball_and_stick:{ label: "Ball & Stick",  params: { ignore_hydrogens: 'boolean' } },
  line:          { label: "Line",          params: { ignore_hydrogens: 'boolean' } },
  spacefill:     { label: "Spacefill",     params: { ignore_hydrogens: 'boolean' } },
  carbohydrate:  { label: "Carbohydrate",  params: {} },
  putty:         { label: "Putty",         params: { size_theme: ['uniform', 'uncertainty'] } },
  surface:       { label: "Surface",       params: { surface_type: ['molecular', 'gaussian'], ignore_hydrogens: 'boolean' } },
  off:           { label: "Hide / Off",    params: {} },
};

// ---------------------------------------------------------------------------
// Targets — the built-in molecular component categories.
// Each drives a row in the options UI and a component branch in the MVS tree.
// ---------------------------------------------------------------------------
const targets: TargetDefinition[] = [
  { id: "protein",  selector: "protein",  label: "Proteins",                    rep: "cartoon",       color: "chain-id",      size: null },
  { id: "nucleic",  selector: "nucleic",  label: "Nucleic Acids (DNA/RNA)",     rep: "cartoon",       color: "chain-id",      size: null },
  { id: "ligand",   selector: "ligand",   label: "Ligands & Small Molecules",   rep: "ball_and_stick",color: "element-symbol", size: 1.0  },
  { id: "carbs",    selector: "branched", label: "Carbohydrates & Glycans",     rep: "carbohydrate",  color: "chain-id",      size: null },
  { id: "ion",      selector: "ion",      label: "Single Ions",                 rep: "ball_and_stick",color: "element-symbol", size: 0.7  },
  { id: "lipid", selector: "lipid", label: "Lipids", rep: "line", color: "element-symbol", size: 0.7 },
  { id: "water",    selector: "water",    label: "Water / Solvent",             rep: "line",          color: "element-symbol", size: null },
  // { id: "all",      selector: "all",      label: "All",                         rep: "ball_and_stick",color: "element-symbol", size: 1.0  },
];

// ---------------------------------------------------------------------------
// Presets — built-in visual templates selectable from the popup / options page
// ---------------------------------------------------------------------------
const presets: Record<string, Preset> = {
  standard: {
    name: "Standard Mol* (Smart Guess)",
    settings: {},
  },
  surface_focus: {
    name: "Protein Surface + Spacefill Ligands",
    settings: {
      protein_rep: "surface",  protein_colorType: "theme",  protein_colorVal: "chain-id",
      nucleic_rep: "surface",  nucleic_colorType: "theme",  nucleic_colorVal: "chain-id",
      ligand_rep:  "spacefill",ligand_colorType:  "theme",  ligand_colorVal:  "element-symbol",
      water_rep:   "off",
      canvas_color: "#ffffff",
    },
  },
  dark_mode: {
    name: "Dark Mode Canvas",
    settings: { canvas_color: "#111111" },
  },
  all_uniform: {
    name: "Uniform Ball & Stick",
    settings: { protein_rep: "ball_and_stick", protein_colorType: "theme", protein_colorVal: "element-symbol" },
  },
};

// ---------------------------------------------------------------------------
// getDefaults — generates the full settings object with sensible default values.
// This is the single source of truth for what keys exist in storage.
// ---------------------------------------------------------------------------
function getDefaults(): ExtensionSettings {
  const THEME_COLORS = new Set(['chain-id', 'element-symbol', 'secondary-structure']);

  const defaults: ExtensionSettings = {
    canvas_color:  "#ffffff",
    camera_json:   "",
    customRules:   [],
  };

  for (const t of targets) {
    defaults[`${t.id}_rep`]       = t.rep;
    defaults[`${t.id}_colorType`] = THEME_COLORS.has(t.color) ? 'theme' : 'solid';
    defaults[`${t.id}_colorVal`]  = t.color;
    if (t.size !== null) defaults[`${t.id}_size`] = t.size;
  }

  return defaults;
}

// ---------------------------------------------------------------------------
// Export as a single namespace object so it can be loaded as a plain script
// (content scripts, sandbox) or as an ES module.
// ---------------------------------------------------------------------------
export const AppConfig = {
  RepSchema,
  targets,
  presets,
  getDefaults,
} as const;
