import * as mediapackagev2 from "@distilled.cloud/aws/mediapackagev2";
import * as Layer from "effect/Layer";
import { makeMediaPackageV2OriginEndpointHttpBinding } from "./BindingHttp.js";
import { CancelHarvestJob } from "./CancelHarvestJob.js";
export const CancelHarvestJobHttp = Layer.effect(CancelHarvestJob, makeMediaPackageV2OriginEndpointHttpBinding({
    tag: "AWS.MediaPackageV2.CancelHarvestJob",
    operation: mediapackagev2.cancelHarvestJob,
    actions: ["mediapackagev2:CancelHarvestJob"],
    harvestJobScoped: true,
}));
//# sourceMappingURL=CancelHarvestJobHttp.js.map