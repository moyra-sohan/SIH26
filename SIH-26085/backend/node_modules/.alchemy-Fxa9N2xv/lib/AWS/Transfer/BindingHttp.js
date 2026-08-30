import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the AWS Transfer Family runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, makeTransfer…HttpBinding({ … }))` over one of the
 * three builders below. Everything except the operation, the IAM action
 * list, and the injected identifier(s) is boilerplate.
 */
/**
 * Build the impl Effect for a server-scoped Transfer operation: the runtime
 * callable injects the bound {@link Server}'s ID as `ServerId` and the
 * deploy-time half grants `actions` on the server's ARN.
 */
export const makeTransferServerHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (server) {
        // Outputs yield a DEFERRED effect — resolve again per invocation below.
        const ServerId = yield* server.serverId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${server}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                options.resource?.(server) ??
                                    Output.interpolate `${server.arn}`,
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${server.LogicalId})`)(function* (request) {
            return yield* op({ ...request, ServerId: yield* ServerId });
        });
    });
});
/**
 * Build the impl Effect for a user-scoped Transfer operation: the runtime
 * callable injects the bound {@link User}'s `ServerId` + `UserName` and the
 * deploy-time half grants `actions` on the user's ARN
 * (`arn:…:user/{serverId}/{userName}`).
 */
export const makeTransferUserHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (user) {
        // Outputs yield a DEFERRED effect — resolve again per invocation below.
        const ServerId = yield* user.serverId;
        const UserName = yield* user.userName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${user}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${user.arn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${user.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                ServerId: yield* ServerId,
                UserName: yield* UserName,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level Transfer operation (no
 * resource argument): the deploy-time half grants `actions` on `*`. Used
 * for operations that authorize against ARNs unknowable at deploy time
 * (e.g. `SendWorkflowStepState` authorizes on the workflow's own ARN, and
 * the workflow/execution ids arrive at runtime inside the step event).
 */
export const makeTransferAccountHttpBinding = (options) => Effect.gen(function* () {
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
            return yield* op(request);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map