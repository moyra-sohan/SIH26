import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared HTTP scaffolding for the AWS Resource Explorer runtime bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service
 * is a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation and the IAM action list
 * is boilerplate.
 */
/**
 * Build the impl Effect for a Resource Explorer operation scoped to a
 * {@link View}: the deploy-time half grants `actions` on the bound view's
 * ARN, and the runtime half injects the view's `ViewArn` into every
 * request.
 */
export const makeResourceExplorerViewHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (view) {
        const ViewArn = yield* view.viewArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${view}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [view.viewArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${view.LogicalId})`)(function* (request) {
            const viewArn = yield* ViewArn;
            return yield* op({ ...request, ViewArn: viewArn });
        });
    });
});
/**
 * Build the impl Effect for an account-level Resource Explorer operation
 * (e.g. enumerating the searchable resource types). The deploy-time half
 * grants `actions` on `*` — these operations are not scoped to a single
 * Resource Explorer resource.
 */
export const makeResourceExplorerAccountHttpBinding = (options) => Effect.gen(function* () {
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