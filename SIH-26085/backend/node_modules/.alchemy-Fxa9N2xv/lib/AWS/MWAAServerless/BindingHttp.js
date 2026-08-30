import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the Amazon MWAA Serverless HTTP bindings.
 *
 * Every MWAA Serverless data-plane operation is addressed by a
 * `WorkflowArn`, so every binding is scoped to a bound {@link Workflow}:
 * the deploy-time half grants `actions` on the workflow's ARN (plus the
 * `{workflowArn}/*` wildcard covering run- and task-scoped sub-resources),
 * and the runtime half injects the workflow's ARN into every request.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, makeMwaaServerlessHttpBinding({ … }))`.
 */
export const makeMwaaServerlessHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (workflow) {
        // Outputs yield a DEFERRED effect — resolve again per invocation below.
        const WorkflowArn = yield* workflow.workflowArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${workflow}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                workflow.workflowArn,
                                // run/task-scoped operations authorize against
                                // sub-resources below the workflow ARN
                                Output.interpolate `${workflow.workflowArn}/*`,
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${workflow.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                WorkflowArn: yield* WorkflowArn,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map