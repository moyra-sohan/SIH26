import * as docdb from "@distilled.cloud/aws/docdb";
import * as Layer from "effect/Layer";
import { makeDocDBAccountHttpBinding } from "./BindingHttp.js";
import { CopyDBClusterSnapshot } from "./CopyDBClusterSnapshot.js";
export const CopyDBClusterSnapshotHttp = Layer.effect(CopyDBClusterSnapshot, makeDocDBAccountHttpBinding({
    tag: "AWS.DocDB.CopyDBClusterSnapshot",
    operation: docdb.copyDBClusterSnapshot,
    actions: ["rds:CopyDBClusterSnapshot"],
}));
//# sourceMappingURL=CopyDBClusterSnapshotHttp.js.map