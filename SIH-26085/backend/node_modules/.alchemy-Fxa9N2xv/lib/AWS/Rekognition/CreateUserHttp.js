import * as rekognition from "@distilled.cloud/aws/rekognition";
import * as Layer from "effect/Layer";
import { makeRekognitionHttpBinding } from "./BindingHttp.js";
import { CreateUser } from "./CreateUser.js";
export const CreateUserHttp = Layer.effect(CreateUser, makeRekognitionHttpBinding({
    tag: "AWS.Rekognition.CreateUser",
    operation: rekognition.createUser,
    actions: ["rekognition:CreateUser"],
}));
//# sourceMappingURL=CreateUserHttp.js.map