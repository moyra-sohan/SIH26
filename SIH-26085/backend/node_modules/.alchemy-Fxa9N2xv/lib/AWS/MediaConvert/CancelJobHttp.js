import * as mediaconvert from "@distilled.cloud/aws/mediaconvert";
import * as Layer from "effect/Layer";
import { makeMediaConvertHttpBinding } from "./BindingHttp.js";
import { CancelJob } from "./CancelJob.js";
export const CancelJobHttp = Layer.effect(CancelJob, makeMediaConvertHttpBinding({
    capability: "CancelJob",
    iamActions: ["mediaconvert:CancelJob"],
    operation: mediaconvert.cancelJob,
}));
//# sourceMappingURL=CancelJobHttp.js.map