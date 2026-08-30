import * as fsx from "@distilled.cloud/aws/fsx";
import * as Layer from "effect/Layer";
import { makeFSxFileSystemHttpBinding } from "./BindingHttp.js";
import { DescribeFileSystem } from "./DescribeFileSystem.js";
export const DescribeFileSystemHttp = Layer.effect(DescribeFileSystem, makeFSxFileSystemHttpBinding({
    tag: "AWS.FSx.DescribeFileSystem",
    operation: fsx.describeFileSystems,
    actions: ["fsx:DescribeFileSystems"],
    requestKey: "FileSystemIds",
}));
//# sourceMappingURL=DescribeFileSystemHttp.js.map