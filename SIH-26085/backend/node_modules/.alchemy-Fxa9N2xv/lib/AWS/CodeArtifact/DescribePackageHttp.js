import * as codeartifact from "@distilled.cloud/aws/codeartifact";
import * as Layer from "effect/Layer";
import { makeRepositoryHttpBinding, packageArns } from "./BindingHttp.js";
import { DescribePackage } from "./DescribePackage.js";
/** HTTP implementation of {@link DescribePackage} over the CodeArtifact API. */
export const DescribePackageHttp = Layer.effect(DescribePackage, makeRepositoryHttpBinding({
    tag: "AWS.CodeArtifact.DescribePackage",
    operation: codeartifact.describePackage,
    actions: ["codeartifact:DescribePackage"],
    resources: packageArns,
}));
//# sourceMappingURL=DescribePackageHttp.js.map