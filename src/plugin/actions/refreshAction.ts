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
import { MANUAL_USAGE_MIN_SPACING_MS, refreshSucceeded } from "./refreshPolicy.js";

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
      const [usageResult, statusResult] = await Promise.all([
        usagePoller.pollIfDue(MANUAL_USAGE_MIN_SPACING_MS),
        statusPoller.pollNow(),
      ]);
      if (refreshSucceeded(usageResult, statusResult)) {
        await ev.action.showOk();
      } else {
        await ev.action.showAlert();
      }
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
