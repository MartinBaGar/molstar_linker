// sandbox.js

window.parent.postMessage({ action: 'SANDBOX_READY' }, '*');

let viewerInstance = null; // Store the viewer globally

window.addEventListener('message', async (event) => {
    // SECURITY FIX 1 (Kept): Validate the sender's origin before doing anything.
    if (!event.origin.startsWith('chrome-extension://') && !event.origin.startsWith('moz-extension://')) {
        console.warn('Mol* Sandbox: Rejected message from untrusted origin:', event.origin);
        return;
    }

    if (event.data && event.data.action === 'INIT_MOLSTAR') {
        const { url, format, settings, originalUrl } = event.data;

        // SECURITY FIX 2 (Updated): Validate the URL scheme. Allow 'null' for empty sessions!
        if (url !== null && (typeof url !== 'string' || !url.startsWith('data:'))) {
            console.error('Mol* Sandbox: Rejected non-data URL');
            return;
        }

        // SECURITY FIX 3 (Updated): Validate format. Allow 'null' for empty sessions!
        const ALLOWED_FORMATS = new Set(['pdb', 'mmcif', 'cif', 'gro', 'mol', 'mol2', 'sdf', 'xyz', 'bcif']);
        if (url !== null && (typeof format !== 'string' || !ALLOWED_FORMATS.has(format))) {
            console.error('Mol* Sandbox: Rejected unknown format:', format);
            return;
        }

        try {
            // ALWAYS initialize the 3D Viewer first (whether we have a file or not)
            if (!viewerInstance) {
                viewerInstance = await molstar.Viewer.create('app', {
                    layoutIsExpanded: true,
                    layoutShowControls: true,
                    layoutShowRemoteState: false,
                    layoutShowSequence: true,
                    layoutShowLog: true,
                    layoutShowLeftPanel: true,
                });
            }

            // If url is null, the user just wants an empty studio. We are done!
            if (url === null) {
                console.log("Mol* Sandbox: Opened empty session successfully.");
                return; 
            }

            // --- THE ANTI-LAG FIX (Kept from your code) ---
            // 1. Fetch the massive Base64 string locally to turn it back into a binary Blob
            const response = await fetch(url);
            const blob = await response.blob();
            
            // 2. Create a short, local Blob URL (e.g., blob:null/1234-5678)
            let shortBlobUrl = URL.createObjectURL(blob);

            // 3. Extract the real filename and append it as a hash fragment.
            if (originalUrl) {
                try {
                    const filename = new URL(originalUrl).pathname.split('/').pop();
                    if (filename) shortBlobUrl += `#${filename}`;
                } catch (e) {}
            }

            // Load the structure using MVS
            const mvsTemplate = MvsBuilder._buildBaseTemplate(shortBlobUrl, format, settings);
            const mvsDataString = JSON.stringify(mvsTemplate);

            if (typeof viewerInstance.loadMvsData === 'function') {
                await viewerInstance.loadMvsData(mvsDataString, 'mvsj');
            } else {
                const mvsData = molstar.PluginExtensions.mvs.MVSData.fromMVSJ(mvsDataString);
                await molstar.PluginExtensions.mvs.loadMVS(viewerInstance.plugin, mvsData, { replaceExisting: true });
            }

        } catch (err) {
            console.error("Failed to load data into Mol* Sandbox", err);
        }
    }
});
