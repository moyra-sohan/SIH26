import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the impl Effect for a single-operation AgentCore data-plane binding.
 * The runtime callable injects the resolved `identifier` as the request's
 * `requestKey` field; the deploy-time half grants `actions` on `arns`.
 */
export const makeAgentCoreHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (resource) {
        const Identifier = yield* options.identifier(resource);
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${resource}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [...options.arns(resource)],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${resource.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                [options.requestKey]: yield* Identifier,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map