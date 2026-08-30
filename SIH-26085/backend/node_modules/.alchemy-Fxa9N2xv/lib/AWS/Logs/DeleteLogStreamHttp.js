import * as Logs from "@distilled.cloud/aws/cloudwatch-logs";
import * as Layer from "effect/Layer";
import { makeLogGroupHttpBinding } from "./BindingHttp.js";
import { DeleteLogStream } from "./DeleteLogStream.js";
export const DeleteLogStreamHttp = Layer.effect(DeleteLogStream, makeLogGroupHttpBinding({
    tag: "AWS.Logs.DeleteLogStream",
    operation: Logs.deleteLogStream,
    actions: ["logs:DeleteLogStream"],
    // DeleteLogStream authorizes against the log-stream resource.
    iamResources: "streams",
}));
//# sourceMappingURL=DeleteLogStreamHttp.js.map