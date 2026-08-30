import * as dms from "@distilled.cloud/aws/database-migration-service";
import * as Layer from "effect/Layer";
import { makeDmsAccountHttpBinding } from "./BindingHttp.js";
import { DescribeOrderableReplicationInstances } from "./DescribeOrderableReplicationInstances.js";
export const DescribeOrderableReplicationInstancesHttp = Layer.effect(DescribeOrderableReplicationInstances, makeDmsAccountHttpBinding({
    tag: "AWS.DMS.DescribeOrderableReplicationInstances",
    actions: ["dms:DescribeOrderableReplicationInstances"],
    operation: dms.describeOrderableReplicationInstances,
}));
//# sourceMappingURL=DescribeOrderableReplicationInstancesHttp.js.map