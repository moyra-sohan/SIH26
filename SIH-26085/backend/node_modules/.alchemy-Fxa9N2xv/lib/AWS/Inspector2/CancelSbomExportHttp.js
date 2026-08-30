import * as inspector2 from "@distilled.cloud/aws/inspector2";
import * as Layer from "effect/Layer";
import { makeInspector2AccountHttpBinding } from "./BindingHttp.js";
import { CancelSbomExport } from "./CancelSbomExport.js";
export const CancelSbomExportHttp = Layer.effect(CancelSbomExport, makeInspector2AccountHttpBinding({
    tag: "AWS.Inspector2.CancelSbomExport",
    operation: inspector2.cancelSbomExport,
    actions: ["inspector2:CancelSbomExport"],
}));
//# sourceMappingURL=CancelSbomExportHttp.js.map