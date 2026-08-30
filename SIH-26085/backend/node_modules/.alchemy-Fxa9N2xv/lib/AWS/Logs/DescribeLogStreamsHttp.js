import * as Logs from "@distilled.cloud/aws/cloudwatch-logs";
import * as Layer from "effect/Layer";
import { makeLogGroupHttpBinding } from "./BindingHttp.js";
import { DescribeLogStreams } from "./DescribeLogStreams.js";
export const DescribeLogStreamsHttp = Layer.effect(DescribeLogStreams, makeLogGroupHttpBinding({
    tag: "AWS.Logs.DescribeLogStreams",
    operation: Logs.describeLogStreams,
    actions: ["logs:DescribeLogStreams"],
}));
//# sourceMappingURL=DescribeLogStreamsHttp.js.map