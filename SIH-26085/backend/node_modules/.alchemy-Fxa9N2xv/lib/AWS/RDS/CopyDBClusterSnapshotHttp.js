import * as rds from "@distilled.cloud/aws/rds";
import * as Layer from "effect/Layer";
import { makeRdsAccountHttpBinding } from "./BindingHttp.js";
import { CopyDBClusterSnapshot } from "./CopyDBClusterSnapshot.js";
export const CopyDBClusterSnapshotHttp = Layer.effect(CopyDBClusterSnapshot, makeRdsAccountHttpBinding({
    tag: "AWS.RDS.CopyDBClusterSnapshot",
    operation: rds.copyDBClusterSnapshot,
    actions: ["rds:CopyDBClusterSnapshot", "rds:AddTagsToResource"],
}));
//# sourceMappingURL=CopyDBClusterSnapshotHttp.js.map