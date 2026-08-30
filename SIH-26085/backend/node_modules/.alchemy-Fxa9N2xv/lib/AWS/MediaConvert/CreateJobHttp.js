import * as mediaconvert from "@distilled.cloud/aws/mediaconvert";
import * as Layer from "effect/Layer";
import { makeMediaConvertHttpBinding } from "./BindingHttp.js";
import { CreateJob } from "./CreateJob.js";
export const CreateJobHttp = Layer.effect(CreateJob, makeMediaConvertHttpBinding({
    capability: "CreateJob",
    iamActions: ["mediaconvert:CreateJob"],
    operation: mediaconvert.createJob,
    passRole: true,
}));
//# sourceMappingURL=CreateJobHttp.js.map