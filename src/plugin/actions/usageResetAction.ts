import { action, type KeyAction, type KeyDownEvent, type JsonObject } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { RerenderingAction } from "./baseRendering.js";
import { buildResetCountdownTree } from "../render/keyTrees.js";
import { buildResetCountdownProps, type BucketName } from "../render/keyProps.js";
import { getPluginContext } from "../pluginContext.js";

interface UsageResetSettings extends JsonObject {
  bucket?: BucketName;
}

@action({ UUID: "com.vladoportos.aimonitor.usagereset" })
export class UsageResetAction extends RerenderingAction<UsageResetSettings> {
  protected override async buildTreeFor(
    _action: KeyAction<UsageResetSettings>,
    settings: UsageResetSettings,
  ) {
    const bucket: BucketName = settings.bucket ?? "five_hour";
    const { store } = getPluginContext();
    const now = new Date();
    const snapshot = store.getUsage();
    const props = buildResetCountdownProps({ snapshot, bucket, now });
    return buildResetCountdownTree(props);
  }

  override async onKeyDown(_ev: KeyDownEvent<UsageResetSettings>): Promise<void> {
    await streamDeck.system.openUrl(getPluginContext().openWebDefaultUrl);
  }
}
