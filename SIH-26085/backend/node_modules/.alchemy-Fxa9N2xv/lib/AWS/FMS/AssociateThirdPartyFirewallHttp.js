import * as fms from "@distilled.cloud/aws/fms";
import * as Layer from "effect/Layer";
import { AssociateThirdPartyFirewall } from "./AssociateThirdPartyFirewall.js";
import { makeFmsHttpBinding } from "./BindingHttp.js";
export const AssociateThirdPartyFirewallHttp = Layer.effect(AssociateThirdPartyFirewall, makeFmsHttpBinding({
    capability: "AssociateThirdPartyFirewall",
    iamActions: ["fms:AssociateThirdPartyFirewall"],
    operation: fms.associateThirdPartyFirewall,
}));
//# sourceMappingURL=AssociateThirdPartyFirewallHttp.js.map