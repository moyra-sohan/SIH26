import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared HTTP scaffolding for the AWS Elemental MediaConvert runtime
 * bindings.
 *
 * MediaConvert jobs are created *at runtime* with server-assigned ids, so
 * their ARNs are unknowable at deploy time — every binding is account-level
 * and grants its action(s) on `Resource: ["*"]`. The only variation between
 * bindings is the distilled operation, the IAM action, and whether the
 * operation passes an S3-access role to the service (`CreateJob`, which
 * additionally needs `iam:PassRole` conditioned to
 * `mediaconvert.amazonaws.com`).
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, makeMediaConvertHttpBinding({ … }))`.
 */
export const makeMediaConvertHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const policyStatements = [
                    {
                        Effect: "Allow",
                        Action: [...options.iamActions],
                        // Job ARNs are server-assigned at runtime; queue/preset/template
                        // references inside a job are resolved by the service.
                        Resource: ["*"],
                    },
                ];
                if (options.passRole) {
                    policyStatements.push({
                        Effect: "Allow",
                        Action: ["iam:PassRole"],
                        Resource: ["*"],
                        Condition: {
                            StringEquals: {
                                "iam:PassedToService": "mediaconvert.amazonaws.com",
                            },
                        },
                    });
                }
                yield* host.bind `Allow(${host}, AWS.MediaConvert.${options.capability}())`({ policyStatements });
            }
        }
        return Effect.fn(`AWS.MediaConvert.${options.capability}`)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map