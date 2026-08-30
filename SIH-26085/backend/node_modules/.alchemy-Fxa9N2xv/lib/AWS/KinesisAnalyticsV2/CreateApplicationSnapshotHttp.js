import * as analytics from "@distilled.cloud/aws/kinesis-analytics-v2";
import * as Layer from "effect/Layer";
import { makeKinesisAnalyticsHttpBinding } from "./BindingHttp.js";
import { CreateApplicationSnapshot } from "./CreateApplicationSnapshot.js";
export const CreateApplicationSnapshotHttp = Layer.effect(CreateApplicationSnapshot, makeKinesisAnalyticsHttpBinding({
    tag: "AWS.KinesisAnalyticsV2.CreateApplicationSnapshot",
    operation: analytics.createApplicationSnapshot,
    actions: ["kinesisanalytics:CreateApplicationSnapshot"],
}));
//# sourceMappingURL=CreateApplicationSnapshotHttp.js.map