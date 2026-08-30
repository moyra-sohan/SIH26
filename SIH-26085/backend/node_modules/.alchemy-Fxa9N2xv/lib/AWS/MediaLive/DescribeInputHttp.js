import * as medialive from "@distilled.cloud/aws/medialive";
import * as Layer from "effect/Layer";
import { makeMediaLiveInputHttpBinding } from "./BindingHttp.js";
import { DescribeInput } from "./DescribeInput.js";
export const DescribeInputHttp = Layer.effect(DescribeInput, makeMediaLiveInputHttpBinding({
    tag: "AWS.MediaLive.DescribeInput",
    operation: medialive.describeInput,
    actions: ["medialive:DescribeInput"],
}));
//# sourceMappingURL=DescribeInputHttp.js.map