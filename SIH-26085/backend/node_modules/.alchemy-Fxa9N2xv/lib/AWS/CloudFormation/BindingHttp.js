import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS CloudFormation HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation, the IAM action list, and
 * (for stack-scoped operations) the injected `StackName` is boilerplate.
 */
/**
 * Build the impl Effect for a stack-scoped operation: the runtime callable
 * injects the bound {@link Stack}'s stack id (the stack ARN, which every
 * CloudFormation API accepts as `StackName`) and the deploy-time half grants
 * `actions` on the stack ARN.
 */
export const makeCloudFormationStackHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (stack) {
        const StackName = yield* stack.stackId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${stack}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [stack.stackId],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${stack.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                StackName: yield* StackName,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level operation (cross-stack export
 * discovery, drift-detection polling, template validation). The deploy-time
 * half grants `actions` on `*` — these CloudFormation actions are not
 * resource-scoped.
 */
export const makeCloudFormationAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(options.tag)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map