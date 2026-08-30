import * as datazone from "@distilled.cloud/aws/datazone";
import * as Layer from "effect/Layer";
import { makeDataZoneDomainHttpBinding } from "./BindingHttp.js";
import { AcceptSubscriptionRequest } from "./AcceptSubscriptionRequest.js";
export const AcceptSubscriptionRequestHttp = Layer.effect(AcceptSubscriptionRequest, makeDataZoneDomainHttpBinding({
    tag: "AWS.DataZone.AcceptSubscriptionRequest",
    operation: datazone.acceptSubscriptionRequest,
    actions: ["datazone:AcceptSubscriptionRequest"],
}));
//# sourceMappingURL=AcceptSubscriptionRequestHttp.js.map