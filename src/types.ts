// src/types.ts

// 1. Exact strings Mol* allows for representations
export type RepType = 
  | "cartoon" 
  | "backbone" 
  | "ball_and_stick" 
  | "line" 
  | "spacefill" 
  | "carbohydrate" 
  | "putty" 
  | "surface" 
  | "off" 
  | "highlight"; // Highlight is used by Custom Rules

// 2. The definition for your Built-in Targets (Proteins, Nucleic, Ligands)
export interface TargetDefinition {
    id: string;
    selector: string;
    label: string;
    rep: RepType;
    color: string;
    size: number | null;
}

// 3. The exact structure of a user-generated Custom Rule
export interface CustomRule {
    name: string;
    rep: RepType;
    colorType: "theme" | "solid";
    colorVal: string;
    size: string;
    opacity: string;
    mode: "simple" | "expert";
    scheme: "auth" | "label";
    chain: string;
    ranges: string;
    specific: string;
    atomName: string;
    element: string;
    atomIndex: string;
    label: string;
    tooltip: string;
    focus: boolean;
    rawJson: string;
    rawParamsJson: string;
    subParams: Record<string, any>;
    selector?: any;
    advancedParams?: Record<string, any>;
}

// 4. The Master Settings Object (What gets saved to chrome.storage.sync)
export interface ExtensionSettings {
    canvas_color: string;
    camera_json: string;
    customRules?: CustomRule[];
    // Allows dynamic keys like 'protein_rep' or 'ligand_colorVal'
    [key: string]: any; 
}

// 5. Structure for your Built-in and Custom Templates
export interface Preset {
    name: string;
    settings: Partial<ExtensionSettings>;
}
