// config.js

const AppConfig = {
  RepSchema: {
    cartoon: { label: "Cartoon", params: { tubular_helices: 'boolean' } },
    backbone: { label: "Backbone", params: {} },
    ball_and_stick: { label: "Ball & Stick", params: { ignore_hydrogens: 'boolean' } },
    line: { label: "Line", params: { ignore_hydrogens: 'boolean' } },
    spacefill: { label: "Spacefill", params: { ignore_hydrogens: 'boolean' } },
    carbohydrate: { label: "Carbohydrate", params: {} },
    putty: { label: "Putty", params: { size_theme: ['uniform', 'uncertainty'] } },
    surface: { label: "Surface", params: { surface_type: ['molecular', 'gaussian'], ignore_hydrogens: 'boolean' } },
    off: { label: "Hide / Off", params: {} }
  },

  targets: [
    { id: "protein", selector: "protein", label: "Proteins", rep: "cartoon", color: "chain-id", size: null },
    { id: "nucleic", selector: "nucleic", label: "Nucleic Acids (DNA/RNA)", rep: "cartoon", color: "chain-id", size: null },
    { id: "ligand", selector: "ligand", label: "Ligands & Small Molecules", rep: "ball_and_stick", color: "element-symbol", size: 2.5 },
    { id: "carbs", selector: "branched", label: "Carbohydrates & Glycans", rep: "ball_and_stick", color: "element-symbol", size: 2.5 },
    { id: "ion", selector: "ion", label: "Single Ions", rep: "ball_and_stick", color: "element-symbol", size: 3.0 },
    { id: "water", selector: "water", label: "Water / Solvent", rep: "off", color: "red", size: null }
  ],

  presets: {
    "standard": { name: "Standard Mol* (Smart Guess)", settings: {} },
    "surface_focus": {
      name: "Protein Surface + Spacefill Ligands",
      settings: {
        "protein_rep": "surface", "protein_colorType": "theme", "protein_colorVal": "chain-id",
        "nucleic_rep": "surface", "nucleic_colorType": "theme", "nucleic_colorVal": "chain-id",
        "ligand_rep": "spacefill", "ligand_colorType": "theme", "ligand_colorVal": "element-symbol",
        "water_rep": "off",
        "canvas_color": "#ffffff"
      }
    },
    "dark_mode": {
      name: "Dark Mode Canvas",
      settings: { "canvas_color": "#111111" }
    }
  },

  getDefaults: function() {
    const defaults = {
      canvas_color: "#ffffff",
      camera_json: ""
    };
    this.targets.forEach(t => {
      defaults[`${t.id}_rep`] = t.rep;
      defaults[`${t.id}_colorType`] = ['chain-id', 'element-symbol', 'secondary-structure'].includes(t.color) ? 'theme' : 'solid';
      defaults[`${t.id}_colorVal`] = t.color;
      if (t.size) defaults[`${t.id}_size`] = t.size;
    });
    defaults.customRules = []; 
    return defaults;
  }
};
