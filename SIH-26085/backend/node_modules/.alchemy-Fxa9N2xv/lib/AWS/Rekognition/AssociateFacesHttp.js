import * as rekognition from "@distilled.cloud/aws/rekognition";
import * as Layer from "effect/Layer";
import { makeRekognitionHttpBinding } from "./BindingHttp.js";
import { AssociateFaces } from "./AssociateFaces.js";
export const AssociateFacesHttp = Layer.effect(AssociateFaces, makeRekognitionHttpBinding({
    tag: "AWS.Rekognition.AssociateFaces",
    operation: rekognition.associateFaces,
    actions: ["rekognition:AssociateFaces"],
}));
//# sourceMappingURL=AssociateFacesHttp.js.map