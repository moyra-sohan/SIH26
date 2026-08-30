import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Amazon Security Lake HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, makeSecurityLakeDataLakeHttpBinding({ … }))` over the
 * builder below. Everything except the operation and the IAM action list is
 * boilerplate.
 */
/**
 * Build the impl Effect for a Security Lake operation scoped to the account's
 * {@link DataLake}: the deploy-time half grants `actions` on the bound data
 * lake's ARN, and the runtime half invokes the operation with the caller's
 * request as-is (Security Lake's monitoring operations take no resource
 * parameter — the data lake is implicit in the account/Region).
 */
export const makeSecurityLakeDataLakeHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (lake) {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${lake}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [lake.dataLakeArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${lake.LogicalId})`)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map