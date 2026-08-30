import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for IoT Greengrass V2 HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the three
 * builders below. Everything except the operation and the IAM action list is
 * boilerplate.
 */
/**
 * Build the impl Effect for a Greengrass V2 operation scoped to a
 * {@link ComponentVersion}: the deploy-time half grants `actions` on the
 * bound component version's ARN, and the runtime half injects the component
 * version's `arn` into every request.
 */
export const makeGreengrassComponentHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (component) {
        const Arn = yield* component.arn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${component}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [component.arn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${component.LogicalId})`)(function* (request) {
            const arn = yield* Arn;
            return yield* op({ ...request, arn });
        });
    });
});
/**
 * Build the impl Effect for a Greengrass V2 operation scoped to a
 * {@link Deployment}: the deploy-time half grants `actions` on the bound
 * deployment's ARN, and the runtime half injects the `deploymentId` into
 * every request.
 */
export const makeGreengrassDeploymentHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (deployment) {
        const DeploymentId = yield* deployment.deploymentId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${deployment}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [deployment.deploymentArn],
                        },
                        ...(options.dependentActions !== undefined &&
                            options.dependentActions.length > 0
                            ? [
                                {
                                    Effect: "Allow",
                                    Action: [...options.dependentActions],
                                    Resource: ["*"],
                                },
                            ]
                            : []),
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${deployment.LogicalId})`)(function* (request) {
            const deploymentId = yield* DeploymentId;
            return yield* op({ ...request, deploymentId });
        });
    });
});
/**
 * Build the impl Effect for an account-level Greengrass V2 operation (listing
 * components/deployments/core devices, core-device data-plane calls keyed by
 * a thing name the caller supplies at runtime). The deploy-time half grants
 * `actions` on `*` — core devices register themselves and are not modeled as
 * Alchemy resources, so there is no resource ARN to scope down to.
 */
export const makeGreengrassAccountHttpBinding = (options) => Effect.gen(function* () {
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