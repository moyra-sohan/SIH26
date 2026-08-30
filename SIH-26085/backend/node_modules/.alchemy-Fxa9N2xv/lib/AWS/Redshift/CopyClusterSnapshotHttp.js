import * as redshift from "@distilled.cloud/aws/redshift";
import * as Layer from "effect/Layer";
import { makeRedshiftAccountHttpBinding } from "./BindingHttp.js";
import { CopyClusterSnapshot } from "./CopyClusterSnapshot.js";
export const CopyClusterSnapshotHttp = Layer.effect(CopyClusterSnapshot, makeRedshiftAccountHttpBinding({
    tag: "AWS.Redshift.CopyClusterSnapshot",
    operation: redshift.copyClusterSnapshot,
    actions: ["redshift:CopyClusterSnapshot"],
}));
//# sourceMappingURL=CopyClusterSnapshotHttp.js.map