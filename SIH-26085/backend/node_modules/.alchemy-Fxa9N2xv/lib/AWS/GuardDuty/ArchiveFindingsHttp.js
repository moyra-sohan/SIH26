import * as guardduty from "@distilled.cloud/aws/guardduty";
import * as Layer from "effect/Layer";
import { makeGuardDutyDetectorHttpBinding } from "./BindingHttp.js";
import { ArchiveFindings } from "./ArchiveFindings.js";
export const ArchiveFindingsHttp = Layer.effect(ArchiveFindings, makeGuardDutyDetectorHttpBinding({
    tag: "AWS.GuardDuty.ArchiveFindings",
    operation: guardduty.archiveFindings,
    actions: ["guardduty:ArchiveFindings"],
}));
//# sourceMappingURL=ArchiveFindingsHttp.js.map