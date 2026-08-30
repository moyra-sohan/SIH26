import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the AWS Signer HTTP runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation and the IAM action list is
 * boilerplate.
 *
 * Signer authorizes profile-addressed actions against the *signing profile*
 * ARN (`arn:…:/signing-profiles/name`) and its version-qualified variant
 * (`arn:…:/signing-profiles/name/version`), so the profile-scoped builder
 * grants on both. Job-addressed actions (describe/list/revoke a signing job)
 * target job ids chosen per request at runtime, so those bindings are
 * account-level and grant on `Resource: ["*"]`.
 */
const profilePolicyStatement = (profile, actions) => ({
    Effect: "Allow",
    Action: [...actions],
    Resource: [
        Output.interpolate `${profile.arn}`,
        // The version-qualified profile ARN (`…/signing-profiles/name/version`).
        Output.map(profile.arn, (arn) => `${arn}/*`),
    ],
});
/**
 * Build the impl Effect for an operation whose input carries a `profileName`
 * field: the runtime callable injects the bound {@link SigningProfile}'s name
 * and the deploy-time half grants `actions` on the profile ARN (and its
 * version-qualified pattern).
 */
export const makeSignerProfileHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (profile) {
        // Outputs yield a DEFERRED effect — resolve again per invocation below.
        const ProfileName = yield* profile.profileName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${profile}))`({
                    policyStatements: [
                        profilePolicyStatement(profile, options.actions),
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${profile.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                profileName: yield* ProfileName,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level Signer operation (signing jobs
 * are addressed by runtime-chosen job ids; platforms are AWS-managed read-only
 * catalog entries): the binding takes no resource argument and the deploy-time
 * half grants `actions` on `Resource: ["*"]`.
 */
export const makeSignerHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const policyStatements = [
                    {
                        Effect: "Allow",
                        Action: [...options.actions],
                        Resource: ["*"],
                    },
                ];
                yield* host.bind `Allow(${host}, ${options.tag}())`({
                    policyStatements,
                });
            }
        }
        return Effect.fn(options.tag)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map