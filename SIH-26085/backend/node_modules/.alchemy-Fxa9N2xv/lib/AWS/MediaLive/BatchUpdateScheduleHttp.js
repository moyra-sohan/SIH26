import * as medialive from "@distilled.cloud/aws/medialive";
import * as Layer from "effect/Layer";
import { BatchUpdateSchedule } from "./BatchUpdateSchedule.js";
import { makeMediaLiveChannelHttpBinding } from "./BindingHttp.js";
export const BatchUpdateScheduleHttp = Layer.effect(BatchUpdateSchedule, makeMediaLiveChannelHttpBinding({
    tag: "AWS.MediaLive.BatchUpdateSchedule",
    operation: medialive.batchUpdateSchedule,
    actions: ["medialive:BatchUpdateSchedule"],
}));
//# sourceMappingURL=BatchUpdateScheduleHttp.js.map