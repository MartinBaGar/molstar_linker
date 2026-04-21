// src/permissions.ts
 
/// <reference types="chrome" />
 
// Tell TypeScript that 'browser' might exist in the global scope (for Firefox)
declare const browser: typeof chrome;

export const PermissionsManager = {
  // We cast to 'typeof chrome' so your editor gives you perfect autocomplete for extension APIs
  core: (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome,

  cleanDomain: function(url: string): string {
    try {
      const parsed = new URL(url.includes('://') ? url : `https://${url}`);
      return parsed.hostname;
    } catch (e) { 
      return url.replace(/^https?:\/\//, '').replace(/\/.*$/, ''); 
    }
  },

  getMatchPattern: function(domain: string): string { 
    return `*://${this.cleanDomain(domain)}/*`; 
  },
  
  getScriptId: function(domain: string): string { 
    return `ms-script-${this.cleanDomain(domain).replace(/\./g, '-')}`; 
  },

  requestAndRegister: async function(url: string): Promise<boolean> {
    const domain = this.cleanDomain(url);
    const pattern = this.getMatchPattern(domain);
    const id = this.getScriptId(domain);

    try {
      const granted = await new Promise<boolean>(resolve => {
        this.core.permissions.request({ origins: [pattern] }, resolve);
      });
      
      if (!granted) return false;

      const existing = await this.core.scripting.getRegisteredContentScripts({ ids: [id] });
      if (existing.length === 0) {
        await this.core.scripting.registerContentScripts([{
          id: id,
          matches: [pattern],
          js: ["config.js", "mvs-builder.js", "content.js"],
          runAt: "document_end"
        }]);
      }

      const data = await this.core.storage.sync.get({ customDomains: [] }) as { customDomains: string[] };
      
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

  revokeAndUnregister: async function(url: string): Promise<boolean> {
    const domain = this.cleanDomain(url);
    const pattern = this.getMatchPattern(domain);
    const id = this.getScriptId(domain);

    try {
      await this.core.scripting.unregisterContentScripts({ ids: [id] }).catch(() => {});
      await new Promise<boolean>(resolve => this.core.permissions.remove({ origins: [pattern] }, resolve));
      
      const data = await this.core.storage.sync.get({ customDomains: [] }) as { customDomains: string[] };
      const newDomains = data.customDomains.filter((d: string) => d !== domain);
      await this.core.storage.sync.set({ customDomains: newDomains });
      return true;
    } catch (e) { 
      return false; 
    }
  }
};
