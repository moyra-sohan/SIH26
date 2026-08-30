import * as cloudfront from "@distilled.cloud/aws/cloudfront";
import * as Layer from "effect/Layer";
import { makeDistributionScopedHttpBinding } from "./BindingHttp.js";
import { CreateInvalidation } from "./CreateInvalidation.js";
export const CreateInvalidationHttp = Layer.effect(CreateInvalidation, makeDistributionScopedHttpBinding({
    tag: "AWS.CloudFront.CreateInvalidation",
    operation: cloudfront.createInvalidation,
    actions: ["cloudfront:CreateInvalidation"],
}));
//# sourceMappingURL=CreateInvalidationHttp.js.map