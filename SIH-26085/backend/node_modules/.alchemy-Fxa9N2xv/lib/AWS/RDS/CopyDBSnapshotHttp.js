import * as rds from "@distilled.cloud/aws/rds";
import * as Layer from "effect/Layer";
import { makeRdsAccountHttpBinding } from "./BindingHttp.js";
import { CopyDBSnapshot } from "./CopyDBSnapshot.js";
export const CopyDBSnapshotHttp = Layer.effect(CopyDBSnapshot, makeRdsAccountHttpBinding({
    tag: "AWS.RDS.CopyDBSnapshot",
    operation: rds.copyDBSnapshot,
    actions: ["rds:CopyDBSnapshot", "rds:AddTagsToResource"],
}));
//# sourceMappingURL=CopyDBSnapshotHttp.js.map