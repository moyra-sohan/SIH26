import * as neptunegraph from "@distilled.cloud/aws/neptune-graph";
import * as Layer from "effect/Layer";
import { makeNeptuneGraphAccountHttpBinding, SNAPSHOT_ARN_WILDCARD, } from "./BindingHttp.js";
import { DeleteGraphSnapshot } from "./DeleteGraphSnapshot.js";
export const DeleteGraphSnapshotHttp = Layer.effect(DeleteGraphSnapshot, makeNeptuneGraphAccountHttpBinding({
    tag: "AWS.NeptuneGraph.DeleteGraphSnapshot",
    operation: neptunegraph.deleteGraphSnapshot,
    actions: ["neptune-graph:DeleteGraphSnapshot"],
    resources: [SNAPSHOT_ARN_WILDCARD],
}));
//# sourceMappingURL=DeleteGraphSnapshotHttp.js.map