import * as neptune from "@distilled.cloud/aws/neptune";
import * as Layer from "effect/Layer";
import { makeNeptuneAccountHttpBinding } from "./BindingHttp.js";
import { DescribeEvents } from "./DescribeEvents.js";
export const DescribeEventsHttp = Layer.effect(DescribeEvents, makeNeptuneAccountHttpBinding({
    tag: "AWS.Neptune.DescribeEvents",
    operation: neptune.describeEvents,
    actions: ["rds:DescribeEvents"],
}));
//# sourceMappingURL=DescribeEventsHttp.js.map