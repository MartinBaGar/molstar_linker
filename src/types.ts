// src/types.ts

// ---------------------------------------------------------------------------
// 1. Representation types — must match the keys in AppConfig.RepSchema exactly
// ---------------------------------------------------------------------------
export type RepType =
  | "cartoon"
  | "backbone"
  | "ball_and_stick"
  | "line"
  | "spacefill"
  | "carbohydrate"
  | "putty"
  | "surface"
  | "off";

// "highlight" is only valid in custom rules, not as a target rep
export type RuleRepType = RepType | "highlight";

// ---------------------------------------------------------------------------
// 2. Target definition — one entry per molecular component category
// ---------------------------------------------------------------------------
export interface TargetDefinition {
  id: string;
  selector: string;
  label: string;
  rep: RepType;
  color: string;
  size: number | null;
  mvsSelector?: string | null;
}

// ---------------------------------------------------------------------------
// 3. Custom Rule — the full data model for a user-defined visual rule
// ---------------------------------------------------------------------------
export interface CustomRule {
  name: string;
  rep: RuleRepType;
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
  subParams: Record<string, boolean | string>;
  // Computed at save-time from simple/expert mode fields
  selector?: Record<string, unknown> | Record<string, unknown>[] | string;
  advancedParams?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 4. Extension settings — stored in chrome.storage.sync
// ---------------------------------------------------------------------------
export interface ExtensionSettings {
  canvas_color: string;
  camera_json: string;
  customRules: CustomRule[];
  // Dynamic keys: e.g. "protein_rep", "ligand_colorVal", "ion_size"
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// 5. Presets / Templates
// ---------------------------------------------------------------------------
export interface Preset {
  name: string;
  settings: Partial<ExtensionSettings>;
}

// ---------------------------------------------------------------------------
// 6. Message protocol: content script → background
// ---------------------------------------------------------------------------
export interface OpenViewerMessage {
  action: "open_viewer";
  url: string;
  format: string;
}

// ---------------------------------------------------------------------------
// 7. Message protocol: viewer ↔ sandbox iframe
// ---------------------------------------------------------------------------
export interface SandboxReadyMessage {
  action: "SANDBOX_READY";
}

export interface InitMolstarMessage {
  action: "INIT_MOLSTAR";
  /** data: URI string, or null for an empty workspace */
  url: string | null;
  /** Mol* format string, or null for an empty workspace */
  format: string | null;
  settings: ExtensionSettings;
  /** The original remote URL, used to extract a filename for the blob URL hash */
  originalUrl: string | null;
}

export type SandboxInboundMessage = InitMolstarMessage;
export type SandboxOutboundMessage = SandboxReadyMessage;
