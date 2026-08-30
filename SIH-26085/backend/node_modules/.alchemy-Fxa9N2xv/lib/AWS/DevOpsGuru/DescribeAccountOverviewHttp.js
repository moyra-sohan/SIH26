import * as devopsguru from "@distilled.cloud/aws/devops-guru";
import * as Layer from "effect/Layer";
import { makeDevOpsGuruAccountHttpBinding } from "./BindingHttp.js";
import { DescribeAccountOverview } from "./DescribeAccountOverview.js";
export const DescribeAccountOverviewHttp = Layer.effect(DescribeAccountOverview, makeDevOpsGuruAccountHttpBinding({
    tag: "AWS.DevOpsGuru.DescribeAccountOverview",
    operation: devopsguru.describeAccountOverview,
    actions: ["devops-guru:DescribeAccountOverview"],
}));
//# sourceMappingURL=DescribeAccountOverviewHttp.js.map