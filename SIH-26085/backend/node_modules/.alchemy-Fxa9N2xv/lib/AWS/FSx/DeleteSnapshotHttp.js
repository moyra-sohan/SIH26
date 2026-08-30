import * as fsx from "@distilled.cloud/aws/fsx";
import * as Layer from "effect/Layer";
import { makeFSxAccountHttpBinding } from "./BindingHttp.js";
import { DeleteSnapshot } from "./DeleteSnapshot.js";
export const DeleteSnapshotHttp = Layer.effect(DeleteSnapshot, makeFSxAccountHttpBinding({
    tag: "AWS.FSx.DeleteSnapshot",
    operation: fsx.deleteSnapshot,
    actions: ["fsx:DeleteSnapshot"],
}));
//# sourceMappingURL=DeleteSnapshotHttp.js.map