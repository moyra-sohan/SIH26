import * as docdbelastic from "@distilled.cloud/aws/docdb-elastic";
import * as Layer from "effect/Layer";
import { makeDocDBElasticAccountHttpBinding } from "./BindingHttp.js";
import { DeleteClusterSnapshot } from "./DeleteClusterSnapshot.js";
export const DeleteClusterSnapshotHttp = Layer.effect(DeleteClusterSnapshot, makeDocDBElasticAccountHttpBinding({
    tag: "AWS.DocDBElastic.DeleteClusterSnapshot",
    operation: docdbelastic.deleteClusterSnapshot,
    actions: ["docdb-elastic:DeleteClusterSnapshot"],
}));
//# sourceMappingURL=DeleteClusterSnapshotHttp.js.map