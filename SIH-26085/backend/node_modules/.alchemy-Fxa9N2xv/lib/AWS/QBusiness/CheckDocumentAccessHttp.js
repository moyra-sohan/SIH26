import * as qbusiness from "@distilled.cloud/aws/qbusiness";
import * as Layer from "effect/Layer";
import { makeQBusinessIndexHttpBinding } from "./BindingHttp.js";
import { CheckDocumentAccess } from "./CheckDocumentAccess.js";
export const CheckDocumentAccessHttp = Layer.effect(CheckDocumentAccess, makeQBusinessIndexHttpBinding({
    tag: "AWS.QBusiness.CheckDocumentAccess",
    operation: qbusiness.checkDocumentAccess,
    actions: ["qbusiness:CheckDocumentAccess"],
}));
//# sourceMappingURL=CheckDocumentAccessHttp.js.map