import * as codedeploy from "@distilled.cloud/aws/codedeploy";
import * as Layer from "effect/Layer";
import { BatchGetApplicationRevisions } from "./BatchGetApplicationRevisions.js";
import { makeCodeDeployApplicationHttpBinding } from "./BindingHttp.js";
export const BatchGetApplicationRevisionsHttp = Layer.effect(BatchGetApplicationRevisions, makeCodeDeployApplicationHttpBinding({
    tag: "AWS.CodeDeploy.BatchGetApplicationRevisions",
    operation: codedeploy.batchGetApplicationRevisions,
    actions: ["codedeploy:BatchGetApplicationRevisions"],
}));
//# sourceMappingURL=BatchGetApplicationRevisionsHttp.js.map