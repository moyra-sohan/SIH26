import * as elbv2 from "@distilled.cloud/aws/elastic-load-balancing-v2";
import * as Layer from "effect/Layer";
import { makeLoadBalancerHttpBinding } from "./BindingHttp.js";
import { DescribeCapacityReservation } from "./DescribeCapacityReservation.js";
export const DescribeCapacityReservationHttp = Layer.effect(DescribeCapacityReservation, makeLoadBalancerHttpBinding({
    tag: "AWS.ELBv2.DescribeCapacityReservation",
    operation: elbv2.describeCapacityReservation,
    actions: ["elasticloadbalancing:DescribeCapacityReservation"],
    resource: "*",
}));
//# sourceMappingURL=DescribeCapacityReservationHttp.js.map