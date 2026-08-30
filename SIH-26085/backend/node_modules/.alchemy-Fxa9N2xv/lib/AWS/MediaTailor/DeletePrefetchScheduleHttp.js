import * as mediatailor from "@distilled.cloud/aws/mediatailor";
import * as Layer from "effect/Layer";
import { makeMediaTailorPlaybackHttpBinding } from "./BindingHttp.js";
import { DeletePrefetchSchedule } from "./DeletePrefetchSchedule.js";
export const DeletePrefetchScheduleHttp = Layer.effect(DeletePrefetchSchedule, makeMediaTailorPlaybackHttpBinding({
    capability: "DeletePrefetchSchedule",
    iamActions: ["mediatailor:DeletePrefetchSchedule"],
    operation: mediatailor.deletePrefetchSchedule,
}));
//# sourceMappingURL=DeletePrefetchScheduleHttp.js.map