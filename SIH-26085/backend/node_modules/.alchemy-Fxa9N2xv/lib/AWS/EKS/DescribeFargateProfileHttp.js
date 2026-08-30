import * as eks from "@distilled.cloud/aws/eks";
import * as Layer from "effect/Layer";
import { makeEKSClusterHttpBinding } from "./BindingHttp.js";
import { DescribeFargateProfile } from "./DescribeFargateProfile.js";
export const DescribeFargateProfileHttp = Layer.effect(DescribeFargateProfile, makeEKSClusterHttpBinding({
    tag: "AWS.EKS.DescribeFargateProfile",
    operation: eks.describeFargateProfile,
    actions: ["eks:DescribeFargateProfile"],
    key: "clusterName",
    scope: "subresources",
}));
//# sourceMappingURL=DescribeFargateProfileHttp.js.map