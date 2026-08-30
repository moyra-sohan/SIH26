import * as medialive from "@distilled.cloud/aws/medialive";
import * as Layer from "effect/Layer";
import { makeMediaLiveChannelHttpBinding } from "./BindingHttp.js";
import { DescribeChannel } from "./DescribeChannel.js";
export const DescribeChannelHttp = Layer.effect(DescribeChannel, makeMediaLiveChannelHttpBinding({
    tag: "AWS.MediaLive.DescribeChannel",
    operation: medialive.describeChannel,
    actions: ["medialive:DescribeChannel"],
}));
//# sourceMappingURL=DescribeChannelHttp.js.map