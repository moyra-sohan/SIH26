import * as docdb from "@distilled.cloud/aws/docdb";
import * as Layer from "effect/Layer";
import { makeDocDBAccountHttpBinding } from "./BindingHttp.js";
import { DeleteDBClusterSnapshot } from "./DeleteDBClusterSnapshot.js";
export const DeleteDBClusterSnapshotHttp = Layer.effect(DeleteDBClusterSnapshot, makeDocDBAccountHttpBinding({
    tag: "AWS.DocDB.DeleteDBClusterSnapshot",
    operation: docdb.deleteDBClusterSnapshot,
    actions: ["rds:DeleteDBClusterSnapshot"],
}));
//# sourceMappingURL=DeleteDBClusterSnapshotHttp.js.map