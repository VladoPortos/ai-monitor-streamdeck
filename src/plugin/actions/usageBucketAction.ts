import { action, type KeyAction, type KeyDownEvent, type JsonObject } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { RerenderingAction } from "./baseRendering.js";
import { buildUsageBucketTree, type DisplayStyle } from "../render/keyTrees.js";
import { buildUsageBucketProps, type BucketName } from "../render/keyProps.js";
import { getPluginContext } from "../pluginContext.js";

interface UsageBucketSettings extends JsonObject {
  bucket?: BucketName;
  displayStyle?: DisplayStyle;
}

@action({ UUID: "com.vladoportos.aimonitor.usagebucket" })
export class UsageBucketAction extends RerenderingAction<UsageBucketSettings> {
  protected override async buildTreeFor(
    _action: KeyAction<UsageBucketSettings>,
    settings: UsageBucketSettings,
  ) {
    const bucket: BucketName = settings.bucket ?? "five_hour";
    const style: DisplayStyle = settings.displayStyle ?? "ring";
    const { store, freshnessBands, timeZone } = getPluginContext();
    const now = new Date();
    const snapshot = store.getUsage();
    const freshness = store.usageFreshness(now, freshnessBands);
    const stale = freshness === "stale" || freshness === "very_stale";
    const props = buildUsageBucketProps({ snapshot, bucket, now, stale, ...(timeZone ? { timeZone } : {}) });
    return buildUsageBucketTree({ ...props, style });
  }

  override async onKeyDown(_ev: KeyDownEvent<UsageBucketSettings>): Promise<void> {
    await streamDeck.system.openUrl(getPluginContext().openWebDefaultUrl);
  }
}
