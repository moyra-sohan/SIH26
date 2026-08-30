import * as fsx from "@distilled.cloud/aws/fsx";
import * as Layer from "effect/Layer";
import { makeFSxAccountHttpBinding } from "./BindingHttp.js";
import { DescribeBackups } from "./DescribeBackups.js";
export const DescribeBackupsHttp = Layer.effect(DescribeBackups, makeFSxAccountHttpBinding({
    tag: "AWS.FSx.DescribeBackups",
    operation: fsx.describeBackups,
    actions: ["fsx:DescribeBackups"],
}));
//# sourceMappingURL=DescribeBackupsHttp.js.map