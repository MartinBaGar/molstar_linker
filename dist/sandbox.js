// src/sandbox.ts
import { MvsBuilder } from './mvs-builder.js';
window.addEventListener('message', async (event) => {
    const { type, dataUri, format, sourceUrl, settings } = event.data;
    if (type === 'load-structure') {
        try {
            const viewer = await molstar.Viewer.create('viewer-root', {
                layoutIsExpanded: false,
                layoutShowControls: false,
                layoutShowRemoteState: false,
                layoutShowSequence: true,
                layoutShowLog: false,
                viewportShowExpand: true,
                viewportShowSelectionMode: false,
                viewportShowAnimation: false,
            });
            // Use our migrated MvsBuilder to create the MolViewSpec
            const mvsData = MvsBuilder._buildBaseTemplate(dataUri, format === 'cif' ? 'mmcif' : format, settings);
            // Load into Mol* engine
            await molstar.PluginExtensions.mvs.loadMvs(viewer.plugin, mvsData, {
                sourceUrl: sourceUrl
            });
        }
        catch (err) {
            console.error('Sandbox Render Error:', err);
        }
    }
});
// Signal to the viewer that the engine is ready
window.parent.postMessage({ type: 'sandbox-ready' }, '*');
