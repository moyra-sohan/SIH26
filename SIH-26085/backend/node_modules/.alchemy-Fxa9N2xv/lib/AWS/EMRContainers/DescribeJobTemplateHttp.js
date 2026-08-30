import * as emrc from "@distilled.cloud/aws/emr-containers";
import * as Layer from "effect/Layer";
import { makeEMRContainersJobTemplateHttpBinding } from "./BindingHttp.js";
import { DescribeJobTemplate } from "./DescribeJobTemplate.js";
export const DescribeJobTemplateHttp = Layer.effect(DescribeJobTemplate, makeEMRContainersJobTemplateHttpBinding({
    tag: "AWS.EMRContainers.DescribeJobTemplate",
    operation: emrc.describeJobTemplate,
    actions: ["emr-containers:DescribeJobTemplate"],
}));
//# sourceMappingURL=DescribeJobTemplateHttp.js.map