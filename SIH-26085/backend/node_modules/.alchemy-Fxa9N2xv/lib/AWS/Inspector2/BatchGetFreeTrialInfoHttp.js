import * as inspector2 from "@distilled.cloud/aws/inspector2";
import * as Layer from "effect/Layer";
import { makeInspector2AccountHttpBinding } from "./BindingHttp.js";
import { BatchGetFreeTrialInfo } from "./BatchGetFreeTrialInfo.js";
export const BatchGetFreeTrialInfoHttp = Layer.effect(BatchGetFreeTrialInfo, makeInspector2AccountHttpBinding({
    tag: "AWS.Inspector2.BatchGetFreeTrialInfo",
    operation: inspector2.batchGetFreeTrialInfo,
    actions: ["inspector2:BatchGetFreeTrialInfo"],
}));
//# sourceMappingURL=BatchGetFreeTrialInfoHttp.js.map