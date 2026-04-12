+++
title = "Mol* Linker"
author = ["Martin Bari Garnier"]
draft = false
+++

<iframe
  src="https://molstar.org/viewer/?snapshot-url=https://martinbagar.github.io/Molstar_Linker/models/welcome.molx&snapshot-url-type=molx&hide-controls=1"
  width="100%"
  height="400px"
  style="border: none; border-radius: 8px; margin-top: 2rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
</iframe>

Mol\* Linker is a browser extension for Chrome and Firefox that automatically detects molecular structure file links on GitHub and GitLab, and injects a one-click badge to open them in the [Mol\* web viewer](https://molstar.org/viewer/) — pre-configured with your preferred representation style.

No downloads. No local software. Click a badge, see your structure in 3D.


## Features {#features}

-   Badge injection on GitHub &amp; GitLab file browsers and directory trees
-   Full scene builder: per-molecule representation, color, opacity controls
-   Custom highlighting rules for chains, residues, or any selection
-   Named template library — save, share, and import JSON configurations
-   Works on private / self-hosted GitLab instances
-   Handles SPA navigation (no page reload required)


## Supported Formats {#supported-formats}

`.pdb`, `.cif`, `.mmcif`, `.bcif`, `.gro`, `.mol`, `.mol2`, `.sdf`, `.xyz`, `.ent`


## Install {#install}

| Browser | Link                    |
|---------|-------------------------|
| Chrome  | Chrome Web Store (link) |
| Firefox | Firefox Add-ons (link)  |

Or clone [the repository](https://github.com/MartinBaGar/molstar_linker) and load it as an unpacked extension.
