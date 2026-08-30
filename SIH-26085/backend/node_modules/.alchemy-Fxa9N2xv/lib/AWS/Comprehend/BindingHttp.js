import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS Comprehend HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation and the IAM action list is
 * boilerplate: Comprehend's real-time detect APIs and async job APIs have no
 * resource-level IAM, so every grant is on `*`. The `Start*Job` operations
 * additionally inject the bound data-access role and a scoped `iam:PassRole`
 * grant.
 */
/**
 * Build the impl Effect for a Comprehend operation with no bound resource
 * (real-time detection, job describe/list/stop). The deploy-time half grants
 * `actions` on `*` — Comprehend detection and job IAM actions do not support
 * resource-level scoping.
 */
export const makeComprehendHttpBinding = (options) => Effect.gen(function* () {
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
/**
 * Build the impl Effect for a `Start*Job` operation: the binding is
 * constructed with the **data-access role** (the IAM role Amazon Comprehend
 * assumes to read input documents from S3 and write results; its trust
 * policy must allow `comprehend.amazonaws.com`). The role's ARN is injected
 * as `DataAccessRoleArn` on every runtime request, and the deploy-time half
 * grants `actions` on `*` plus `iam:PassRole` on the role — without the
 * PassRole grant, `Start*Job` fails only at runtime with an AccessDenied.
 */
export const makeComprehendStartJobHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (dataAccessRole) {
        const RoleArn = yield* dataAccessRole.roleArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${dataAccessRole}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: ["*"],
                        },
                        // CRITICAL: without iam:PassRole on the data-access role,
                        // Start*Job fails only at runtime with an AccessDenied.
                        {
                            Effect: "Allow",
                            Action: ["iam:PassRole"],
                            Resource: [Output.interpolate `${dataAccessRole.roleArn}`],
                            Condition: {
                                StringEquals: {
                                    "iam:PassedToService": "comprehend.amazonaws.com",
                                },
                            },
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${dataAccessRole.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                DataAccessRoleArn: request.DataAccessRoleArn ?? (yield* RoleArn),
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map