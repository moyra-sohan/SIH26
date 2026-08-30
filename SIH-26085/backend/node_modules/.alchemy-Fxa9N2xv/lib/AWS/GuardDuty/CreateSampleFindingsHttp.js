import * as guardduty from "@distilled.cloud/aws/guardduty";
import * as Layer from "effect/Layer";
import { makeGuardDutyDetectorHttpBinding } from "./BindingHttp.js";
import { CreateSampleFindings } from "./CreateSampleFindings.js";
export const CreateSampleFindingsHttp = Layer.effect(CreateSampleFindings, makeGuardDutyDetectorHttpBinding({
    tag: "AWS.GuardDuty.CreateSampleFindings",
    operation: guardduty.createSampleFindings,
    actions: ["guardduty:CreateSampleFindings"],
}));
//# sourceMappingURL=CreateSampleFindingsHttp.js.map