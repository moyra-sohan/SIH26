/**
 * Shared scaffolding for EventBridge Pipes HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation and the IAM action list is
 * boilerplate:
 *
 * - Pipe-scoped operations (`pipes:DescribePipe`, `pipes:StartPipe`,
 *   `pipes:StopPipe`) inject the bound {@link Pipe}'s name as the request's
 *   `Name` field and are granted on the pipe ARN.
 * - Account-level operations (`pipes:ListPipes`) take the caller's request
 *   as-is and are granted on `*`.
 */
import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the impl Effect for a Pipes operation scoped to a {@link Pipe}: the
 * deploy-time half grants `actions` on the bound pipe's ARN, and the runtime
 * half injects the pipe's name as the request's `Name` field.
 */
export const makePipesHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (pipe) {
        const PipeName = yield* pipe.pipeName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${pipe}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [pipe.pipeArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${pipe.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                Name: yield* PipeName,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level Pipes operation (pipe listing).
 * The deploy-time half grants `actions` on `*` — these operations are not
 * scoped to a single pipe resource.
 */
export const makePipesAccountHttpBinding = (options) => Effect.gen(function* () {
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