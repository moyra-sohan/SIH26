import * as emrc from "@distilled.cloud/aws/emr-containers";
import * as Layer from "effect/Layer";
import { makeEMRContainersVirtualClusterHttpBinding } from "./BindingHttp.js";
import { DescribeJobRun } from "./DescribeJobRun.js";
export const DescribeJobRunHttp = Layer.effect(DescribeJobRun, makeEMRContainersVirtualClusterHttpBinding({
    tag: "AWS.EMRContainers.DescribeJobRun",
    operation: emrc.describeJobRun,
    actions: ["emr-containers:DescribeJobRun"],
}));
//# sourceMappingURL=DescribeJobRunHttp.js.map