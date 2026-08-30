import * as sns from "@distilled.cloud/aws/sns";
import * as Layer from "effect/Layer";
import { makeSnsSubscriptionHttpBinding } from "./BindingHttp.js";
import { ConfirmSubscription } from "./ConfirmSubscription.js";
export const ConfirmSubscriptionHttp = Layer.effect(ConfirmSubscription, makeSnsSubscriptionHttpBinding({
    tag: "AWS.SNS.ConfirmSubscription",
    operation: sns.confirmSubscription,
    actions: ["sns:ConfirmSubscription"],
    key: "TopicArn",
}));
//# sourceMappingURL=ConfirmSubscriptionHttp.js.map