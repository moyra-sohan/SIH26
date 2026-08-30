import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the AWS Resource Groups HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two builders
 * below. Everything except the operation, the IAM action list, and (for
 * group-scoped operations) the injected group identifier is boilerplate.
 */
/**
 * Build the impl Effect for a Resource Groups operation scoped to a
 * {@link Group}: the deploy-time half grants `actions` on the bound group's
 * ARN (plus any `supportingActions` on `*` — e.g. the Resource Groups
 * Tagging API / CloudFormation read-through permissions that member
 * enumeration fans out to), and the runtime half injects the group's name
 * into every request as `Group`.
 */
export const makeResourceGroupsGroupHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (group) {
        const GroupName = yield* group.groupName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const supporting = options.supportingActions !== undefined
                    ? [
                        {
                            Effect: "Allow",
                            Action: [...options.supportingActions],
                            // Member resources are arbitrary ARNs chosen per request.
                            Resource: ["*"],
                        },
                    ]
                    : [];
                yield* host.bind `Allow(${host}, ${options.tag}(${group}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [group.groupArn],
                        },
                        ...supporting,
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${group.LogicalId})`)(function* (request) {
            const groupName = yield* GroupName;
            return yield* op({ ...request, Group: groupName });
        });
    });
});
/**
 * Build the impl Effect for an account-level Resource Groups operation
 * (search, account settings, tag-sync task audit). The deploy-time half
 * grants `actions` on `*` — the targets (queries, task ARNs) are chosen per
 * request at runtime and unknowable at deploy time.
 */
export const makeResourceGroupsAccountHttpBinding = (options) => Effect.gen(function* () {
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