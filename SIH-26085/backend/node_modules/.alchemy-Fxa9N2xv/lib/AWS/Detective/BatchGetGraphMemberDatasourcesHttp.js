import * as detective from "@distilled.cloud/aws/detective";
import * as Layer from "effect/Layer";
import { makeDetectiveGraphHttpBinding } from "./BindingHttp.js";
import { BatchGetGraphMemberDatasources } from "./BatchGetGraphMemberDatasources.js";
export const BatchGetGraphMemberDatasourcesHttp = Layer.effect(BatchGetGraphMemberDatasources, makeDetectiveGraphHttpBinding({
    tag: "AWS.Detective.BatchGetGraphMemberDatasources",
    operation: detective.batchGetGraphMemberDatasources,
    actions: ["detective:BatchGetGraphMemberDatasources"],
}));
//# sourceMappingURL=BatchGetGraphMemberDatasourcesHttp.js.map