import * as dms from "@distilled.cloud/aws/database-migration-service";
import * as Layer from "effect/Layer";
import { makeDmsAccountHttpBinding } from "./BindingHttp.js";
import { DescribeConnections } from "./DescribeConnections.js";
export const DescribeConnectionsHttp = Layer.effect(DescribeConnections, makeDmsAccountHttpBinding({
    tag: "AWS.DMS.DescribeConnections",
    actions: ["dms:DescribeConnections"],
    operation: dms.describeConnections,
}));
//# sourceMappingURL=DescribeConnectionsHttp.js.map