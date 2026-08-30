import * as devopsguru from "@distilled.cloud/aws/devops-guru";
import * as Layer from "effect/Layer";
import { makeDevOpsGuruAccountHttpBinding } from "./BindingHttp.js";
import { DescribeAnomaly } from "./DescribeAnomaly.js";
export const DescribeAnomalyHttp = Layer.effect(DescribeAnomaly, makeDevOpsGuruAccountHttpBinding({
    tag: "AWS.DevOpsGuru.DescribeAnomaly",
    operation: devopsguru.describeAnomaly,
    actions: ["devops-guru:DescribeAnomaly"],
}));
//# sourceMappingURL=DescribeAnomalyHttp.js.map