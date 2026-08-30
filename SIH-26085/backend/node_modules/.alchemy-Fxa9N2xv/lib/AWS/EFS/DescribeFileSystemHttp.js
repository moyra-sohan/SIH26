import * as efs from "@distilled.cloud/aws/efs";
import * as Layer from "effect/Layer";
import { makeEfsFileSystemHttpBinding } from "./BindingHttp.js";
import { DescribeFileSystem } from "./DescribeFileSystem.js";
export const DescribeFileSystemHttp = Layer.effect(DescribeFileSystem, makeEfsFileSystemHttpBinding({
    tag: "AWS.EFS.DescribeFileSystem",
    operation: efs.describeFileSystems,
    actions: ["elasticfilesystem:DescribeFileSystems"],
}));
//# sourceMappingURL=DescribeFileSystemHttp.js.map