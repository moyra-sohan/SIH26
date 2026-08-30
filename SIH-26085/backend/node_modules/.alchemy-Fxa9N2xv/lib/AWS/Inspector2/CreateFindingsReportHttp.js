import * as inspector2 from "@distilled.cloud/aws/inspector2";
import * as Layer from "effect/Layer";
import { makeInspector2AccountHttpBinding } from "./BindingHttp.js";
import { CreateFindingsReport } from "./CreateFindingsReport.js";
export const CreateFindingsReportHttp = Layer.effect(CreateFindingsReport, makeInspector2AccountHttpBinding({
    tag: "AWS.Inspector2.CreateFindingsReport",
    operation: inspector2.createFindingsReport,
    actions: ["inspector2:CreateFindingsReport"],
}));
//# sourceMappingURL=CreateFindingsReportHttp.js.map