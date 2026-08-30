import * as fsx from "@distilled.cloud/aws/fsx";
import * as Layer from "effect/Layer";
import { makeFSxAccountHttpBinding } from "./BindingHttp.js";
import { CreateSnapshot } from "./CreateSnapshot.js";
export const CreateSnapshotHttp = Layer.effect(CreateSnapshot, makeFSxAccountHttpBinding({
    tag: "AWS.FSx.CreateSnapshot",
    operation: fsx.createSnapshot,
    actions: ["fsx:CreateSnapshot", "fsx:TagResource"],
}));
//# sourceMappingURL=CreateSnapshotHttp.js.map