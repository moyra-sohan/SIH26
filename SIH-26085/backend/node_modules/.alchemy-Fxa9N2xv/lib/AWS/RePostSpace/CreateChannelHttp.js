import * as repostspace from "@distilled.cloud/aws/repostspace";
import * as Layer from "effect/Layer";
import { makeRePostSpaceHttpBinding } from "./BindingHttp.js";
import { CreateChannel } from "./CreateChannel.js";
export const CreateChannelHttp = Layer.effect(CreateChannel, makeRePostSpaceHttpBinding({
    tag: "AWS.RePostSpace.CreateChannel",
    operation: repostspace.createChannel,
    actions: ["repostspace:CreateChannel"],
}));
//# sourceMappingURL=CreateChannelHttp.js.map