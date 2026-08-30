import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS Elemental MediaConnect HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service
 * is a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation and the IAM action list
 * is boilerplate: flow-scoped bindings inject the bound flow's ARN as the
 * request's `FlowArn` and grant `actions` on that ARN; account-scoped
 * bindings pass the request through and grant `actions` on `*`.
 */
/**
 * Build the impl Effect for a MediaConnect operation scoped to a
 * {@link Flow}: the deploy-time half grants `actions` on the bound flow's
 * ARN (plus any `extraResources` — e.g. the entitlement wildcard for
 * Grant/RevokeFlowEntitlement, whose IAM resource types are both the flow
 * AND the entitlement, a sibling ARN not derived from the flow ARN), and
 * the runtime half injects the flow's ARN into every request as `FlowArn`.
 */
export const makeMediaConnectFlowHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (flow) {
        const FlowArn = yield* flow.flowArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${flow}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [flow.flowArn, ...(options.extraResources ?? [])],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${flow.LogicalId})`)(function* (request) {
            const flowArn = yield* FlowArn;
            return yield* op({ ...request, FlowArn: flowArn });
        });
    });
});
/**
 * Build the impl Effect for an account-level MediaConnect operation (e.g.
 * enumerating the account's flows or granted entitlements). The
 * deploy-time half grants `actions` on `*` — these list operations are
 * not scoped to a single flow resource.
 */
export const makeMediaConnectAccountHttpBinding = (options) => Effect.gen(function* () {
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