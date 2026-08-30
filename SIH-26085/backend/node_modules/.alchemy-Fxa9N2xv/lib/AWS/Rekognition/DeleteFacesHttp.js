import * as rekognition from "@distilled.cloud/aws/rekognition";
import * as Layer from "effect/Layer";
import { makeRekognitionHttpBinding } from "./BindingHttp.js";
import { DeleteFaces } from "./DeleteFaces.js";
export const DeleteFacesHttp = Layer.effect(DeleteFaces, makeRekognitionHttpBinding({
    tag: "AWS.Rekognition.DeleteFaces",
    operation: rekognition.deleteFaces,
    actions: ["rekognition:DeleteFaces"],
}));
//# sourceMappingURL=DeleteFacesHttp.js.map