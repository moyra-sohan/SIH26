import * as opensearch from "@distilled.cloud/aws/opensearch";
import * as Layer from "effect/Layer";
import { makeOpenSearchHttpBinding } from "./BindingHttp.js";
import { DescribeDomainChangeProgress } from "./DescribeDomainChangeProgress.js";
export const DescribeDomainChangeProgressHttp = Layer.effect(DescribeDomainChangeProgress, makeOpenSearchHttpBinding({
    tag: "AWS.OpenSearch.DescribeDomainChangeProgress",
    operation: opensearch.describeDomainChangeProgress,
    actions: ["es:DescribeDomainChangeProgress"],
}));
//# sourceMappingURL=DescribeDomainChangeProgressHttp.js.map