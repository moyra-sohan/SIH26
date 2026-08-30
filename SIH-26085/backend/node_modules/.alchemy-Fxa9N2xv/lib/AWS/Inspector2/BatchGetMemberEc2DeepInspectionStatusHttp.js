import * as inspector2 from "@distilled.cloud/aws/inspector2";
import * as Layer from "effect/Layer";
import { makeInspector2AccountHttpBinding } from "./BindingHttp.js";
import { BatchGetMemberEc2DeepInspectionStatus } from "./BatchGetMemberEc2DeepInspectionStatus.js";
export const BatchGetMemberEc2DeepInspectionStatusHttp = Layer.effect(BatchGetMemberEc2DeepInspectionStatus, makeInspector2AccountHttpBinding({
    tag: "AWS.Inspector2.BatchGetMemberEc2DeepInspectionStatus",
    operation: inspector2.batchGetMemberEc2DeepInspectionStatus,
    actions: ["inspector2:BatchGetMemberEc2DeepInspectionStatus"],
}));
//# sourceMappingURL=BatchGetMemberEc2DeepInspectionStatusHttp.js.map