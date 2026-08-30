import * as fsx from "@distilled.cloud/aws/fsx";
import * as Layer from "effect/Layer";
import { makeFSxAccountHttpBinding } from "./BindingHttp.js";
import { DescribeDataRepositoryTasks } from "./DescribeDataRepositoryTasks.js";
export const DescribeDataRepositoryTasksHttp = Layer.effect(DescribeDataRepositoryTasks, makeFSxAccountHttpBinding({
    tag: "AWS.FSx.DescribeDataRepositoryTasks",
    operation: fsx.describeDataRepositoryTasks,
    actions: ["fsx:DescribeDataRepositoryTasks"],
}));
//# sourceMappingURL=DescribeDataRepositoryTasksHttp.js.map