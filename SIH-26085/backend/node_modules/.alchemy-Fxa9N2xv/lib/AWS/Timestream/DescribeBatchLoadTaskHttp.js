import * as TSW from "@distilled.cloud/aws/timestream-write";
import * as Layer from "effect/Layer";
import { makeWriteAccountHttpBinding } from "./BindingHttp.js";
import { DescribeBatchLoadTask } from "./DescribeBatchLoadTask.js";
export const DescribeBatchLoadTaskHttp = Layer.effect(DescribeBatchLoadTask, makeWriteAccountHttpBinding({
    tag: "AWS.Timestream.DescribeBatchLoadTask",
    operation: TSW.describeBatchLoadTask,
    actions: ["timestream:DescribeBatchLoadTask"],
}));
//# sourceMappingURL=DescribeBatchLoadTaskHttp.js.map