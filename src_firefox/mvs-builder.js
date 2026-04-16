// mvs-builder.js

const MvsBuilder = {
  createViewerUrl: function(rawStructureUrl, format, settings) {
    const parserFormat = format === 'cif' ? 'mmcif' : format;
    const mvsTemplate = this._buildBaseTemplate(rawStructureUrl, parserFormat, settings);
    const mvsDataString = JSON.stringify(mvsTemplate);
    return `https://molstar.org/viewer/?mvs-format=mvsj&mvs-data=${encodeURIComponent(mvsDataString)}`;
  },

  _buildBaseTemplate: function(url, format, settings) {
    // Build the core structure tree
    const rootChildren = [
      {
        "kind": "download",
        "params": { "url": url },
        "children": [{
          "kind": "parse",
          "params": { "format": format },
          "children": [{
            "kind": "structure",
            "params": { "type": "model" },
            "children": this._buildComponentBranches(settings)
          }]
        }]
      }
    ];

    // Inject Canvas Background
    if (settings.canvas_color && settings.canvas_color !== "#ffffff" && settings.canvas_color !== "white") {
      rootChildren.push({ "kind": "canvas", "params": { "background_color": settings.canvas_color } });
    }

    // Inject Custom Camera
    if (settings.camera_json) {
      try {
        const camParams = JSON.parse(settings.camera_json);
        rootChildren.push({ "kind": "camera", "params": camParams });
      } catch (e) { console.warn("Invalid Camera JSON"); }
    }

    return { "metadata": { "version": "1" }, "root": { "kind": "root", "children": rootChildren } };
  },

  _getColorNode: function(colorType, colorVal) {
    if (colorType === 'theme') {
      return { "kind": "color", "params": { "color": "white" }, "custom": { "molstar_color_theme_name": colorVal } };
    }
    return { "kind": "color", "params": { "color": colorVal } };
  },

  _buildComponentBranches: function(settings) {
    const branches = [];
    const polymerColorOverrides = []; 
    const customComponentBranches = []; 

    const customRules = settings.customRules || [];
    
    // PASS 1: Custom Rules
    customRules.forEach(rule => {
      const componentChildren = [];
      
      // Inject Storytelling Nodes (Labels, Tooltips, Focus)
      if (rule.label) componentChildren.push({ "kind": "label", "params": { "text": rule.label } });
      if (rule.tooltip) componentChildren.push({ "kind": "tooltip", "params": { "text": rule.tooltip } });
      if (rule.focus) componentChildren.push({ "kind": "focus", "params": {} }); // Empty params use defaults to auto-zoom!

      const ruleType = rule.rep || "highlight"; 
      if (ruleType === "highlight") {
        const colorNode = this._getColorNode(rule.colorType, rule.colorVal);
        colorNode.params.selector = rule.selector; 
        polymerColorOverrides.push(colorNode);
        
        // If it's a highlight, it still needs its own component to hold the tooltips/labels
        if (componentChildren.length > 0) {
           customComponentBranches.push({ "kind": "component", "params": { "selector": rule.selector }, "children": componentChildren });
        }
      } else {
        const repParams = { "type": ruleType };
        if (rule.size && !isNaN(parseFloat(rule.size))) repParams.size_factor = parseFloat(rule.size);
        if (rule.subParams) Object.assign(repParams, rule.subParams);
        if (rule.advancedParams) Object.assign(repParams, rule.advancedParams);

        // Build the representation node and its color/opacity children
        const repChildren = [ this._getColorNode(rule.colorType, rule.colorVal) ];
        if (rule.opacity && !isNaN(parseFloat(rule.opacity))) {
          repChildren.push({ "kind": "opacity", "params": { "opacity": parseFloat(rule.opacity) } });
        }

        componentChildren.push({ "kind": "representation", "params": repParams, "children": repChildren });
        customComponentBranches.push({ "kind": "component", "params": { "selector": rule.selector }, "children": componentChildren });
      }
    });

    // PASS 2: Global Targets
    AppConfig.targets.forEach(target => {
      const repType = settings[`${target.id}_rep`];
      if (!repType || repType === "off") return;

      const sizeVal = settings[`${target.id}_size`];
      const repParams = { "type": repType };
      if (sizeVal !== undefined && sizeVal !== "") repParams.size_factor = parseFloat(sizeVal);
      
      const targetSubParams = settings[`${target.id}_subParams`];
      if (targetSubParams) Object.assign(repParams, targetSubParams);

      const repChildren = [ this._getColorNode(settings[`${target.id}_colorType`], settings[`${target.id}_colorVal`]) ];
      const opacityVal = settings[`${target.id}_opacity`];
      if (opacityVal && !isNaN(parseFloat(opacityVal))) {
        repChildren.push({ "kind": "opacity", "params": { "opacity": parseFloat(opacityVal) } });
      }

      const representationNode = { "kind": "representation", "params": repParams, "children": repChildren };

      if (['protein', 'nucleic'].includes(target.selector)) {
        representationNode.children.push(...polymerColorOverrides);
      }

      branches.push({ "kind": "component", "params": { "selector": target.selector }, "children": [representationNode] });
    });

    branches.push(...customComponentBranches);
    return branches;
  }
};
