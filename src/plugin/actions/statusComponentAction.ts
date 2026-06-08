import { action, type KeyAction, type KeyDownEvent, type JsonObject } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { RerenderingAction } from "./baseRendering.js";
import { buildStatusTree } from "../render/keyTrees.js";
import { buildComponentStatusProps, type ComponentKey } from "../render/keyProps.js";
import { getPluginContext } from "../pluginContext.js";

interface ComponentSettings extends JsonObject {
  component?: ComponentKey;
}

@action({ UUID: "com.vladoportos.aimonitor.statuscomp" })
export class StatusComponentAction extends RerenderingAction<ComponentSettings> {
  protected override get tickEveryMinute(): boolean {
    return false;
  }

  protected override async buildTreeFor(
    _action: KeyAction<ComponentSettings>,
    settings: ComponentSettings,
  ) {
    const component: ComponentKey = settings.component ?? "code";
    const { store } = getPluginContext();
    const snapshot = store.getStatus();
    const props = buildComponentStatusProps({ snapshot, component });
    return buildStatusTree(props);
  }

  override async onKeyDown(_ev: KeyDownEvent<ComponentSettings>): Promise<void> {
    await streamDeck.system.openUrl("https://status.claude.com/");
  }
}
