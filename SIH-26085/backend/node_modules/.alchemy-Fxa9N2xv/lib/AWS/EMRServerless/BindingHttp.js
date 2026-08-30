import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the Amazon EMR Serverless HTTP bindings.
 *
 * Every EMR Serverless data-plane operation is addressed by an
 * `applicationId`, so every binding is scoped to a bound {@link Application}:
 * the deploy-time half grants `actions` on the application's ARN (plus any
 * `subresources` wildcards — job runs and sessions are authorized against
 * `{applicationArn}/jobruns/*` / `{applicationArn}/sessions/*` sub-resource
 * ARNs), and the runtime half injects the application's id into every
 * request. Operations that hand the service an execution role to assume
 * (`StartJobRun`, `StartSession`) additionally grant `iam:PassRole`
 * conditioned to `emr-serverless.amazonaws.com`.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, makeEmrServerlessHttpBinding({ … }))`.
 */
export const makeEmrServerlessHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (application) {
        // Outputs yield a DEFERRED effect — resolve again per invocation below.
        const ApplicationId = yield* application.applicationId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const passRoleStatements = options.passRole
                    ? [
                        {
                            Effect: "Allow",
                            Action: ["iam:PassRole"],
                            Resource: ["*"],
                            Condition: {
                                StringEquals: {
                                    "iam:PassedToService": "emr-serverless.amazonaws.com",
                                },
                            },
                        },
                    ]
                    : [];
                yield* host.bind `Allow(${host}, ${options.tag}(${application}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `${application.applicationArn}`,
                                ...(options.subresources ?? []).map((suffix) => Output.interpolate `${application.applicationArn}${suffix}`),
                            ],
                        },
                        ...passRoleStatements,
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${application.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                applicationId: yield* ApplicationId,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map