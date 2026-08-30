import * as datazone from "@distilled.cloud/aws/datazone";
import * as Layer from "effect/Layer";
import { makeDataZoneDomainHttpBinding } from "./BindingHttp.js";
import { CreateSubscriptionRequest } from "./CreateSubscriptionRequest.js";
export const CreateSubscriptionRequestHttp = Layer.effect(CreateSubscriptionRequest, makeDataZoneDomainHttpBinding({
    tag: "AWS.DataZone.CreateSubscriptionRequest",
    operation: datazone.createSubscriptionRequest,
    actions: ["datazone:CreateSubscriptionRequest"],
}));
//# sourceMappingURL=CreateSubscriptionRequestHttp.js.map