import * as ecr from "@distilled.cloud/aws/ecr";
import * as Layer from "effect/Layer";
import { makeEcrRepositoryHttpBinding } from "./BindingHttp.js";
import { BatchCheckLayerAvailability } from "./BatchCheckLayerAvailability.js";
/** HTTP implementation of {@link BatchCheckLayerAvailability} over the ECR API. */
export const BatchCheckLayerAvailabilityHttp = Layer.effect(BatchCheckLayerAvailability, makeEcrRepositoryHttpBinding({
    capability: "BatchCheckLayerAvailability",
    operation: ecr.batchCheckLayerAvailability,
    iamActions: ["ecr:BatchCheckLayerAvailability"],
}));
//# sourceMappingURL=BatchCheckLayerAvailabilityHttp.js.map