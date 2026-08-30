import * as opensearch from "@distilled.cloud/aws/opensearch";
import * as Layer from "effect/Layer";
import { makeOpenSearchHttpBinding } from "./BindingHttp.js";
import { DescribeDomainNodes } from "./DescribeDomainNodes.js";
export const DescribeDomainNodesHttp = Layer.effect(DescribeDomainNodes, makeOpenSearchHttpBinding({
    tag: "AWS.OpenSearch.DescribeDomainNodes",
    operation: opensearch.describeDomainNodes,
    actions: ["es:DescribeDomainNodes"],
}));
//# sourceMappingURL=DescribeDomainNodesHttp.js.map