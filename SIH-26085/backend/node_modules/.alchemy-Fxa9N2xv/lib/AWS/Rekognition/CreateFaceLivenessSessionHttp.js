import * as rekognition from "@distilled.cloud/aws/rekognition";
import * as Layer from "effect/Layer";
import { makeRekognitionHttpBinding } from "./BindingHttp.js";
import { CreateFaceLivenessSession } from "./CreateFaceLivenessSession.js";
export const CreateFaceLivenessSessionHttp = Layer.effect(CreateFaceLivenessSession, makeRekognitionHttpBinding({
    tag: "AWS.Rekognition.CreateFaceLivenessSession",
    operation: rekognition.createFaceLivenessSession,
    actions: ["rekognition:CreateFaceLivenessSession"],
}));
//# sourceMappingURL=CreateFaceLivenessSessionHttp.js.map