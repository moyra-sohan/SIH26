import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared HTTP scaffolding for the geo-places runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, makeGeoPlacesHttpBinding({ … }))` over the builder
 * below. Everything except the operation and the IAM action is boilerplate.
 *
 * geo-places is a standalone, pay-per-call Amazon Location API with no
 * resource to manage: every action authorizes account-wide through the
 * singleton `provider/default`, so the builder always grants on
 * `Resource: ["*"]` and the capability takes no arguments.
 */
export const makeGeoPlacesHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.GeoPlaces.${options.capability}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.iamActions],
                            // geo-places is a standalone, account-wide pay-per-call API
                            // scoped through the singleton `provider/default`; the
                            // operations have no per-resource ARN.
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.GeoPlaces.${options.capability}`)(function* (request) {
            return yield* op(request);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map