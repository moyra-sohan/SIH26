import * as neptunegraph from "@distilled.cloud/aws/neptune-graph";
import * as Layer from "effect/Layer";
import { makeNeptuneGraphGraphHttpBinding, SNAPSHOT_ARN_WILDCARD, } from "./BindingHttp.js";
import { CreateGraphSnapshot } from "./CreateGraphSnapshot.js";
export const CreateGraphSnapshotHttp = Layer.effect(CreateGraphSnapshot, makeNeptuneGraphGraphHttpBinding({
    tag: "AWS.NeptuneGraph.CreateGraphSnapshot",
    operation: neptunegraph.createGraphSnapshot,
    actions: ["neptune-graph:CreateGraphSnapshot", "neptune-graph:TagResource"],
    extraResources: [SNAPSHOT_ARN_WILDCARD],
}));
//# sourceMappingURL=CreateGraphSnapshotHttp.js.map