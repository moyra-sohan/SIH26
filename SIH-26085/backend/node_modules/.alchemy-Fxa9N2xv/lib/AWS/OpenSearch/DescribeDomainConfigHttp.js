import * as opensearch from "@distilled.cloud/aws/opensearch";
import * as Layer from "effect/Layer";
import { makeOpenSearchHttpBinding } from "./BindingHttp.js";
import { DescribeDomainConfig } from "./DescribeDomainConfig.js";
export const DescribeDomainConfigHttp = Layer.effect(DescribeDomainConfig, makeOpenSearchHttpBinding({
    tag: "AWS.OpenSearch.DescribeDomainConfig",
    operation: opensearch.describeDomainConfig,
    actions: ["es:DescribeDomainConfig"],
}));
//# sourceMappingURL=DescribeDomainConfigHttp.js.map