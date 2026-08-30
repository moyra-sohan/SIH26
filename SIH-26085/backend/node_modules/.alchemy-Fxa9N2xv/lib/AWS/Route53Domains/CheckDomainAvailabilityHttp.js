import * as route53domains from "@distilled.cloud/aws/route-53-domains";
import * as Layer from "effect/Layer";
import { makeRoute53DomainsHttpBinding } from "./BindingHttp.js";
import { CheckDomainAvailability } from "./CheckDomainAvailability.js";
export const CheckDomainAvailabilityHttp = Layer.effect(CheckDomainAvailability, makeRoute53DomainsHttpBinding({
    capability: "CheckDomainAvailability",
    iamActions: ["route53domains:CheckDomainAvailability"],
    operation: route53domains.checkDomainAvailability,
}));
//# sourceMappingURL=CheckDomainAvailabilityHttp.js.map