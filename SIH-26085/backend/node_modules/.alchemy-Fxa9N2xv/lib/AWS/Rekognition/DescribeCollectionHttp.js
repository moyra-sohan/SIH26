import * as rekognition from "@distilled.cloud/aws/rekognition";
import * as Layer from "effect/Layer";
import { makeRekognitionHttpBinding } from "./BindingHttp.js";
import { DescribeCollection } from "./DescribeCollection.js";
export const DescribeCollectionHttp = Layer.effect(DescribeCollection, makeRekognitionHttpBinding({
    tag: "AWS.Rekognition.DescribeCollection",
    operation: rekognition.describeCollection,
    actions: ["rekognition:DescribeCollection"],
}));
//# sourceMappingURL=DescribeCollectionHttp.js.map