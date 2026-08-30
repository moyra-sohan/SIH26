import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the implementation effect for a resource-scoped capability: the
 * runtime callable injects the bound resource's identifier ARN as the
 * request's `requestKey` field, and the deploy-time half grants `iamActions`
 * on the resource's ARN.
 */
export const makeControlTowerHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (resource) {
        const Identifier = yield* options.identifier(resource);
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.ControlTower.${options.capability}(${resource}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.iamActions],
                            Resource: [options.identifier(resource)],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.ControlTower.${options.capability}(${resource.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                [options.requestKey]: yield* Identifier,
            });
        });
    });
});
/**
 * Build the implementation effect for an account-level capability (no
 * resource argument — the baseline catalog, list, and operation-status
 * APIs). The deploy-time half grants `iamActions` on `Resource: ["*"]`
 * because these operations are not resource-scoped.
 */
export const makeControlTowerAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.ControlTower.${options.capability}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.iamActions],
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.ControlTower.${options.capability}`)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map