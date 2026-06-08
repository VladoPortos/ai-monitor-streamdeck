import { action, type KeyAction, type KeyDownEvent, type JsonObject } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { RerenderingAction } from "./baseRendering.js";
import { buildUsageBucketTree, type DisplayStyle } from "../render/keyTrees.js";
import {
  buildUsageBucketProps,
  pickHeadlineBucket,
  type BucketName,
} from "../render/keyProps.js";
import { getPluginContext } from "../pluginContext.js";

interface HeadlineSettings extends JsonObject {
  excludeBuckets?: BucketName[];
  displayStyle?: DisplayStyle;
}

const ALL_BUCKETS: BucketName[] = [
  "five_hour",
  "seven_day",
  "seven_day_sonnet",
  "seven_day_opus",
  "seven_day_omelette",
];

@action({ UUID: "com.vladoportos.aimonitor.usagehead" })
export class UsageHeadlineAction extends RerenderingAction<HeadlineSettings> {
  protected override async buildTreeFor(
    _action: KeyAction<HeadlineSettings>,
    settings: HeadlineSettings,
  ) {
    const exclude = new Set(settings.excludeBuckets ?? []);
    const candidates = ALL_BUCKETS.filter((b) => !exclude.has(b));
    const style: DisplayStyle = settings.displayStyle ?? "ring";
    const { store, freshnessBands, timeZone } = getPluginContext();
    const now = new Date();
    const snapshot = store.getUsage();
    const freshness = store.usageFreshness(now, freshnessBands);
    const stale = freshness === "stale" || freshness === "very_stale";
    const bucket = pickHeadlineBucket({ snapshot, candidates }) ?? "five_hour";
    const props = buildUsageBucketProps({ snapshot, bucket, now, stale, ...(timeZone ? { timeZone } : {}) });
    return buildUsageBucketTree({ ...props, style });
  }

  override async onKeyDown(_ev: KeyDownEvent<HeadlineSettings>): Promise<void> {
    await streamDeck.system.openUrl(getPluginContext().openWebDefaultUrl);
  }
}
