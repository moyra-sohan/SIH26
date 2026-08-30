import * as finspace from "@distilled.cloud/aws/finspace";
import * as Layer from "effect/Layer";
import { makeFinSpaceKxHttpBinding } from "./BindingHttp.js";
import { DeleteKxVolume } from "./DeleteKxVolume.js";
export const DeleteKxVolumeHttp = Layer.effect(DeleteKxVolume, makeFinSpaceKxHttpBinding({
    tag: "AWS.FinSpace.DeleteKxVolume",
    operation: finspace.deleteKxVolume,
    actions: ["finspace:DeleteKxVolume"],
}));
//# sourceMappingURL=DeleteKxVolumeHttp.js.map