import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the CloudWatch investigations (AIOps) HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two builders
 * below. Everything except the operation, the IAM action list, and (for
 * group-scoped ops) how the group's ARN maps onto the request is boilerplate.
 */
/**
 * Build the impl Effect for an AIOps operation scoped to an
 * {@link InvestigationGroup}: the deploy-time half grants `actions` on the
 * bound group's ARN, and the runtime half injects the group's ARN into the
 * request via `input`. All group-scoped AIOps read requests consist solely of
 * the group identifier, so the runtime callable takes no arguments.
 */
export const makeAIOpsGroupHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (group) {
        const Arn = yield* group.arn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${group}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [group.arn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${group.LogicalId})`)(function* () {
            const arn = yield* Arn;
            return yield* op(options.input(arn));
        });
    });
});
/**
 * Build the impl Effect for an account-level AIOps operation (enumerating
 * the Region's investigation groups). The deploy-time half grants `actions`
 * on `*` — `aiops:ListInvestigationGroups` is a list action that is not
 * scoped to a single group resource.
 */
export const makeAIOpsAccountHttpBinding = (options) => Effect.gen(function* () {
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