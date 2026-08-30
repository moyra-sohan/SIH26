import * as rekognition from "@distilled.cloud/aws/rekognition";
import * as Layer from "effect/Layer";
import { makeRekognitionHttpBinding } from "./BindingHttp.js";
import { DeleteCollection } from "./DeleteCollection.js";
export const DeleteCollectionHttp = Layer.effect(DeleteCollection, makeRekognitionHttpBinding({
    tag: "AWS.Rekognition.DeleteCollection",
    operation: rekognition.deleteCollection,
    actions: ["rekognition:DeleteCollection"],
}));
//# sourceMappingURL=DeleteCollectionHttp.js.map