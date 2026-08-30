import * as shield from "@distilled.cloud/aws/shield";
import * as Layer from "effect/Layer";
import { makeShieldHttpBinding } from "./BindingHttp.js";
import { DescribeDRTAccess } from "./DescribeDRTAccess.js";
export const DescribeDRTAccessHttp = Layer.effect(DescribeDRTAccess, makeShieldHttpBinding({
    tag: "AWS.Shield.DescribeDRTAccess",
    operation: shield.describeDRTAccess,
    actions: ["shield:DescribeDRTAccess"],
}));
//# sourceMappingURL=DescribeDRTAccessHttp.js.map