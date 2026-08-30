import * as vpclattice from "@distilled.cloud/aws/vpc-lattice";
import * as Layer from "effect/Layer";
import { makeVpcLatticeTargetGroupHttpBinding } from "./BindingHttp.js";
import { DeregisterTargets } from "./DeregisterTargets.js";
export const DeregisterTargetsHttp = Layer.effect(DeregisterTargets, makeVpcLatticeTargetGroupHttpBinding({
    tag: "AWS.VpcLattice.DeregisterTargets",
    operation: vpclattice.deregisterTargets,
    actions: ["vpc-lattice:DeregisterTargets"],
}));
//# sourceMappingURL=DeregisterTargetsHttp.js.map