import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { SyncEngine, type SyncSettings } from "./src/sync-engine.js";

export type ObsyncSettings = SyncSettings & {
  serverUrl: string;
  vaultId: string;
  authMode: "jwt" | "apiKey";
  authToken: string;
};

const DEFAULT_SETTINGS: ObsyncSettings = {
  serverUrl: "http://localhost:3000",
  vaultId: "vault-1",
  authMode: "jwt",
  authToken: "",
  heartbeatIntervalMs: 5000,
  debounceMs: 30000
};

export default class ObsyncPlugin extends Plugin {
  settings: ObsyncSettings;
  engine?: SyncEngine;

  async onload() {
    await this.loadSettings();

    this.engine = new SyncEngine(this.app, this.settings, {
      onStatus: (message) => new Notice(message)
    });

    this.engine.start();
    this.registerEditorExtension(this.engine.getEditorExtension());

    this.addSettingTab(new ObsyncSettingTab(this.app, this));
  }

  onunload() {
    this.engine?.stop();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.engine?.updateSettings(this.settings);
  }
}

class ObsyncSettingTab extends PluginSettingTab {
  plugin: ObsyncPlugin;

  constructor(app: App, plugin: ObsyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Obsync Settings" });

    new Setting(containerEl)
      .setName("Server URL")
      .setDesc("Base URL for the Obsync backend.")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:3000")
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Vault ID")
      .setDesc("Vault identifier used by the server.")
      .addText((text) =>
        text
          .setPlaceholder("vault-1")
          .setValue(this.plugin.settings.vaultId)
          .onChange(async (value) => {
            this.plugin.settings.vaultId = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Auth Mode")
      .setDesc("Use JWT or API key authentication.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("jwt", "JWT")
          .addOption("apiKey", "API Key")
          .setValue(this.plugin.settings.authMode)
          .onChange(async (value) => {
            this.plugin.settings.authMode = value as "jwt" | "apiKey";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Auth Token")
      .setDesc("JWT or API key string.")
      .addTextArea((text) =>
        text
          .setPlaceholder("Paste JWT or API key")
          .setValue(this.plugin.settings.authToken)
          .onChange(async (value) => {
            this.plugin.settings.authToken = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Heartbeat Interval (ms)")
      .setDesc("How often to send presence heartbeats.")
      .addText((text) =>
        text
          .setPlaceholder("5000")
          .setValue(String(this.plugin.settings.heartbeatIntervalMs))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (!Number.isNaN(parsed) && parsed > 0) {
              this.plugin.settings.heartbeatIntervalMs = parsed;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Debounce (ms)")
      .setDesc("Delay before uploading file snapshots.")
      .addText((text) =>
        text
          .setPlaceholder("30000")
          .setValue(String(this.plugin.settings.debounceMs))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (!Number.isNaN(parsed) && parsed > 0) {
              this.plugin.settings.debounceMs = parsed;
              await this.plugin.saveSettings();
            }
          })
      );
  }
}
