/**
 * Shared HTTP-binding scaffolding for AppConfig capabilities.
 *
 * INTERNAL — deliberately NOT exported from `index.ts`. Each `{Op}Http.ts`
 * is a thin call to {@link makeAppConfigHttpBinding}; everything except the
 * operation, the identifier resolvers, and the IAM grant is boilerplate:
 * resolve the bound resources' identifiers (which also registers them on the
 * host's environment), register the IAM policy statement on the binding host
 * (skipped inside the deployed function), and return the traced runtime
 * client that merges the identifiers into each wire request.
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Binding from "../../Binding.js";
import { AWSEnvironment } from "../Environment.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the `Layer.effect` for an AppConfig HTTP binding from its three
 * distinguishing parts: the distilled operation, the identifier resolvers,
 * and the IAM grant.
 */
export const makeAppConfigHttpBinding = (service, options) => Layer.effect(service, Effect.gen(function* () {
    const operation = yield* options.operation;
    return Effect.fn(function* (...args) {
        const { identifiers, iam } = options.spec(...args);
        const label = args
            .map((arg) => arg.LogicalId)
            .join(", ");
        // Outputs yield DEFERRED effects — resolving them here registers the
        // attributes on the host environment; re-yield per invocation below.
        const resolved = [];
        for (const [key, output] of Object.entries(identifiers)) {
            resolved.push([key, yield* output]);
        }
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const { accountId, region } = yield* AWSEnvironment.current;
                const { actions, resources } = iam({ accountId, region });
                yield* host.bind(`Allow(${host.LogicalId}, ${service.key}(${label}))`, {
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: actions,
                            Resource: resources,
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${service.key}(${label})`)(function* (request) {
            const ids = {};
            for (const [key, effect] of resolved) {
                ids[key] = yield* effect;
            }
            return yield* operation({ ...request, ...ids });
        });
    });
}));
//# sourceMappingURL=BindingHttp.js.map