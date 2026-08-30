import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the impl Effect for an account-level AWS Config operation. The
 * runtime callable passes the caller's request through unchanged; the
 * deploy-time half grants `actions` on `*`.
 */
export const makeConfigAccountHttpBinding = (options) => Effect.gen(function* () {
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
/**
 * Build the impl Effect for an operation scoped to a single bound Config
 * resource ({@link ConfigRule} or {@link DeliveryChannel}). The runtime
 * callable injects the resolved `identifier` under `requestKey` (wrapped in
 * a single-element array when `asList` is set, e.g.
 * `StartConfigRulesEvaluation`'s `ConfigRuleNames`); the deploy-time half
 * grants `actions` on `*` (Config actions are not resource-scoped in IAM).
 */
export const makeConfigResourceHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (resource) {
        const identifier = yield* options.identifier(resource);
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${resource}))`({
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
        return Effect.fn(`${options.tag}(${resource.LogicalId})`)(function* (request) {
            const input = { ...request };
            const id = yield* identifier;
            input[options.requestKey] = options.asList ? [id] : id;
            return yield* op(input);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map