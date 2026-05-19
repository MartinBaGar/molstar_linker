// src/native-builder.ts

import { StructureSelectionQueries as Q } from 'molstar/lib/mol-plugin-state/helpers/structure-selection-query';
import { Script } from "molstar/lib/mol-script/script";
import { StateObjectRef } from "molstar/lib/mol-state";
import { PluginStateObject } from "molstar/lib/mol-plugin-state/objects";
import { StructureElement, Structure } from 'molstar/lib/mol-model/structure';
import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import { Color } from 'molstar/lib/mol-util/color';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { AppConfig } from './config.js';
import type { ExtensionSettings, CustomRule } from './types.js';

// ---------------------------------------------------------------------------
// Per-plugin tooltip state — stored on plugin.customState so each viewer
// instance owns its own data. No module-level globals means two viewers on
// the same page never overwrite each other.
// ---------------------------------------------------------------------------
type TooltipEntry = { loci: StructureElement.Loci; text: string };

function getTooltipState(plugin: PluginContext): {
  activeTooltips: TooltipEntry[];
  isRegistered: boolean;
} {
  const cs = plugin.customState as any;
  if (!cs.__nativeBuilder) {
    cs.__nativeBuilder = { activeTooltips: [], isRegistered: false };
  }
  return cs.__nativeBuilder;
}

export const NativeBuilder = {

  // -------------------------------------------------------------------------
  // Entry point — called from sandbox.ts after the blob URL is ready.
  // -------------------------------------------------------------------------
  async buildNativeScene(
    plugin: PluginContext,
    url: string,
    format: string,
    settings: ExtensionSettings,
  ): Promise<void> {
    const isBinary     = format === 'bcif';
    const parsedFormat = format === 'cif' ? 'mmcif' : format;

    const data       = await plugin.builders.data.download({ url, isBinary });
    const trajectory = await plugin.builders.structure.parseTrajectory(data, parsedFormat as any);
    const model      = await plugin.builders.structure.createModel(trajectory);
    const structure  = await plugin.builders.structure.createStructure(model);

    // ------------------------------------------------------------------
    // Canvas background colour
    // ------------------------------------------------------------------
    if (settings.canvas_color) {
      plugin.canvas3d?.setProps({
        renderer: { backgroundColor: Color.fromHexStyle(settings.canvas_color as string) },
      });
    }

    // ------------------------------------------------------------------
    // 1. Apply Mol* built-in preset (e.g., 'auto', 'polymer-and-ligand')
    // ------------------------------------------------------------------
    await plugin.builders.structure.hierarchy.applyPreset(
      trajectory,
      'default',
    );

    // ------------------------------------------------------------------
    // Hover tooltip provider — registered once per plugin instance.
    // activeTooltips is reset below so it always reflects the current
    // structure. Collecting all matches before returning ensures overlapping
    // rules all show their tooltips rather than the first one winning.
    // ------------------------------------------------------------------
    const state = getTooltipState(plugin);
    state.activeTooltips = [];

    if (!state.isRegistered) {
      plugin.managers.lociLabels.addProvider({
        label: (hoveredLoci: any) => {
          if (hoveredLoci.kind !== 'element-loci') return undefined;

          const rootA   = hoveredLoci.structure.root;
          const matches: string[] = [];

          for (const t of state.activeTooltips) {
            if (t.loci.structure.root !== rootA) continue;

            const intersect = StructureElement.Loci.intersect(
              StructureElement.Loci.remap(hoveredLoci, rootA),
              StructureElement.Loci.remap(t.loci, rootA),
            );

            if (!StructureElement.Loci.isEmpty(intersect)) {
              matches.push(t.text);
            }
          }

          return matches.length > 0 ? matches.join('<br/>') : undefined;
        },
      });
      state.isRegistered = true;
    }

    // ------------------------------------------------------------------
    // Custom rules
    // ------------------------------------------------------------------
    if (Array.isArray(settings.customRules)) {
      for (let i = 0; i < settings.customRules.length; i++) {
        const rule = settings.customRules[i];
        if (!rule) continue;

        const expression = rule.mode === 'expert' && rule.selector
          ? this.buildExpertExpression(rule.selector)
          : this.buildSimpleExpression(rule);

        const componentId = `custom-rule-${i}`;

        const component = await plugin.builders.structure.tryCreateComponentFromExpression(
          structure,
          expression,
          componentId,
          { label: rule.name || `Custom Rule ${i + 1}` },
        );

        if (!component?.obj?.data) continue;

        await this.applyCustomRuleRepresentation(plugin, component, rule);

        // 3D label — uses the same API as Measurements › Add › Label
        if (rule.label) {
          await this.apply3DLabel(plugin, component, rule);
        }

        // Hover tooltip — covers atoms rendered by the custom representation.
        // The lociLabels provider above collects all matches so overlapping
        // rules (e.g. Chain A + Residue 50) both appear in the tooltip.
        if (rule.label || rule.tooltip) {
          const text = [
            rule.tooltip ? `ℹ️ ${rule.tooltip}` : '',
          ].filter(Boolean).join(' · ');

          state.activeTooltips.push({
            loci: Structure.toStructureElementLoci(component.obj.data),
            text,
          });
        }

        // Camera focus
        if (rule.focus) {
          plugin.managers.camera.focusLoci(
            Structure.toStructureElementLoci(component.obj.data),
          );
        }
      }
    }

    // ------------------------------------------------------------------
    // Camera position — placed last so the structure is fully loaded and
    // the canvas is guaranteed to be initialised before we move the camera.
    // ------------------------------------------------------------------
    if (settings.camera_json) {
      try {
        const camState = JSON.parse(settings.camera_json as string);
        plugin.canvas3d?.camera.setState(camState);
        plugin.canvas3d?.requestDraw();
      } catch (e) {
        console.warn('NativeBuilder: invalid camera_json, skipped', e);
      }
    }
  },

  // -------------------------------------------------------------------------
  // Simple-mode MolScript expression builder
  // -------------------------------------------------------------------------
  buildSimpleExpression(rule: CustomRule) {
    const prefix = rule.scheme === 'label' ? 'label' : 'auth';
    const tests: any = {};

    if (rule.chain) {
      tests['chain-test'] = MS.core.rel.eq([
        MS.ammp(`${prefix}_asym_id` as any),
        rule.chain,
      ]);
    }

    const resTests: any[] = [];

    if (rule.ranges) {
      for (const part of rule.ranges.split(',')) {
        const [start, end] = part.split('-').map(x => parseInt(x.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          resTests.push(MS.core.rel.inRange([
            MS.ammp(`${prefix}_seq_id` as any),
            start,
            end,
          ]));
        }
      }
    }

    if (rule.specific) {
      const nums = rule.specific.split(',')
        .map(x => parseInt(x.trim()))
        .filter(x => !isNaN(x));
      if (nums.length > 0) {
        resTests.push(MS.core.set.has([
          MS.set(...nums),
          MS.ammp(`${prefix}_seq_id` as any),
        ]));
      }
    }

    if (resTests.length > 0) {
      tests['residue-test'] = resTests.length === 1
        ? resTests[0]
        : MS.core.logic.or(resTests);
    }

    const atomTests: any[] = [];

    if (rule.atomName) {
      atomTests.push(MS.core.rel.eq([
        MS.ammp(`${prefix}_atom_id` as any),
        rule.atomName,
      ]));
    }

    if (rule.element) {
      atomTests.push(MS.core.rel.eq([
        MS.ammp('type_symbol' as any),
        rule.element,
      ]));
    }

    if (rule.atomIndex) {
      const idxs = rule.atomIndex.split(',')
        .map(x => parseInt(x.trim()))
        .filter(x => !isNaN(x));
      if (idxs.length > 0) {
        atomTests.push(MS.core.set.has([MS.set(...idxs), MS.ammp('id')]));
      }
    }

    if (atomTests.length > 0) {
      tests['atom-test'] = atomTests.length === 1
        ? atomTests[0]
        : MS.core.logic.or(atomTests);
    }

    return Object.keys(tests).length > 0
      ? MS.struct.generator.atomGroups(tests)
      : MS.struct.generator.all();
  },

  // -------------------------------------------------------------------------
  // Expert-mode MolScript expression builder
  // -------------------------------------------------------------------------
  buildExpertExpression(selector: any) {
    const queries = (Array.isArray(selector) ? selector : [selector]).map(sel => {
      const tests: any    = {};
      const chainT: any[] = [];
      const resT: any[]   = [];

      if (sel.auth_asym_id)  chainT.push(MS.core.rel.eq([MS.ammp('auth_asym_id'),  sel.auth_asym_id]));
      if (sel.label_asym_id) chainT.push(MS.core.rel.eq([MS.ammp('label_asym_id'), sel.label_asym_id]));

      if (sel.auth_seq_id !== undefined) {
        resT.push(MS.core.rel.eq([MS.ammp('auth_seq_id'), sel.auth_seq_id]));
      }
      if (sel.beg_auth_seq_id !== undefined && sel.end_auth_seq_id !== undefined) {
        resT.push(MS.core.rel.inRange([
          MS.ammp('auth_seq_id'),
          sel.beg_auth_seq_id,
          sel.end_auth_seq_id,
        ]));
      }

      if (chainT.length > 0) tests['chain-test']   = MS.core.logic.and(chainT);
      if (resT.length   > 0) tests['residue-test'] = MS.core.logic.and(resT);

      return MS.struct.generator.atomGroups(tests);
    });

    return queries.length === 1
      ? queries[0]
      : MS.struct.modifier.union(queries);
  },

  // -------------------------------------------------------------------------
  // Apply a global-target representation
  // -------------------------------------------------------------------------


  // -------------------------------------------------------------------------
  // Apply a custom-rule representation
  // -------------------------------------------------------------------------
async applyCustomRuleRepresentation(
    plugin: PluginContext,
    component: any,
    rule: CustomRule,
  ): Promise<void> {
    const REP_MAP: Record<string, string> = {
      'ball_and_stick': 'ball-and-stick',
      'molecular_surface': 'molecular-surface',
      'gaussian_surface': 'gaussian-surface'
    };

    let nativeRepType = REP_MAP[rule.rep] || rule.rep;
    if (rule.rep === 'highlight') nativeRepType = 'ball-and-stick';

    const themeName   = rule.colorType === 'theme' ? rule.colorVal : 'uniform';
    const colorParams = rule.colorType === 'theme'
      ? undefined
      : { value: Color.fromHexStyle(rule.colorVal || '#ffffff') };

    const typeParams: any = {};
    let sizeThemeName: string | undefined = undefined;
    let sizeParams: any = undefined;

    // Smart Size Application
    if (rule.size) {
      const parsedSize = parseFloat(rule.size);
      if (nativeRepType === 'gaussian-surface') {
        sizeThemeName = 'uniform';
        sizeParams = { value: parsedSize };
      } else {
        typeParams.sizeFactor = parsedSize;
      }
    }

    if (rule.alpha) {
      typeParams.alpha = parseFloat(rule.alpha);
    }
    if (rule.quality && rule.quality !== 'auto') {
      typeParams.quality = rule.quality;
    }

    await plugin.builders.structure.representation.addRepresentation(
      component,
      {
        type: nativeRepType as any,
        typeParams,
        color: themeName as any,
        colorParams,
        size: sizeThemeName as any,
        sizeParams
      },
    );
  },

  // -------------------------------------------------------------------------
  // 3D label — uses the same API as Measurements › Add › Label.
  // Hover tooltip is handled separately via the lociLabels provider above.
  // -------------------------------------------------------------------------
  async apply3DLabel(
    plugin: PluginContext,
    component: any,
    rule: CustomRule,
  ): Promise<void> {
    const structure = component.obj?.data;
    if (!structure) return;

    const subLoci  = Structure.toStructureElementLoci(structure);
    const rootLoci = StructureElement.Loci.remap(subLoci, structure.root);

    await plugin.managers.structure.measurement.addLabel(rootLoci, {
      visualParams: {
        customText:  rule.label,
        sizeFactor:  rule.labelSize        ? parseFloat(rule.labelSize)                : 1,
        textColor:   Color.fromHexStyle(String(rule.labelTextColor  || '#ffffff')),
        tooltip:     rule.tooltip ?? '',
        borderWidth: rule.labelBorderWidth ? parseFloat(String(rule.labelBorderWidth)) : 0.2,
        borderColor: Color.fromHexStyle(String(rule.labelBorderColor || '#000000')),
        background:  false,
      },
    });
  },
};
