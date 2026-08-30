import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
import { inFleetWiseRegion } from "./internal.js";
/**
 * Shared scaffolding for AWS IoT FleetWise HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, makeFleetWise…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation, the injected identifier,
 * and the IAM action list + granted ARNs is boilerplate. Every runtime call
 * is piped through {@link inFleetWiseRegion} because AWS IoT FleetWise is
 * offered only in `us-east-1`/`eu-central-1` — a Lambda running anywhere else
 * transparently calls the service's home region.
 */
/**
 * Build the impl Effect for a FleetWise operation scoped to one resource
 * (vehicle, fleet, campaign, or one of the manifests/catalogs): the
 * deploy-time half grants `actions` on `resources`, and the runtime callable
 * injects the bound resource's identifier as the `requestKey` field of every
 * request.
 */
export const makeFleetWiseResourceHttpBinding = (options) => Effect.gen(function* () {
    // Capture the client in the FleetWise home region: yielding an
    // operation captures its services (region, credentials, HTTP client)
    // once, so the pin must wrap the capture, not the later calls.
    const op = yield* inFleetWiseRegion(options.operation);
    return Effect.fn(function* (resource) {
        const Identifier = yield* options.identifier(resource);
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${resource}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.resources(resource),
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${resource.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                [options.requestKey]: yield* Identifier,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level FleetWise operation (no bound
 * resource): the deploy-time half grants `actions` on `resources`
 * (default `*` — batch vehicle operations authorize on vehicle ARNs that
 * only exist at runtime), and the runtime callable passes the caller's
 * request through unchanged.
 */
export const makeFleetWiseAccountHttpBinding = (options) => Effect.gen(function* () {
    // See makeFleetWiseResourceHttpBinding: the region pin wraps the
    // service capture, not the later calls.
    const op = yield* inFleetWiseRegion(options.operation);
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [...(options.resources ?? ["*"])],
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