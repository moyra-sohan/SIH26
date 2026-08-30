/// <reference types="@cloudflare/workers-types" />
import * as Data from "effect/Data";
import * as Binding from "./Binding.js";
const TypeId = "Cloudflare.Workers.AI";
/**
 * Error raised by Workers AI runtime operations (`ai.run`, `ai.models`, …).
 */
export class WorkersAIError extends Data.TaggedError("WorkersAIError") {
}
export const AI = Binding.Service({
    id: TypeId,
    defaultName: "AI",
    toWorkerBinding: (binding) => ({ type: "ai", name: binding.name }),
});
export const isAI = (value) => Binding.isBinding(value) && value.kind === TypeId;
//# sourceMappingURL=AI.js.map