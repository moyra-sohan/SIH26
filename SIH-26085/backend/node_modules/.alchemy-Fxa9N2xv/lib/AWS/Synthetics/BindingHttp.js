import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for CloudWatch Synthetics HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation and the IAM action is
 * boilerplate:
 *
 * - {@link makeSyntheticsCanaryHttpBinding} — operations scoped to one bound
 *   {@link Canary} (`GetCanary`, `GetCanaryRuns`, `StartCanary`,
 *   `StopCanary`). The runtime callable injects the canary's name as the
 *   request's `Name`; the deploy-time half grants `actions` on the canary
 *   ARN.
 * - {@link makeSyntheticsAccountHttpBinding} — account-level operations
 *   (`DescribeCanariesLastRun`), granted on `*`.
 */
/**
 * Build the impl Effect for an operation scoped to a single bound
 * {@link Canary}. The runtime callable injects the canary's name as the
 * request's `Name`; the deploy-time half grants `actions` on the canary ARN.
 */
export const makeSyntheticsCanaryHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (canary) {
        const Name = yield* canary.canaryName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${canary}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [canary.canaryArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${canary.LogicalId})`)(function* (request) {
            return yield* op({ ...request, Name: yield* Name });
        });
    });
});
/**
 * Build the impl Effect for an account-level Synthetics operation. The
 * runtime callable passes the caller's request through unchanged; the
 * deploy-time half grants `actions` on `*` (account-level reads such as
 * `DescribeCanariesLastRun` are not resource-addressable).
 */
export const makeSyntheticsAccountHttpBinding = (options) => Effect.gen(function* () {
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