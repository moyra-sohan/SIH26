import * as emr from "@distilled.cloud/aws/emr-serverless";
import * as Layer from "effect/Layer";
import { makeEmrServerlessHttpBinding } from "./BindingHttp.js";
import { CancelJobRun } from "./CancelJobRun.js";
export const CancelJobRunHttp = Layer.effect(CancelJobRun, makeEmrServerlessHttpBinding({
    tag: "AWS.EMRServerless.CancelJobRun",
    operation: emr.cancelJobRun,
    actions: ["emr-serverless:CancelJobRun"],
    subresources: ["/jobruns/*"],
}));
//# sourceMappingURL=CancelJobRunHttp.js.map