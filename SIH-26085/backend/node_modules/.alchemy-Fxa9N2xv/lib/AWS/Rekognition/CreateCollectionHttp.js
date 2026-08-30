import * as rekognition from "@distilled.cloud/aws/rekognition";
import * as Layer from "effect/Layer";
import { makeRekognitionHttpBinding } from "./BindingHttp.js";
import { CreateCollection } from "./CreateCollection.js";
export const CreateCollectionHttp = Layer.effect(CreateCollection, makeRekognitionHttpBinding({
    tag: "AWS.Rekognition.CreateCollection",
    operation: rekognition.createCollection,
    actions: ["rekognition:CreateCollection"],
}));
//# sourceMappingURL=CreateCollectionHttp.js.map