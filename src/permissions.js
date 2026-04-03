// permissions.js
const PermissionsManager = {
  core: typeof browser !== 'undefined' ? browser : chrome,

  cleanDomain: function(url) {
    try {
      const parsed = new URL(url.includes('://') ? url : `https://${url}`);
      return parsed.hostname;
    } catch (e) { return url.replace(/^https?:\/\//, '').replace(/\/.*$/, ''); }
  },

  getMatchPattern: function(domain) { return `*://${this.cleanDomain(domain)}/*`; },
  getScriptId: function(domain) { return `ms-script-${this.cleanDomain(domain).replace(/\./g, '-')}`; },

  requestAndRegister: async function(url) {
    const domain = this.cleanDomain(url);
    const pattern = this.getMatchPattern(domain);
    const id = this.getScriptId(domain);

    try {
      // FIREFOX FIX: We must request the permission IMMEDIATELY upon the user's click.
      // If we 'await' anything else first, Firefox kills the user gesture.
      const granted = await new Promise(resolve => {
        this.core.permissions.request({ origins: [pattern] }, resolve);
      });
      
      if (!granted) return false;

      // Now that we have permission, we can safely do the rest
      const existing = await this.core.scripting.getRegisteredContentScripts({ ids: [id] });
      if (existing.length === 0) {
        await this.core.scripting.registerContentScripts([{
          id: id,
          matches: [pattern],
          js: ["config.js", "mvs-builder.js", "content.js"],
          runAt: "document_end"
        }]);
      }

      const data = await this.core.storage.sync.get({ customDomains: [] });
      if (!data.customDomains.includes(domain)) {
        data.customDomains.push(domain);
        await this.core.storage.sync.set({ customDomains: data.customDomains });
      }
      return true;
    } catch(e) {
      console.error("Molstar Linker Permission Error:", e);
      return false;
    }
  },

  revokeAndUnregister: async function(url) {
    const domain = this.cleanDomain(url);
    const pattern = this.getMatchPattern(domain);
    const id = this.getScriptId(domain);

    try {
      await this.core.scripting.unregisterContentScripts({ ids: [id] }).catch(() => {});
      await new Promise(resolve => this.core.permissions.remove({ origins: [pattern] }, resolve));
      
      const data = await this.core.storage.sync.get({ customDomains: [] });
      const newDomains = data.customDomains.filter(d => d !== domain);
      await this.core.storage.sync.set({ customDomains: newDomains });
      return true;
    } catch (e) { return false; }
  }
};
