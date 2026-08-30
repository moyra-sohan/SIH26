import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared HTTP scaffolding for the Textract runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation and the IAM action is
 * boilerplate.
 *
 * Textract's document analysis actions (sync `Analyze*`/`Detect*` and the
 * async `Start*`/`Get*` job APIs) have no resource-level IAM, so the
 * account-level builder grants on `*`. The adapter management actions
 * authorize on the adapter / adapter-version resource types, which use
 * Textract's nonstandard leading-slash ARN path
 * (`arn:aws:textract:{region}:{account}:/adapters/{adapterId}`), so the
 * adapter-scoped builder grants on the bound adapter's ARN and its
 * `/versions/*` children.
 */
export const makeTextractHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.Textract.${options.capability}())`({
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
        return Effect.fn(`AWS.Textract.${options.capability}`)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
/**
 * Build the impl Effect for an adapter-scoped Textract operation: the
 * binding is constructed with an {@link Adapter}, the deploy-time half
 * grants `iamActions` on the adapter's ARN (and its `/versions/*`
 * children), and the runtime callable injects the adapter's `AdapterId`
 * into every request.
 */
export const makeTextractAdapterHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (adapter) {
        const AdapterId = yield* adapter.adapterId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.Textract.${options.capability}(${adapter}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.iamActions],
                            Resource: [
                                Output.interpolate `${adapter.adapterArn}`,
                                Output.interpolate `${adapter.adapterArn}/versions/*`,
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.Textract.${options.capability}(${adapter.LogicalId})`)(function* (request) {
            return yield* op({
                ...(request ?? {}),
                AdapterId: yield* AdapterId,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map