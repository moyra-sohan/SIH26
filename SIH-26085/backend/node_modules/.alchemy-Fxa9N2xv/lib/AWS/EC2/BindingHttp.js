import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
import { isInstance } from "./Instance.js";
/**
 * Shared scaffolding for EC2 HTTP bindings.
 *
 * NOT exported from `index.ts` — every single-operation `{Op}Http.ts` in this
 * service is a thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of
 * the three builders below (one per bound resource kind). Everything except
 * the operation, the IAM action list, and the injected identifier is
 * boilerplate. Genuinely-different bindings (custom response shaping like
 * `DescribeInstance`) stay bespoke.
 */
/**
 * Build the impl Effect for an operation scoped to a bound {@link Instance}.
 * The runtime callable injects the instance id (as the scalar `InstanceId` or
 * the single-element `InstanceIds` array, per `requestKey`) and the
 * deploy-time half grants `actions` on the instance ARN — or on `*` for
 * `Describe*` actions, which do not support resource-level permissions.
 */
export const makeInstanceHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (instance) {
        const instanceId = yield* instance.instanceId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host) || isInstance(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${instance}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.resource === "*"
                                ? ["*"]
                                : [Output.interpolate `${instance.instanceArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${instance.LogicalId})`)(function* (request) {
            const id = yield* instanceId;
            return yield* op({
                ...request,
                [options.requestKey]: options.requestKey === "InstanceIds" ? [id] : id,
            });
        });
    });
});
/**
 * Build the impl Effect for an operation scoped to a bound
 * {@link SecurityGroup}. The runtime callable injects the group id as
 * `GroupId` and the deploy-time half grants `actions` on the security group
 * ARN.
 */
export const makeSecurityGroupHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (group) {
        const groupId = yield* group.groupId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host) || isInstance(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${group}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${group.groupArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${group.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                GroupId: yield* groupId,
            });
        });
    });
});
/**
 * Build the impl Effect for an operation scoped to a bound {@link Volume}.
 * The runtime callable injects the volume id as `VolumeId` and the
 * deploy-time half grants `actions` on the volume ARN plus any
 * `extraResources` (e.g. the region-wide snapshot wildcard `CreateSnapshot`
 * also authorizes against).
 */
export const makeVolumeHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (volume) {
        const volumeId = yield* volume.volumeId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host) || isInstance(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${volume}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `${volume.volumeArn}`,
                                ...(options.extraResources ?? []),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${volume.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                VolumeId: yield* volumeId,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map