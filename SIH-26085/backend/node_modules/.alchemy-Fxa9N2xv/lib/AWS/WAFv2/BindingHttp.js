import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
import { withWafScope } from "./internal.js";
/**
 * Build the impl Effect for an operation scoped to a single bound
 * {@link WebACL}. `inject` maps the resolved web ACL identifiers onto the
 * request fields the operation expects; the deploy-time half grants
 * `actions` on the web ACL ARN.
 */
export const makeWafv2WebAclHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (webAcl) {
        const Arn = yield* webAcl.webAclArn;
        const Name = yield* webAcl.webAclName;
        const Id = yield* webAcl.webAclId;
        const Scope = yield* webAcl.scope;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${webAcl}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [webAcl.webAclArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${webAcl.LogicalId})`)(function* (request) {
            const resolved = {
                arn: yield* Arn,
                name: yield* Name,
                id: yield* Id,
                scope: yield* Scope,
            };
            return yield* withWafScope(resolved.scope, op({ ...request, ...options.inject(resolved) }));
        });
    });
});
/**
 * Build the impl Effect for an operation scoped to a single bound
 * {@link IPSet}: the runtime callable injects the IP set's `Name`, `Scope`,
 * and `Id`; the deploy-time half grants `actions` on the IP set ARN.
 * CLOUDFRONT-scoped IP sets are pinned to `us-east-1` automatically.
 */
export const makeWafv2IPSetHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (ipSet) {
        const Name = yield* ipSet.ipSetName;
        const Id = yield* ipSet.ipSetId;
        const Scope = yield* ipSet.scope;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${ipSet}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [ipSet.ipSetArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${ipSet.LogicalId})`)(function* (request) {
            const scope = yield* Scope;
            return yield* withWafScope(scope, op({
                ...request,
                Name: yield* Name,
                Scope: scope,
                Id: yield* Id,
            }));
        });
    });
});
/**
 * Build the impl Effect for an operation keyed by a bound {@link RuleGroup}
 * ARN (the permission-policy interface): the runtime callable injects the
 * rule group's ARN as `ResourceArn`; the deploy-time half grants `actions`
 * on the rule group ARN. CLOUDFRONT-scoped rule groups are pinned to
 * `us-east-1` automatically.
 */
export const makeWafv2RuleGroupHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (ruleGroup) {
        const Arn = yield* ruleGroup.ruleGroupArn;
        const Scope = yield* ruleGroup.scope;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${ruleGroup}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [ruleGroup.ruleGroupArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${ruleGroup.LogicalId})`)(function* (request) {
            return yield* withWafScope(yield* Scope, op({ ...request, ResourceArn: yield* Arn }));
        });
    });
});
/**
 * Build the impl Effect for an account-level WAFv2 operation (API keys,
 * capacity checks, managed rule group catalog reads): the caller's request
 * passes through unchanged and the deploy-time half grants `actions` on
 * `*` (these operations authorize account-wide, not against a resource
 * ARN). A request with `Scope: "CLOUDFRONT"` is pinned to `us-east-1`.
 */
export const makeWafv2AccountHttpBinding = (options) => Effect.gen(function* () {
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
            const input = (request ?? {});
            const scope = input.Scope === "CLOUDFRONT"
                ? "CLOUDFRONT"
                : "REGIONAL";
            return yield* withWafScope(scope, op(input));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map