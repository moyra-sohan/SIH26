import * as memorydb from "@distilled.cloud/aws/memorydb";
import * as Layer from "effect/Layer";
import { makeMemoryDBAccountHttpBinding } from "./BindingHttp.js";
import { DescribeEngineVersions } from "./DescribeEngineVersions.js";
export const DescribeEngineVersionsHttp = Layer.effect(DescribeEngineVersions, makeMemoryDBAccountHttpBinding({
    tag: "AWS.MemoryDB.DescribeEngineVersions",
    operation: memorydb.describeEngineVersions,
    actions: ["memorydb:DescribeEngineVersions"],
}));
//# sourceMappingURL=DescribeEngineVersionsHttp.js.map