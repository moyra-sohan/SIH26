import * as neptune from "@distilled.cloud/aws/neptune";
import * as Layer from "effect/Layer";
import { makeNeptuneAccountHttpBinding } from "./BindingHttp.js";
import { DescribeDBInstances } from "./DescribeDBInstances.js";
export const DescribeDBInstancesHttp = Layer.effect(DescribeDBInstances, makeNeptuneAccountHttpBinding({
    tag: "AWS.Neptune.DescribeDBInstances",
    operation: neptune.describeDBInstances,
    actions: ["rds:DescribeDBInstances"],
}));
//# sourceMappingURL=DescribeDBInstancesHttp.js.map