import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared HTTP scaffolding for the AWS IoT Wireless runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the IAM action, and the request
 * shaping is boilerplate.
 */
/**
 * Build the impl Effect for an IoT Wireless operation scoped to one
 * {@link WirelessDevice}: the deploy-time half grants `iamActions` on the
 * bound device's ARN, and the runtime half injects the device's
 * server-assigned id into every request via `prepare`.
 */
export const makeIotWirelessDeviceHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (device) {
        // Output yields a DEFERRED effect — resolve again per invocation below.
        const DeviceId = yield* device.wirelessDeviceId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.IoTWireless.${options.capability}(${device}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.iamActions],
                            Resource: options.resourceScope === "any"
                                ? ["*"]
                                : [device.wirelessDeviceArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.IoTWireless.${options.capability}(${device.LogicalId})`)(function* (request) {
            const wirelessDeviceId = yield* DeviceId;
            return yield* op(options.prepare(request, wirelessDeviceId));
        });
    });
});
/**
 * Build the impl Effect for an IoT Wireless operation scoped to one
 * {@link WirelessGateway}: the deploy-time half grants `iamActions` on the
 * bound gateway's ARN, and the runtime half injects the gateway's
 * server-assigned id into every request via `prepare`.
 */
export const makeIotWirelessGatewayHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (gateway) {
        const GatewayId = yield* gateway.wirelessGatewayId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.IoTWireless.${options.capability}(${gateway}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.iamActions],
                            Resource: [gateway.wirelessGatewayArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.IoTWireless.${options.capability}(${gateway.LogicalId})`)(function* (request) {
            const wirelessGatewayId = yield* GatewayId;
            return yield* op(options.prepare(request, wirelessGatewayId));
        });
    });
});
/**
 * Build the impl Effect for an account-level IoT Wireless operation (e.g.
 * `GetServiceEndpoint` or `GetPositionEstimate`, which are not scoped to a
 * single resource). Grants `iamActions` on `Resource: ["*"]`.
 */
export const makeIotWirelessAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.IoTWireless.${options.capability}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.iamActions],
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.IoTWireless.${options.capability}`)(function* (request) {
            return yield* op(options.prepare(request));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map