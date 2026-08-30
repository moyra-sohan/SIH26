import * as qbusiness from "@distilled.cloud/aws/qbusiness";
import * as Layer from "effect/Layer";
import { makeQBusinessApplicationHttpBinding } from "./BindingHttp.js";
import { CreateSubscription } from "./CreateSubscription.js";
export const CreateSubscriptionHttp = Layer.effect(CreateSubscription, makeQBusinessApplicationHttpBinding({
    tag: "AWS.QBusiness.CreateSubscription",
    operation: qbusiness.createSubscription,
    actions: ["qbusiness:CreateSubscription"],
}));
//# sourceMappingURL=CreateSubscriptionHttp.js.map