import * as rds from "@distilled.cloud/aws/rds";
import * as Layer from "effect/Layer";
import { makeRdsAccountHttpBinding } from "./BindingHttp.js";
import { DescribeDBInstances } from "./DescribeDBInstances.js";
export const DescribeDBInstancesHttp = Layer.effect(DescribeDBInstances, makeRdsAccountHttpBinding({
    tag: "AWS.RDS.DescribeDBInstances",
    operation: rds.describeDBInstances,
    actions: ["rds:DescribeDBInstances"],
}));
//# sourceMappingURL=DescribeDBInstancesHttp.js.map