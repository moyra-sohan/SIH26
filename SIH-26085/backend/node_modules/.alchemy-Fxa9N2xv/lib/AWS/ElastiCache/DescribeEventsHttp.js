import * as elasticache from "@distilled.cloud/aws/elasticache";
import * as Layer from "effect/Layer";
import { makeElastiCacheAccountHttpBinding } from "./BindingHttp.js";
import { DescribeEvents } from "./DescribeEvents.js";
export const DescribeEventsHttp = Layer.effect(DescribeEvents, makeElastiCacheAccountHttpBinding({
    tag: "AWS.ElastiCache.DescribeEvents",
    operation: elasticache.describeEvents,
    actions: ["elasticache:DescribeEvents"],
}));
//# sourceMappingURL=DescribeEventsHttp.js.map