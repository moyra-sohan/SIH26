import * as qbusiness from "@distilled.cloud/aws/qbusiness";
import * as Layer from "effect/Layer";
import { makeQBusinessApplicationHttpBinding } from "./BindingHttp.js";
import { CancelSubscription } from "./CancelSubscription.js";
export const CancelSubscriptionHttp = Layer.effect(CancelSubscription, makeQBusinessApplicationHttpBinding({
    tag: "AWS.QBusiness.CancelSubscription",
    operation: qbusiness.cancelSubscription,
    actions: ["qbusiness:CancelSubscription"],
}));
//# sourceMappingURL=CancelSubscriptionHttp.js.map