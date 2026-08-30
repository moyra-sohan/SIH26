import * as glacier from "@distilled.cloud/aws/glacier";
import * as Layer from "effect/Layer";
import { makeGlacierVaultHttpBinding } from "./BindingHttp.js";
import { DescribeJob } from "./DescribeJob.js";
export const DescribeJobHttp = Layer.effect(DescribeJob, makeGlacierVaultHttpBinding({
    tag: "AWS.Glacier.DescribeJob",
    operation: glacier.describeJob,
    actions: ["glacier:DescribeJob"],
}));
//# sourceMappingURL=DescribeJobHttp.js.map