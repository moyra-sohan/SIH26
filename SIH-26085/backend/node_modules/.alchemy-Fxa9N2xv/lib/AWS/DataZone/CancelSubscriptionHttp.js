import * as datazone from "@distilled.cloud/aws/datazone";
import * as Layer from "effect/Layer";
import { makeDataZoneDomainHttpBinding } from "./BindingHttp.js";
import { CancelSubscription } from "./CancelSubscription.js";
export const CancelSubscriptionHttp = Layer.effect(CancelSubscription, makeDataZoneDomainHttpBinding({
    tag: "AWS.DataZone.CancelSubscription",
    operation: datazone.cancelSubscription,
    actions: ["datazone:CancelSubscription"],
}));
//# sourceMappingURL=CancelSubscriptionHttp.js.map