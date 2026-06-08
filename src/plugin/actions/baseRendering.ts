import {
  SingletonAction,
  type JsonObject,
  type KeyAction,
  type WillAppearEvent,
  type WillDisappearEvent,
  type DidReceiveSettingsEvent,
} from "@elgato/streamdeck";
import { renderToPng } from "../render/renderer.js";
import type { RenderNode } from "../render/keyTrees.js";
import { getPluginContext } from "../pluginContext.js";

/**
 * Base for actions that re-render whenever the shared state store emits a change.
 * Subclass implements `buildTreeFor(action, settings)`.
 */
export abstract class RerenderingAction<S extends JsonObject> extends SingletonAction<S> {
  private unsubscribe: (() => void) | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;

  protected abstract buildTreeFor(action: KeyAction<S>, settings: S): Promise<RenderNode | null>;

  /** Subclasses can opt out of the minute-tick countdown re-render if they don't display time. */
  protected get tickEveryMinute(): boolean {
    return true;
  }

  override async onWillAppear(ev: WillAppearEvent<S>): Promise<void> {
    if (!ev.action.isKey()) return;
    if (!this.unsubscribe) {
      const { store } = getPluginContext();
      this.unsubscribe = store.subscribe(() => void this.rerenderAll());
      if (this.tickEveryMinute) {
        this.countdownTimer = setInterval(() => void this.rerenderAll(), 60_000);
      }
    }
    await this.renderInstance(ev.action, ev.payload.settings);
  }

  override async onWillDisappear(_ev: WillDisappearEvent<S>): Promise<void> {
    // Count remaining visible instances of this action across all devices.
    let remaining = 0;
    for (const _a of this.actions) remaining++;
    if (remaining === 0 && this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): Promise<void> {
    if (!ev.action.isKey()) return;
    await this.renderInstance(ev.action, ev.payload.settings);
  }

  private async rerenderAll(): Promise<void> {
    for (const action of this.actions) {
      if (!action.isKey()) continue;
      try {
        const settings = await action.getSettings();
        await this.renderInstance(action, settings as S);
      } catch {
        // skip broken instance
      }
    }
  }

  private async renderInstance(action: KeyAction<S>, settings: S): Promise<void> {
    try {
      const tree = await this.buildTreeFor(action, settings);
      if (tree === null) return;
      const png = await renderToPng(tree);
      const base64 = `data:image/png;base64,${png.toString("base64")}`;
      await action.setImage(base64);
    } catch (e) {
      // Log but don't crash; fall back to manifest icon.
      const { store } = getPluginContext();
      void store; // silence lint
      console.error("render failed:", e instanceof Error ? e.message : e);
    }
  }
}
