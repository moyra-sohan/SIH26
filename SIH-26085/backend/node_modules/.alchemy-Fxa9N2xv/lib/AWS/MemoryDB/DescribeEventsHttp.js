import * as memorydb from "@distilled.cloud/aws/memorydb";
import * as Layer from "effect/Layer";
import { makeMemoryDBAccountHttpBinding } from "./BindingHttp.js";
import { DescribeEvents } from "./DescribeEvents.js";
export const DescribeEventsHttp = Layer.effect(DescribeEvents, makeMemoryDBAccountHttpBinding({
    tag: "AWS.MemoryDB.DescribeEvents",
    operation: memorydb.describeEvents,
    actions: ["memorydb:DescribeEvents"],
}));
//# sourceMappingURL=DescribeEventsHttp.js.map