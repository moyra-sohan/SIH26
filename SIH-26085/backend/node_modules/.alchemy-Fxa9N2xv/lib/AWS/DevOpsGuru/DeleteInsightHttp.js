import * as devopsguru from "@distilled.cloud/aws/devops-guru";
import * as Layer from "effect/Layer";
import { makeDevOpsGuruAccountHttpBinding } from "./BindingHttp.js";
import { DeleteInsight } from "./DeleteInsight.js";
export const DeleteInsightHttp = Layer.effect(DeleteInsight, makeDevOpsGuruAccountHttpBinding({
    tag: "AWS.DevOpsGuru.DeleteInsight",
    operation: devopsguru.deleteInsight,
    actions: ["devops-guru:DeleteInsight"],
}));
//# sourceMappingURL=DeleteInsightHttp.js.map