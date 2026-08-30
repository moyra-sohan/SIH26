import * as redshift from "@distilled.cloud/aws/redshift";
import * as Layer from "effect/Layer";
import { makeRedshiftAccountHttpBinding } from "./BindingHttp.js";
import { DescribeEvents } from "./DescribeEvents.js";
export const DescribeEventsHttp = Layer.effect(DescribeEvents, makeRedshiftAccountHttpBinding({
    tag: "AWS.Redshift.DescribeEvents",
    operation: redshift.describeEvents,
    actions: ["redshift:DescribeEvents"],
}));
//# sourceMappingURL=DescribeEventsHttp.js.map