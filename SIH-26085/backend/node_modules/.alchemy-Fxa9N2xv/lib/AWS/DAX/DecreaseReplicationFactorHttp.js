import * as dax from "@distilled.cloud/aws/dax";
import * as Layer from "effect/Layer";
import { makeDaxClusterHttpBinding } from "./BindingHttp.js";
import { DecreaseReplicationFactor } from "./DecreaseReplicationFactor.js";
export const DecreaseReplicationFactorHttp = Layer.effect(DecreaseReplicationFactor, makeDaxClusterHttpBinding({
    tag: "AWS.DAX.DecreaseReplicationFactor",
    operation: dax.decreaseReplicationFactor,
    actions: ["dax:DecreaseReplicationFactor"],
}));
//# sourceMappingURL=DecreaseReplicationFactorHttp.js.map