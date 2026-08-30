import * as ivschat from "@distilled.cloud/aws/ivschat";
import * as Layer from "effect/Layer";
import { toWireMinutes } from "../../Util/Duration.js";
import { makeIvsChatRoomHttpBinding } from "./BindingHttp.js";
import { CreateChatToken, } from "./CreateChatToken.js";
export const CreateChatTokenHttp = Layer.effect(CreateChatToken, makeIvsChatRoomHttpBinding({
    tag: "AWS.IVSChat.CreateChatToken",
    operation: ivschat.createChatToken,
    actions: ["ivschat:CreateChatToken"],
    prepare: ({ sessionDuration, ...request }) => ({
        ...request,
        sessionDurationInMinutes: toWireMinutes(sessionDuration),
    }),
}));
//# sourceMappingURL=CreateChatTokenHttp.js.map