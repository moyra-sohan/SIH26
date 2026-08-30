import * as neptune from "@distilled.cloud/aws/neptune";
import * as Layer from "effect/Layer";
import { makeNeptuneAccountHttpBinding } from "./BindingHttp.js";
import { CopyDBClusterSnapshot } from "./CopyDBClusterSnapshot.js";
export const CopyDBClusterSnapshotHttp = Layer.effect(CopyDBClusterSnapshot, makeNeptuneAccountHttpBinding({
    tag: "AWS.Neptune.CopyDBClusterSnapshot",
    operation: neptune.copyDBClusterSnapshot,
    actions: ["rds:CopyDBClusterSnapshot"],
}));
//# sourceMappingURL=CopyDBClusterSnapshotHttp.js.map