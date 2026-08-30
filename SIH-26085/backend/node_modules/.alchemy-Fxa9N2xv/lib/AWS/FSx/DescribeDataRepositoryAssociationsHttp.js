import * as fsx from "@distilled.cloud/aws/fsx";
import * as Layer from "effect/Layer";
import { makeFSxAccountHttpBinding } from "./BindingHttp.js";
import { DescribeDataRepositoryAssociations } from "./DescribeDataRepositoryAssociations.js";
export const DescribeDataRepositoryAssociationsHttp = Layer.effect(DescribeDataRepositoryAssociations, makeFSxAccountHttpBinding({
    tag: "AWS.FSx.DescribeDataRepositoryAssociations",
    operation: fsx.describeDataRepositoryAssociations,
    actions: ["fsx:DescribeDataRepositoryAssociations"],
}));
//# sourceMappingURL=DescribeDataRepositoryAssociationsHttp.js.map