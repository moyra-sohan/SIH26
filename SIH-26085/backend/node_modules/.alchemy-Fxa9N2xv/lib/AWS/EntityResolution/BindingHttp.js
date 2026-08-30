import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Entity Resolution HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, makeWorkflowHttpBinding({ … }))` over the builder
 * below. Everything except the operation and the IAM action is boilerplate:
 * all Entity Resolution data-plane operations are scoped to a matching or ID
 * mapping workflow and inject the bound workflow's name as the request's
 * `workflowName` field.
 */
export const makeWorkflowHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (workflow) {
        const WorkflowName = yield* workflow.workflowName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${workflow}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [workflow.workflowArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${workflow.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                workflowName: yield* WorkflowName,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map