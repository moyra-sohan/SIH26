import * as Kinesis from "@distilled.cloud/aws/kinesis";
import * as Layer from "effect/Layer";
import { makeKinesisAccountHttpBinding } from "./BindingHttp.js";
import { DescribeLimits } from "./DescribeLimits.js";
export const DescribeLimitsHttp = Layer.effect(DescribeLimits, makeKinesisAccountHttpBinding({
    tag: "AWS.Kinesis.DescribeLimits",
    operation: Kinesis.describeLimits,
    actions: ["kinesis:DescribeLimits"],
}));
//# sourceMappingURL=DescribeLimitsHttp.js.map