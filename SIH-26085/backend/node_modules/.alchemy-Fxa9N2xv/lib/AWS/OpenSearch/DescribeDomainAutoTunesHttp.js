import * as opensearch from "@distilled.cloud/aws/opensearch";
import * as Layer from "effect/Layer";
import { makeOpenSearchHttpBinding } from "./BindingHttp.js";
import { DescribeDomainAutoTunes } from "./DescribeDomainAutoTunes.js";
export const DescribeDomainAutoTunesHttp = Layer.effect(DescribeDomainAutoTunes, makeOpenSearchHttpBinding({
    tag: "AWS.OpenSearch.DescribeDomainAutoTunes",
    operation: opensearch.describeDomainAutoTunes,
    actions: ["es:DescribeDomainAutoTunes"],
}));
//# sourceMappingURL=DescribeDomainAutoTunesHttp.js.map