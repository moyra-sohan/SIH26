import * as cloudhsm from "@distilled.cloud/aws/cloudhsm-v2";
import * as Layer from "effect/Layer";
import { makeCloudHsmHttpBinding } from "./BindingHttp.js";
import { DescribeClusters } from "./DescribeClusters.js";
export const DescribeClustersHttp = Layer.effect(DescribeClusters, makeCloudHsmHttpBinding({
    tag: "AWS.CloudHSMV2.DescribeClusters",
    operation: cloudhsm.describeClusters,
    actions: ["cloudhsm:DescribeClusters"],
}));
//# sourceMappingURL=DescribeClustersHttp.js.map