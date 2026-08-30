import * as Kinesis from "@distilled.cloud/aws/kinesis";
import * as Layer from "effect/Layer";
import { makeKinesisAccountHttpBinding } from "./BindingHttp.js";
import { DescribeAccountSettings } from "./DescribeAccountSettings.js";
export const DescribeAccountSettingsHttp = Layer.effect(DescribeAccountSettings, makeKinesisAccountHttpBinding({
    tag: "AWS.Kinesis.DescribeAccountSettings",
    operation: Kinesis.describeAccountSettings,
    actions: ["kinesis:DescribeAccountSettings"],
}));
//# sourceMappingURL=DescribeAccountSettingsHttp.js.map