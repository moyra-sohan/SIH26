import * as fsx from "@distilled.cloud/aws/fsx";
import * as Layer from "effect/Layer";
import { makeFSxAccountHttpBinding } from "./BindingHttp.js";
import { CopySnapshotAndUpdateVolume } from "./CopySnapshotAndUpdateVolume.js";
export const CopySnapshotAndUpdateVolumeHttp = Layer.effect(CopySnapshotAndUpdateVolume, makeFSxAccountHttpBinding({
    tag: "AWS.FSx.CopySnapshotAndUpdateVolume",
    operation: fsx.copySnapshotAndUpdateVolume,
    actions: ["fsx:CopySnapshotAndUpdateVolume"],
}));
//# sourceMappingURL=CopySnapshotAndUpdateVolumeHttp.js.map