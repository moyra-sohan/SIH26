import * as ec2 from "@distilled.cloud/aws/ec2";
import * as Layer from "effect/Layer";
import { makeVolumeHttpBinding } from "./BindingHttp.js";
import { CreateSnapshot } from "./CreateSnapshot.js";
export const CreateSnapshotHttp = Layer.effect(CreateSnapshot, makeVolumeHttpBinding({
    tag: "AWS.EC2.CreateSnapshot",
    operation: ec2.createSnapshot,
    // `ec2:CreateTags` covers `TagSpecifications` on the new snapshot.
    actions: ["ec2:CreateSnapshot", "ec2:CreateTags"],
    // Snapshot creation authorizes against both the source volume and the
    // new snapshot; snapshot ARNs carry no account id.
    extraResources: ["arn:aws:ec2:*::snapshot/*"],
}));
//# sourceMappingURL=CreateSnapshotHttp.js.map