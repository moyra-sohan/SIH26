import * as emrc from "@distilled.cloud/aws/emr-containers";
import * as Layer from "effect/Layer";
import { makeEMRContainersVirtualClusterHttpBinding } from "./BindingHttp.js";
import { CancelJobRun } from "./CancelJobRun.js";
export const CancelJobRunHttp = Layer.effect(CancelJobRun, makeEMRContainersVirtualClusterHttpBinding({
    tag: "AWS.EMRContainers.CancelJobRun",
    operation: emrc.cancelJobRun,
    actions: ["emr-containers:CancelJobRun"],
}));
//# sourceMappingURL=CancelJobRunHttp.js.map