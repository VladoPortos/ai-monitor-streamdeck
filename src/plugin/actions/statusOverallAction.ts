import { action, type KeyAction, type KeyDownEvent, type JsonObject } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { RerenderingAction } from "./baseRendering.js";
import { buildStatusTree } from "../render/keyTrees.js";
import { buildStatusOverallProps } from "../render/keyProps.js";
import { getPluginContext } from "../pluginContext.js";

@action({ UUID: "com.vladoportos.aimonitor.statusoverall" })
export class StatusOverallAction extends RerenderingAction<JsonObject> {
  protected override get tickEveryMinute(): boolean {
    return false; // no countdowns to re-render
  }

  protected override async buildTreeFor(_action: KeyAction<JsonObject>, _settings: JsonObject) {
    const { store } = getPluginContext();
    const snapshot = store.getStatus();
    const props = buildStatusOverallProps({ snapshot });
    return buildStatusTree(props);
  }

  override async onKeyDown(_ev: KeyDownEvent<JsonObject>): Promise<void> {
    await streamDeck.system.openUrl("https://status.claude.com/");
  }
}
