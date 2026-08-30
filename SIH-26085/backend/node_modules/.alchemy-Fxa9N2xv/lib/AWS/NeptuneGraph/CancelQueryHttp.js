import * as neptunegraph from "@distilled.cloud/aws/neptune-graph";
import * as Layer from "effect/Layer";
import { makeNeptuneGraphGraphHttpBinding } from "./BindingHttp.js";
import { CancelQuery } from "./CancelQuery.js";
export const CancelQueryHttp = Layer.effect(CancelQuery, makeNeptuneGraphGraphHttpBinding({
    tag: "AWS.NeptuneGraph.CancelQuery",
    operation: neptunegraph.cancelQuery,
    actions: ["neptune-graph:CancelQuery"],
}));
//# sourceMappingURL=CancelQueryHttp.js.map