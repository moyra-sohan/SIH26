import * as scheduler from "@distilled.cloud/aws/scheduler";
import * as Layer from "effect/Layer";
import { makeScheduleWriteHttpBinding } from "./BindingHttp.js";
import { CreateSchedule } from "./CreateSchedule.js";
export const CreateScheduleHttp = Layer.effect(CreateSchedule, makeScheduleWriteHttpBinding({
    tag: "AWS.Scheduler.CreateSchedule",
    operation: scheduler.createSchedule,
    actions: ["scheduler:CreateSchedule"],
}));
//# sourceMappingURL=CreateScheduleHttp.js.map