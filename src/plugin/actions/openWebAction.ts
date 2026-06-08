import {
  action,
  type JsonObject,
  type KeyAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type DidReceiveSettingsEvent,
} from "@elgato/streamdeck";
import streamDeck, { SingletonAction } from "@elgato/streamdeck";
import { renderToPng } from "../render/renderer.js";
import { buildSimpleIconTree } from "../render/keyTrees.js";
import { palette } from "../render/theme.js";
import { getPluginContext } from "../pluginContext.js";

interface OpenWebSettings extends JsonObject {
  url?: string;
  label?: string;
}

@action({ UUID: "com.vladoportos.aimonitor.openweb" })
export class OpenWebAction extends SingletonAction<OpenWebSettings> {
  override async onWillAppear(ev: WillAppearEvent<OpenWebSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    await this.render(ev.action, ev.payload.settings);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<OpenWebSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    await this.render(ev.action, ev.payload.settings);
  }

  override async onKeyDown(ev: KeyDownEvent<OpenWebSettings>): Promise<void> {
    const url = ev.payload.settings.url || getPluginContext().openWebDefaultUrl;
    await streamDeck.system.openUrl(url);
  }

  private async render(action: KeyAction<OpenWebSettings>, settings: OpenWebSettings): Promise<void> {
    const tree = buildSimpleIconTree({
      glyph: "✦",
      sublabel: settings.label || "Open",
      color: palette.accent,
    });
    const png = await renderToPng(tree);
    await action.setImage(`data:image/png;base64,${png.toString("base64")}`);
  }
}
