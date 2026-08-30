import * as devopsguru from "@distilled.cloud/aws/devops-guru";
import * as Layer from "effect/Layer";
import { makeDevOpsGuruAccountHttpBinding } from "./BindingHttp.js";
import { DescribeFeedback } from "./DescribeFeedback.js";
export const DescribeFeedbackHttp = Layer.effect(DescribeFeedback, makeDevOpsGuruAccountHttpBinding({
    tag: "AWS.DevOpsGuru.DescribeFeedback",
    operation: devopsguru.describeFeedback,
    actions: ["devops-guru:DescribeFeedback"],
}));
//# sourceMappingURL=DescribeFeedbackHttp.js.map