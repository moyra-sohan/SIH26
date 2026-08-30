import * as mq from "@distilled.cloud/aws/mq";
import * as Layer from "effect/Layer";
import { makeMqBrokerHttpBinding } from "./BindingHttp.js";
import { DescribeBroker } from "./DescribeBroker.js";
export const DescribeBrokerHttp = Layer.effect(DescribeBroker, makeMqBrokerHttpBinding({
    capability: "DescribeBroker",
    operation: mq.describeBroker,
    iamActions: ["mq:DescribeBroker"],
}));
//# sourceMappingURL=DescribeBrokerHttp.js.map