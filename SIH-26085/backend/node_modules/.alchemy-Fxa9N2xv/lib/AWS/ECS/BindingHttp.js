import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
import { isTask } from "./Task.js";
/**
 * Shared scaffolding for AWS ECS HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the three
 * builders below. Everything except the operation, the IAM action list, and
 * the IAM resource scope is boilerplate.
 *
 * ECS scopes cluster-addressed actions against sub-resource ARNs derived
 * from the cluster ARN — `arn:…:task/{clusterName}/*`,
 * `arn:…:service/{clusterName}/*`, `arn:…:container-instance/{clusterName}/*`
 * — or, for list actions with no usable resource type on Fargate, against
 * `*` conditioned on the bound cluster.
 */
/**
 * `iam:PassRole` pre-typed as `string[]` (a declared alternative of
 * `PolicyStatement.Action`). A fresh literal array at the `host.bind` call
 * site would be contextually typed against `Input<IamAction[] | string[]>`
 * across the `Function | Task` host union, forcing normalization of the
 * ~18k-literal `IamAction` union and tripping TS2590 ("union type too
 * complex") under TypeScript 7.
 */
const passRoleActions = ["iam:PassRole"];
const clusterSubresourcePattern = (cluster, kind) => Output.map(cluster.clusterArn, (arn) => `${arn.replace(":cluster/", `:${kind}/`)}/*`);
const clusterIamResources = (cluster, resources) => resources.map((kind) => kind === "cluster"
    ? Output.interpolate `${cluster.clusterArn}`
    : clusterSubresourcePattern(cluster, kind));
/**
 * Build the impl Effect for a cluster-addressed operation whose request
 * carries a `cluster` field: the runtime callable injects the bound
 * {@link Cluster}'s ARN and the deploy-time half grants `actions` on the
 * requested `resources` scopes (or on `*` conditioned on the bound cluster
 * when `resources` is `"cluster-condition"` — for list actions that have no
 * usable resource type on Fargate).
 */
export const makeEcsClusterHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (cluster) {
        const ClusterArn = yield* cluster.clusterArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host) || isTask(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${cluster}))`({
                    policyStatements: [
                        options.resources === "cluster-condition"
                            ? {
                                Effect: "Allow",
                                Action: [...options.actions],
                                Resource: ["*"],
                                Condition: {
                                    ArnEquals: { "ecs:cluster": cluster.clusterArn },
                                },
                            }
                            : {
                                Effect: "Allow",
                                Action: [...options.actions],
                                Resource: clusterIamResources(cluster, options.resources),
                            },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${cluster.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                cluster: yield* ClusterArn,
            });
        });
    });
});
/**
 * Strip the revision suffix from a task-definition ARN. The bound
 * `taskDefinitionArn` attribute pins whatever revision existed when the
 * HOST was reconciled — for a circularly-bound task that is the pre-create
 * STUB revision, not the real one registered afterwards. Launching by
 * family makes ECS resolve the latest ACTIVE revision, which is the
 * binding's intended semantics (like invoking a Lambda by name).
 */
const revisionlessTaskDefinitionArn = (arn) => arn.replace(/:\d+$/, "");
/** The task-definition family name from its (possibly revisioned) ARN. */
const taskDefinitionFamilyOf = (arn) => revisionlessTaskDefinitionArn(arn).split("/").pop();
/**
 * Build the impl Effect for a task-launch operation (`RunTask`/`StartTask`):
 * the runtime callable injects the bound {@link Cluster}'s ARN as `cluster`
 * and the bound {@link Task}'s definition family (revision-less ARN) as
 * `taskDefinition`; the deploy-time half grants `actions` on every revision
 * of the task definition plus `iam:PassRole` on the task and execution
 * roles.
 */
export const makeEcsTaskLaunchHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (cluster, task) {
        const ClusterArn = yield* cluster.clusterArn;
        const TaskDefinitionArn = yield* task.taskDefinitionArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host) || isTask(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${cluster}, ${task}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            // All revisions: the launch resolves the latest ACTIVE
                            // revision, which may be registered after this grant.
                            Resource: [
                                Output.map(task.taskDefinitionArn, (arn) => `${revisionlessTaskDefinitionArn(arn)}:*`),
                            ],
                        },
                        {
                            Effect: "Allow",
                            Action: passRoleActions,
                            Resource: [task.taskRoleArn, task.executionRoleArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${cluster.LogicalId}, ${task.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                cluster: yield* ClusterArn,
                // Family, not the pinned ARN: resolves the latest ACTIVE revision.
                taskDefinition: taskDefinitionFamilyOf(yield* TaskDefinitionArn),
            });
        });
    });
});
const serviceIamResources = (service, resources) => resources.map((kind) => kind === "service"
    ? Output.interpolate `${service.serviceArn}`
    : Output.map(service.serviceArn, (arn) => `${arn.replace(":service/", `:${kind}/`)}/*`));
/**
 * Build the impl Effect for a service-addressed operation (deployment
 * observation and blue/green lifecycle-hook control). The deploy-time half
 * grants `actions` on the requested scopes derived from the bound
 * {@link Service}'s ARN. When `inject` is set, the runtime callable injects
 * the service ARN as `service` and the cluster ARN as `cluster`; otherwise
 * the request passes through as-is (deployment/revision ARNs are only known
 * at runtime).
 */
export const makeEcsServiceHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (service) {
        const ServiceArn = yield* service.serviceArn;
        const ClusterArn = yield* service.clusterArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host) || isTask(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${service}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: serviceIamResources(service, options.resources),
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${service.LogicalId})`)(function* (request) {
            return yield* op((options.inject
                ? {
                    ...request,
                    service: yield* ServiceArn,
                    cluster: yield* ClusterArn,
                }
                : request));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map