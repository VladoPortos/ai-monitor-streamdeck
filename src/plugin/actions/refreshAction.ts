import {
  action,
  type JsonObject,
  type KeyAction,
  type KeyDownEvent,
  type WillAppearEvent,
} from "@elgato/streamdeck";
import { SingletonAction } from "@elgato/streamdeck";
import { renderToPng } from "../render/renderer.js";
import { buildSimpleIconTree } from "../render/keyTrees.js";
import { palette } from "../render/theme.js";
import { getPluginContext } from "../pluginContext.js";

const MIN_INTERVAL_MS = 10_000;

@action({ UUID: "com.vladoportos.aimonitor.refresh" })
export class RefreshAction extends SingletonAction<JsonObject> {
  private lastTrigger = 0;

  override async onWillAppear(ev: WillAppearEvent<JsonObject>): Promise<void> {
    if (!ev.action.isKey()) return;
    await this.setIdle(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent<JsonObject>): Promise<void> {
    if (!ev.action.isKey()) return;
    const now = Date.now();
    if (now - this.lastTrigger < MIN_INTERVAL_MS) {
      // recent press: just acknowledge visually but skip the work
      await ev.action.showAlert();
      return;
    }
    this.lastTrigger = now;
    try {
      const { usagePoller, statusPoller } = getPluginContext();
      await Promise.all([usagePoller.pollNow(), statusPoller.pollNow()]);
      await ev.action.showOk();
    } catch {
      await ev.action.showAlert();
    }
  }

  private async setIdle(action: KeyAction<JsonObject>): Promise<void> {
    const tree = buildSimpleIconTree({ glyph: "↻", sublabel: "Refresh", color: palette.text });
    const png = await renderToPng(tree);
    await action.setImage(`data:image/png;base64,${png.toString("base64")}`);
  }
}
