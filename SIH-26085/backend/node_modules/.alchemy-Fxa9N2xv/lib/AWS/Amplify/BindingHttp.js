import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the init Effect of an Amplify app-scoped HTTP binding: resolves the
 * operation once at layer init, grants the IAM statement on the binding host
 * at deploy time, and returns a runtime callable that injects the bound app's
 * `appId` into every request.
 */
export const makeAmplifyHttpBinding = (options) => Effect.gen(function* () {
    const operation = yield* options.operation;
    return Effect.fn(function* (app) {
        const AppId = yield* app.appId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.Amplify.${options.name}(${app}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: options.actions,
                            Resource: options.resources(app),
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.Amplify.${options.name}(${app.LogicalId})`)(function* (request) {
            // Omit<I, "appId"> + the injected appId reconstructs I; TS cannot
            // prove that for a generic I, hence the assertion.
            return yield* operation({
                ...request,
                appId: yield* AppId,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map