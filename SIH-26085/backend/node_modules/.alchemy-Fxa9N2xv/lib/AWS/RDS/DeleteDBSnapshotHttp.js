import * as rds from "@distilled.cloud/aws/rds";
import * as Layer from "effect/Layer";
import { makeRdsAccountHttpBinding } from "./BindingHttp.js";
import { DeleteDBSnapshot } from "./DeleteDBSnapshot.js";
export const DeleteDBSnapshotHttp = Layer.effect(DeleteDBSnapshot, makeRdsAccountHttpBinding({
    tag: "AWS.RDS.DeleteDBSnapshot",
    operation: rds.deleteDBSnapshot,
    actions: ["rds:DeleteDBSnapshot"],
}));
//# sourceMappingURL=DeleteDBSnapshotHttp.js.map