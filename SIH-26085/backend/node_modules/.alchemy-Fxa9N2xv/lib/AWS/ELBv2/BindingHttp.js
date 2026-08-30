import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isInstance } from "../EC2/Instance.js";
import { isTask } from "../ECS/Task.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for ELBv2 HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation and the IAM action list is
 * boilerplate: the runtime callable injects the bound resource's ARN
 * (`TargetGroupArn` / `LoadBalancerArn`) into the request and the deploy-time
 * half grants `actions` on that ARN — or on `*` for `Describe*` actions,
 * which do not support resource-level permissions in ELBv2.
 *
 * Hosts: Lambda Functions plus self-registering compute (ECS Tasks and EC2
 * Instances registering themselves into a target group at boot).
 */
const bindHost = (tag, actions, resource, iamResource) => Effect.gen(function* () {
    if (!globalThis.__ALCHEMY_RUNTIME__) {
        const host = yield* Binding.Host;
        if (isBindingHost(host) || isTask(host) || isInstance(host)) {
            yield* host.bind `Allow(${host}, ${tag}(${resource}))`({
                policyStatements: [
                    {
                        Effect: "Allow",
                        Action: [...actions],
                        Resource: [iamResource === "*" ? "*" : iamResource],
                    },
                ],
            });
        }
    }
});
/**
 * Build the impl Effect for a target-group-addressed operation: the runtime
 * callable injects the bound {@link TargetGroup}'s ARN as `TargetGroupArn`;
 * the deploy-time half grants `actions` on the target-group ARN
 * (`"target-group"`, the default) or on `*` (`Describe*` actions do not
 * support resource-level permissions).
 */
export const makeTargetGroupHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (targetGroup) {
        const TargetGroupArn = yield* targetGroup.targetGroupArn;
        yield* bindHost(options.tag, options.actions, targetGroup, options.resource === "*"
            ? "*"
            : Output.interpolate `${targetGroup.targetGroupArn}`);
        return Effect.fn(`${options.tag}(${targetGroup.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                TargetGroupArn: yield* TargetGroupArn,
            });
        });
    });
});
/**
 * Build the impl Effect for a load-balancer-addressed operation: the runtime
 * callable injects the bound {@link LoadBalancer}'s ARN as `LoadBalancerArn`;
 * the deploy-time half grants `actions` on the load-balancer ARN
 * (`"load-balancer"`, the default) or on `*` (`Describe*` actions do not
 * support resource-level permissions).
 */
export const makeLoadBalancerHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (loadBalancer) {
        const LoadBalancerArn = yield* loadBalancer.loadBalancerArn;
        yield* bindHost(options.tag, options.actions, loadBalancer, options.resource === "*"
            ? "*"
            : Output.interpolate `${loadBalancer.loadBalancerArn}`);
        return Effect.fn(`${options.tag}(${loadBalancer.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                LoadBalancerArn: yield* LoadBalancerArn,
            });
        });
    });
});
/**
 * Build the impl Effect for a trust-store-addressed operation: the runtime
 * callable injects the bound {@link TrustStore}'s ARN as `TrustStoreArn`;
 * the deploy-time half grants `actions` on the trust-store ARN (mTLS
 * `GetTrustStore*` reads support resource-level permissions).
 */
export const makeTrustStoreHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (trustStore) {
        const TrustStoreArn = yield* trustStore.trustStoreArn;
        yield* bindHost(options.tag, options.actions, trustStore, Output.interpolate `${trustStore.trustStoreArn}`);
        return Effect.fn(`${options.tag}(${trustStore.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                TrustStoreArn: yield* TrustStoreArn,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map