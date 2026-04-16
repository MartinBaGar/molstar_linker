// sandbox.js

window.addEventListener('message', async (event) => {
    if (event.data && event.data.action === 'INIT_MOLSTAR') {
        const { url, format, settings } = event.data;

        try {
            const viewerInstance = await molstar.Viewer.create('app', {
                layoutIsExpanded: true,
                layoutShowControls: true,
                layoutShowRemoteState: false,
                layoutShowSequence: true,
                layoutShowLog: true,
                layoutShowLeftPanel: true,
            });

            const mvsTemplate = MvsBuilder._buildBaseTemplate(url, format, settings);
            const mvsDataString = JSON.stringify(mvsTemplate);

            if (typeof viewerInstance.loadMvsData === 'function') {
                await viewerInstance.loadMvsData(mvsDataString, 'mvsj');
            } else {
                const mvsData = molstar.PluginExtensions.mvs.MVSData.fromMVSJ(mvsDataString);
                await molstar.PluginExtensions.mvs.loadMVS(viewerInstance.plugin, mvsData, { replaceExisting: true });
            }
            
        } catch (err) {
            console.error("Failed to load MVS data into Mol*", err);
        }
    }
});
