import * as ivsrealtime from "@distilled.cloud/aws/ivs-realtime";
import * as Layer from "effect/Layer";
import { toWireMinutes } from "../../Util/Duration.js";
import { makeIvsRealtimeStageHttpBinding } from "./BindingHttp.js";
import { CreateParticipantToken, } from "./CreateParticipantToken.js";
export const CreateParticipantTokenHttp = Layer.effect(CreateParticipantToken, makeIvsRealtimeStageHttpBinding({
    tag: "AWS.IVSRealtime.CreateParticipantToken",
    operation: ivsrealtime.createParticipantToken,
    actions: ["ivs:CreateParticipantToken"],
    prepare: ({ duration, ...request }) => ({
        ...request,
        duration: toWireMinutes(duration),
    }),
}));
//# sourceMappingURL=CreateParticipantTokenHttp.js.map