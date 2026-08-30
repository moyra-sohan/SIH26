import * as opensearch from "@distilled.cloud/aws/opensearch";
import * as Layer from "effect/Layer";
import { makeOpenSearchHttpBinding } from "./BindingHttp.js";
import { DescribeDomain } from "./DescribeDomain.js";
export const DescribeDomainHttp = Layer.effect(DescribeDomain, makeOpenSearchHttpBinding({
    tag: "AWS.OpenSearch.DescribeDomain",
    operation: opensearch.describeDomain,
    actions: ["es:DescribeDomain"],
}));
//# sourceMappingURL=DescribeDomainHttp.js.map