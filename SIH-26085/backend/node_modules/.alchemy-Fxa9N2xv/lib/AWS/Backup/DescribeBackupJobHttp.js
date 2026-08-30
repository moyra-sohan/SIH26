import * as backup from "@distilled.cloud/aws/backup";
import * as Layer from "effect/Layer";
import { makeBackupAccountHttpBinding } from "./BindingHttp.js";
import { DescribeBackupJob } from "./DescribeBackupJob.js";
export const DescribeBackupJobHttp = Layer.effect(DescribeBackupJob, makeBackupAccountHttpBinding({
    tag: "AWS.Backup.DescribeBackupJob",
    operation: backup.describeBackupJob,
    actions: ["backup:DescribeBackupJob"],
}));
//# sourceMappingURL=DescribeBackupJobHttp.js.map