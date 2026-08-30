import * as route53domains from "@distilled.cloud/aws/route-53-domains";
import * as Layer from "effect/Layer";
import { makeRoute53DomainsHttpBinding } from "./BindingHttp.js";
import { CheckDomainTransferability } from "./CheckDomainTransferability.js";
export const CheckDomainTransferabilityHttp = Layer.effect(CheckDomainTransferability, makeRoute53DomainsHttpBinding({
    capability: "CheckDomainTransferability",
    iamActions: ["route53domains:CheckDomainTransferability"],
    operation: route53domains.checkDomainTransferability,
}));
//# sourceMappingURL=CheckDomainTransferabilityHttp.js.map