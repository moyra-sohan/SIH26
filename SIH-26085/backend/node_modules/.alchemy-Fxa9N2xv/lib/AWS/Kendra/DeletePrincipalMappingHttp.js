import * as kendra from "@distilled.cloud/aws/kendra";
import * as Layer from "effect/Layer";
import { makeKendraIndexHttpBinding } from "./BindingHttp.js";
import { DeletePrincipalMapping } from "./DeletePrincipalMapping.js";
export const DeletePrincipalMappingHttp = Layer.effect(DeletePrincipalMapping, makeKendraIndexHttpBinding({
    tag: "AWS.Kendra.DeletePrincipalMapping",
    operation: kendra.deletePrincipalMapping,
    actions: ["kendra:DeletePrincipalMapping"],
    subResources: ["data-source/*"],
}));
//# sourceMappingURL=DeletePrincipalMappingHttp.js.map