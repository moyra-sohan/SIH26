import * as redshift from "@distilled.cloud/aws/redshift";
import * as Layer from "effect/Layer";
import { makeRedshiftAccountHttpBinding } from "./BindingHttp.js";
import { DescribeClusters } from "./DescribeClusters.js";
export const DescribeClustersHttp = Layer.effect(DescribeClusters, makeRedshiftAccountHttpBinding({
    tag: "AWS.Redshift.DescribeClusters",
    operation: redshift.describeClusters,
    actions: ["redshift:DescribeClusters"],
}));
//# sourceMappingURL=DescribeClustersHttp.js.map