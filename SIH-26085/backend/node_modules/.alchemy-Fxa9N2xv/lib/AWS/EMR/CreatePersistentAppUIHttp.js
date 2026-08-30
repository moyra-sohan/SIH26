import * as emr from "@distilled.cloud/aws/emr";
import * as Layer from "effect/Layer";
import { makeEmrClusterHttpBinding } from "./BindingHttp.js";
import { CreatePersistentAppUI } from "./CreatePersistentAppUI.js";
export const CreatePersistentAppUIHttp = Layer.effect(CreatePersistentAppUI, makeEmrClusterHttpBinding({
    tag: "AWS.EMR.CreatePersistentAppUI",
    operation: emr.createPersistentAppUI,
    actions: ["elasticmapreduce:CreatePersistentAppUI"],
    inject: "TargetResourceArn",
}));
//# sourceMappingURL=CreatePersistentAppUIHttp.js.map