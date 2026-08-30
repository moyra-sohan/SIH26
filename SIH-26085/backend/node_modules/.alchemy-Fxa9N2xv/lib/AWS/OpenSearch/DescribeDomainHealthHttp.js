import * as opensearch from "@distilled.cloud/aws/opensearch";
import * as Layer from "effect/Layer";
import { makeOpenSearchHttpBinding } from "./BindingHttp.js";
import { DescribeDomainHealth } from "./DescribeDomainHealth.js";
export const DescribeDomainHealthHttp = Layer.effect(DescribeDomainHealth, makeOpenSearchHttpBinding({
    tag: "AWS.OpenSearch.DescribeDomainHealth",
    operation: opensearch.describeDomainHealth,
    actions: ["es:DescribeDomainHealth"],
}));
//# sourceMappingURL=DescribeDomainHealthHttp.js.map