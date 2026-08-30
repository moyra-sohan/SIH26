import * as shield from "@distilled.cloud/aws/shield";
import * as Layer from "effect/Layer";
import { makeShieldHttpBinding } from "./BindingHttp.js";
import { DescribeAttack } from "./DescribeAttack.js";
export const DescribeAttackHttp = Layer.effect(DescribeAttack, makeShieldHttpBinding({
    tag: "AWS.Shield.DescribeAttack",
    operation: shield.describeAttack,
    actions: ["shield:DescribeAttack"],
}));
//# sourceMappingURL=DescribeAttackHttp.js.map