import * as fsx from "@distilled.cloud/aws/fsx";
import * as Layer from "effect/Layer";
import { makeFSxAccountHttpBinding } from "./BindingHttp.js";
import { CancelDataRepositoryTask } from "./CancelDataRepositoryTask.js";
export const CancelDataRepositoryTaskHttp = Layer.effect(CancelDataRepositoryTask, makeFSxAccountHttpBinding({
    tag: "AWS.FSx.CancelDataRepositoryTask",
    operation: fsx.cancelDataRepositoryTask,
    actions: ["fsx:CancelDataRepositoryTask"],
}));
//# sourceMappingURL=CancelDataRepositoryTaskHttp.js.map