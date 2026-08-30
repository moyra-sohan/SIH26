import * as cloudhsm from "@distilled.cloud/aws/cloudhsm-v2";
import * as Layer from "effect/Layer";
import { makeCloudHsmHttpBinding } from "./BindingHttp.js";
import { DescribeBackups } from "./DescribeBackups.js";
export const DescribeBackupsHttp = Layer.effect(DescribeBackups, makeCloudHsmHttpBinding({
    tag: "AWS.CloudHSMV2.DescribeBackups",
    operation: cloudhsm.describeBackups,
    actions: ["cloudhsm:DescribeBackups"],
}));
//# sourceMappingURL=DescribeBackupsHttp.js.map