import * as memorydb from "@distilled.cloud/aws/memorydb";
import * as Layer from "effect/Layer";
import { makeMemoryDBAccountHttpBinding } from "./BindingHttp.js";
import { DescribeClusters } from "./DescribeClusters.js";
export const DescribeClustersHttp = Layer.effect(DescribeClusters, makeMemoryDBAccountHttpBinding({
    tag: "AWS.MemoryDB.DescribeClusters",
    operation: memorydb.describeClusters,
    actions: ["memorydb:DescribeClusters"],
}));
//# sourceMappingURL=DescribeClustersHttp.js.map