import * as Logs from "@distilled.cloud/aws/cloudwatch-logs";
import * as Layer from "effect/Layer";
import { makeLogGroupHttpBinding } from "./BindingHttp.js";
import { CreateLogStream } from "./CreateLogStream.js";
export const CreateLogStreamHttp = Layer.effect(CreateLogStream, makeLogGroupHttpBinding({
    tag: "AWS.Logs.CreateLogStream",
    operation: Logs.createLogStream,
    actions: ["logs:CreateLogStream"],
}));
//# sourceMappingURL=CreateLogStreamHttp.js.map