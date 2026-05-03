// src/sandbox.ts
import { NativeBuilder } from './native-builder.js';
import type { InitMolstarMessage } from './types.js';

declare const molstar: any; // Using any for simplicity during rewrite

window.parent.postMessage({ action: 'SANDBOX_READY' }, '*');

let viewerInstance: any = null;

(window.history as any).replaceState = () => {};
(window.history as any).pushState    = () => {};

if ('xr' in navigator) {
  Object.defineProperty(navigator, 'xr', { value: undefined, configurable: true });
}

window.addEventListener('message', async (event: MessageEvent<InitMolstarMessage>) => {
  const msg = event.data;
  if (!msg || msg.action !== 'INIT_MOLSTAR') return;

  const { url, format, settings, originalUrl } = msg;

  try {
    if (!viewerInstance) {
      viewerInstance = await molstar.Viewer.create('app', {
        layoutIsExpanded:    false,
        layoutShowControls:  false,
        layoutShowRemoteState: false,
        layoutShowSequence:  true,
        layoutShowLog:       true,
        layoutShowLeftPanel: true,
      });
    }

    if (url === null) return; // Empty workspace

    // Anti-lag fix: convert base64 to blob URL
    const response = await fetch(url);
    const blob = await response.blob();
    let shortBlobUrl = URL.createObjectURL(blob);

    if (originalUrl) {
      try {
        const filename = new URL(originalUrl).pathname.split('/').pop();
        if (filename) shortBlobUrl += `#${filename}`;
      } catch {}
    }

    // --- NEW LOGIC: Call the Native Builder instead of MVS ---
    await NativeBuilder.buildNativeScene(
      viewerInstance.plugin, 
      shortBlobUrl, 
      format!, 
      settings
    );

  } catch (err) {
    console.error('Mol* Sandbox: failed to load structure natively', err);
  }
});
