import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
import { withGaRegion } from "./common.js";
/**
 * Shared scaffolding for AWS Global Accelerator HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two builders
 * below. Everything except the operation and the IAM action list is
 * boilerplate.
 *
 * The Global Accelerator control-plane API only exists in us-west-2, so the
 * operation is resolved under {@link withGaRegion} — the binding works no
 * matter which region the host Function is deployed to.
 */
/**
 * Build the impl Effect for a Global Accelerator operation scoped to an
 * {@link Accelerator}: the deploy-time half grants `actions` on the bound
 * accelerator's ARN, and the runtime half injects the accelerator's
 * `AcceleratorArn` into every request.
 */
export const makeGaAcceleratorHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* withGaRegion(options.operation);
    return Effect.fn(function* (accelerator) {
        const AcceleratorArn = yield* accelerator.acceleratorArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${accelerator}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [accelerator.acceleratorArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${accelerator.LogicalId})`)(function* (request) {
            const acceleratorArn = yield* AcceleratorArn;
            // The region must also be pinned at the call site: the yield-time
            // snapshot is only a fallback — the calling fiber's ambient Region
            // (the host Function's own region) wins over it.
            return yield* withGaRegion(op({ ...request, AcceleratorArn: acceleratorArn }));
        });
    });
});
/**
 * Build the impl Effect for a Global Accelerator operation scoped to an
 * {@link EndpointGroup}: the deploy-time half grants `actions` on the bound
 * endpoint group's ARN, and the runtime half injects the group's
 * `EndpointGroupArn` into every request.
 */
export const makeGaEndpointGroupHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* withGaRegion(options.operation);
    return Effect.fn(function* (endpointGroup) {
        const EndpointGroupArn = yield* endpointGroup.endpointGroupArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${endpointGroup}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [endpointGroup.endpointGroupArn],
                        },
                        ...(options.extraStatements ?? []),
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${endpointGroup.LogicalId})`)(function* (request) {
            const endpointGroupArn = yield* EndpointGroupArn;
            // Call-site region pin — see makeGaAcceleratorHttpBinding above.
            return yield* withGaRegion(op({
                ...request,
                EndpointGroupArn: endpointGroupArn,
            }));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map