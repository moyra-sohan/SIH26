import * as medialive from "@distilled.cloud/aws/medialive";
import * as Layer from "effect/Layer";
import { makeMediaLiveChannelHttpBinding } from "./BindingHttp.js";
import { DeleteSchedule } from "./DeleteSchedule.js";
export const DeleteScheduleHttp = Layer.effect(DeleteSchedule, makeMediaLiveChannelHttpBinding({
    tag: "AWS.MediaLive.DeleteSchedule",
    operation: medialive.deleteSchedule,
    actions: ["medialive:DeleteSchedule"],
}));
//# sourceMappingURL=DeleteScheduleHttp.js.map