import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the impl Effect for an environment-scoped MWAA operation: the runtime
 * callable injects the bound {@link Environment}'s name as `Name` and the
 * deploy-time half grants `actions` on the environment ARN.
 */
export const makeMWAAEnvironmentHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (environment) {
        const Name = yield* environment.environmentName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${environment}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${environment.arn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${environment.LogicalId})`)(function* (request) {
            return yield* op({ ...request, Name: yield* Name });
        });
    });
});
/**
 * Build the impl Effect for an Airflow-RBAC-role-scoped MWAA operation
 * (`CreateWebLoginToken`, `InvokeRestApi`): the runtime callable injects the
 * bound {@link Environment}'s name as `Name` and the deploy-time half grants
 * `actions` on the Airflow role ARN
 * `arn:{partition}:airflow:{region}:{account}:role/{name}/{airflowRole}` —
 * MWAA maps the function's IAM identity to that Apache Airflow RBAC role
 * (default `Admin`).
 */
export const makeMWAAAirflowRoleHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (environment, roleOptions) {
        const Name = yield* environment.environmentName;
        const airflowRole = roleOptions?.airflowRole ?? "Admin";
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${environment}, ${airflowRole}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            // The environment ARN is
                            // `arn:{partition}:airflow:{region}:{account}:environment/{name}`;
                            // the Airflow RBAC role ARN swaps the resource type and
                            // appends the role.
                            Resource: [
                                environment.arn.pipe(Output.map((arn) => `${arn.replace(":environment/", ":role/")}/${airflowRole}`)),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${environment.LogicalId})`)(function* (request) {
            return yield* op({ ...request, Name: yield* Name });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map