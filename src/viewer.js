// viewer.js

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const rawUrl = urlParams.get('fileUrl');
    const format = urlParams.get('format');
    const loadingDiv = document.getElementById('loading');

    if (!rawUrl) {
        loadingDiv.innerText = 'Error: No structure URL provided.';
        return;
    }

    try {
        // 1. Fetch file using Extension Privileges (Bypasses CORS natively)
        const response = await fetch(rawUrl);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const blob = await response.blob();

        // 2. Convert Blob to Base64 Data URI to pass safely through the sandbox wall
        const dataUri = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });

        // 3. Retrieve settings and inject the Sandbox
        chrome.storage.sync.get(null, (storedSettings) => {
            const finalSettings = { ...AppConfig.getDefaults(), ...storedSettings };
            
            loadingDiv.remove();
            
            const iframe = document.createElement('iframe');
            iframe.src = 'sandbox.html';
            iframe.allow = 'xr-spatial-tracking';
            iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
            
            iframe.onload = () => {
                iframe.contentWindow.postMessage({
                    action: 'INIT_MOLSTAR',
                    url: dataUri, 
                    format: format,
                    settings: finalSettings 
                }, '*');
            };
            
            document.body.appendChild(iframe);
        });

    } catch (error) {
        console.error("Workspace Fetch Error:", error);
        loadingDiv.innerText = `Failed to download file: ${error.message}`;
    }
});
