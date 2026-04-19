+++
title = "Architecture & Execution Flow"
author = ["Martin Bari Garnier"]
draft = false
+++

## Core Philosophy {#core-philosophy}

The Mol\* Linker extension operates across complex security boundaries. Modern browsers enforce strict Content Security Policies (CSP), specifically blocking `unsafe-eval` in Manifest V3 (Chrome) and restricting cross-origin requests (CORS).

To seamlessly load multi-megabyte structural files from dynamic Single Page Applications (SPAs) like GitLab/GitHub into a high-performance WebGL visualizer (Mol\*), the extension utilizes a robust **4-Layer Architecture**.


## The 4-Layer Architecture {#the-4-layer-architecture}


### 1. Reconnaissance (The Content Script) {#1-dot-reconnaissance--the-content-script}

-   **File:** `src/content.js`
-   **Environment:** Host Webpage (e.g., GitHub, GitLab, RCSB)
-   **Role:** Scans the DOM for supported structural file extensions (`.pdb`, `.cif`, `.gro`, etc.). It uses smart heuristics to ignore Git UI elements (like `/blame/` or `/commits/`) and anchor jumps (`#L10`).
-   **Action:** Injects a native HTML `<button>` next to valid links. Clicking this button stops event propagation (preventing SPA routers from navigating away) and sends a message to the background router.


### 2. The Router (The Background Script) {#2-dot-the-router--the-background-script}

-   **File:** `src/background.js`
-   **Environment:** Extension Service Worker (Chrome) / Event Page (Firefox)
-   **Role:** Acts as a traffic cop. It listens for the `open_viewer` message from the Content Script.
-   **Action:** Opens a new, isolated extension tab pointing to `viewer.html`, passing the target file URL and format via URL search parameters.


### 3. The Privileged Shell (The Viewer) {#3-dot-the-privileged-shell--the-viewer}

-   **Files:** `src/viewer.html`, `src/viewer.js`
-   **Environment:** Extension Context (`chrome-extension://...`)
-   **Role:** This layer operates with elevated privileges and acts as the ****Master Router**** and ****Security Gatekeeper****.
-   **Actions:**
    1.  ****Routing:**** It checks the incoming parameters to determine if it should load a Local File (via Extension Storage), a Blob URL (via Options Drag &amp; Drop), a Web URL, or an Empty Workspace.
    2.  ****Gatekeeping:**** If a remote URL is requested via Right-Click, it checks if the domain is authorized. If not, it halts execution and prompts the user to grant Host Permissions.
    3.  ****CORS Bypass &amp; Fetch:**** For authorized domains, it uses native `fetch()` to securely bypass browser CORS restrictions. It also reads the first 150 characters of the downloaded Blob to ensure it wasn't silently blocked by Firefox's Enhanced Tracking Protection (ETP).
    4.  ****Strict Injection:**** It dynamically spawns an `<iframe>` pointing to the Sandbox. To satisfy modern browser specs, it uses a strict `e.source ==` iframe.contentWindow= handshake to securely pass the Base64 structure data into the sandboxed `null` origin via `postMessage('*')`.


### 4. The Engine (The Sandbox) {#4-dot-the-engine--the-sandbox}

-   **Files:** `src/sandbox.html`, `src/sandbox.js`, `src/mvs-builder.js`
-   **Environment:** Isolated Sandbox (`Origin: null`)
-   **Role:** Mol\* relies heavily on `new Function()` and `eval()` to compile dynamic WebGL shaders. Standard Manifest V3 extension pages block this. The Sandbox is explicitly declared in the manifest to allow `unsafe-eval`.
-   **Action:** Receives the Base64 data, translates the user settings into a MolViewSpec (MVS) JSON tree via `MvsBuilder`, and renders the 3D scene securely.


## Cross-Browser Compatibility (Manifest Split) {#cross-browser-compatibility--manifest-split}

Google Chrome (Manifest V3) and Mozilla Firefox (Manifest V2) have fundamentally incompatible security standards regarding background workers and sandboxing.

To maintain a single, universal JavaScript codebase, the architecture utilizes a dual-manifest build system:

-   **Chrome (\*=manifests/chrome.json=**):\* Utilizes `service_worker` and strictly relies on the `sandbox` manifest key to escape the V3 `unsafe-eval` ban.
-   **Firefox (\*=manifests/firefox.json=**):\* Utilizes V2 `scripts` (Event Pages) and relies on a permissive `content_security_policy` to allow `unsafe-eval`, as Firefox natively strips sandbox permissions.
