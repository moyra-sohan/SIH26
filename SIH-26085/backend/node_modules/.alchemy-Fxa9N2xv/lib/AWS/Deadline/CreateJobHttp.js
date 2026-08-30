import * as deadline from "@distilled.cloud/aws/deadline";
import * as Layer from "effect/Layer";
import { makeDeadlineQueueHttpBinding } from "./BindingHttp.js";
import { CreateJob } from "./CreateJob.js";
export const CreateJobHttp = Layer.effect(CreateJob, makeDeadlineQueueHttpBinding({
    tag: "AWS.Deadline.CreateJob",
    operation: deadline.createJob,
    actions: ["deadline:CreateJob"],
}));
//# sourceMappingURL=CreateJobHttp.js.map