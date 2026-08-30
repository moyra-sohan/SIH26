import * as shield from "@distilled.cloud/aws/shield";
import * as Layer from "effect/Layer";
import { makeShieldHttpBinding } from "./BindingHttp.js";
import { DescribeAttackStatistics } from "./DescribeAttackStatistics.js";
export const DescribeAttackStatisticsHttp = Layer.effect(DescribeAttackStatistics, makeShieldHttpBinding({
    tag: "AWS.Shield.DescribeAttackStatistics",
    operation: shield.describeAttackStatistics,
    actions: ["shield:DescribeAttackStatistics"],
}));
//# sourceMappingURL=DescribeAttackStatisticsHttp.js.map