import { action, type KeyAction, type KeyDownEvent, type JsonObject } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { RerenderingAction } from "./baseRendering.js";
import { buildExtraUsageTree } from "../render/keyTrees.js";
import { buildExtraUsageProps } from "../render/keyProps.js";
import { getPluginContext } from "../pluginContext.js";

@action({ UUID: "com.vladoportos.aimonitor.extra" })
export class ExtraUsageAction extends RerenderingAction<JsonObject> {
  protected override async buildTreeFor(_action: KeyAction<JsonObject>, _settings: JsonObject) {
    const { store, freshnessBands } = getPluginContext();
    const now = new Date();
    const snapshot = store.getUsage();
    const freshness = store.usageFreshness(now, freshnessBands);
    const stale = freshness === "stale" || freshness === "very_stale";
    const props = buildExtraUsageProps({ snapshot, now, stale });
    return buildExtraUsageTree(props);
  }

  override async onKeyDown(_ev: KeyDownEvent<JsonObject>): Promise<void> {
    await streamDeck.system.openUrl(getPluginContext().openWebDefaultUrl);
  }
}
