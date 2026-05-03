// src/permissions.ts

/// <reference types="chrome" />

declare const browser: typeof chrome;

export const PermissionsManager = {

  // Pick the right API object at runtime (Firefox uses `browser`, Chrome uses `chrome`)
  core: (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome,

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  cleanDomain(url: string): string {
    try {
      const parsed = new URL(url.includes('://') ? url : `https://${url}`);
      return parsed.hostname;
    } catch {
      return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    }
  },

  getMatchPattern(domain: string): string {
    return `*://${this.cleanDomain(domain)}/*`;
  },

  getScriptId(domain: string): string {
    return `ms-script-${this.cleanDomain(domain).replace(/\./g, '-')}`;
  },

  // ------------------------------------------------------------------
  // requestAndRegister
  //
  // IMPORTANT (Firefox): We must call permissions.request() IMMEDIATELY
  // inside a user-gesture handler. Any `await` before this call kills the
  // user-gesture context and the permission dialog will be silently blocked.
  // ------------------------------------------------------------------
  async requestAndRegister(url: string): Promise<boolean> {
    const domain  = this.cleanDomain(url);
    const pattern = this.getMatchPattern(domain);
    const id      = this.getScriptId(domain);

    try {
      // ① Request permission synchronously within the user gesture
      const granted = await new Promise<boolean>(resolve => {
        this.core.permissions.request({ origins: [pattern] }, resolve);
      });

      if (!granted) return false;

      // ② Register the content script if not already registered
      if (this.core.scripting?.registerContentScripts) {
  const existing = await this.core.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing.length === 0) {
    await this.core.scripting.registerContentScripts([{
      id, matches: [pattern], js: ['content.js'], runAt: 'document_end',
    }]);
  }
}

      // ③ Persist the domain in storage so the UI can show it
      const data = await this.core.storage.sync.get({ customDomains: [] }) as { customDomains: string[] };
      if (!data.customDomains.includes(domain)) {
        data.customDomains.push(domain);
        await this.core.storage.sync.set({ customDomains: data.customDomains });
      }

      return true;
    } catch (err) {
      console.error('Molstar Linker — permission error:', err);
      return false;
    }
  },

  // ------------------------------------------------------------------
  // revokeAndUnregister
  // ------------------------------------------------------------------
  async revokeAndUnregister(url: string): Promise<boolean> {
    const domain  = this.cleanDomain(url);
    const pattern = this.getMatchPattern(domain);
    const id      = this.getScriptId(domain);

    try {
        await this.core.scripting?.unregisterContentScripts({ ids: [id] }).catch(() => {});
      await new Promise<boolean>(resolve => this.core.permissions.remove({ origins: [pattern] }, resolve));

      const data = await this.core.storage.sync.get({ customDomains: [] }) as { customDomains: string[] };
      await this.core.storage.sync.set({
        customDomains: data.customDomains.filter(d => d !== domain),
      });

      return true;
    } catch {
      return false;
    }
  },
};
