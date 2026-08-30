import * as efs from "@distilled.cloud/aws/efs";
import * as Layer from "effect/Layer";
import { makeEfsFileSystemHttpBinding } from "./BindingHttp.js";
import { DescribeBackupPolicy } from "./DescribeBackupPolicy.js";
export const DescribeBackupPolicyHttp = Layer.effect(DescribeBackupPolicy, makeEfsFileSystemHttpBinding({
    tag: "AWS.EFS.DescribeBackupPolicy",
    operation: efs.describeBackupPolicy,
    actions: ["elasticfilesystem:DescribeBackupPolicy"],
}));
//# sourceMappingURL=DescribeBackupPolicyHttp.js.map