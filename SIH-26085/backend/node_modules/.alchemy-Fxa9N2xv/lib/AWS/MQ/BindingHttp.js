import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the implementation effect for a broker-scoped MQ capability:
 * `Layer.effect(Cap, makeMqBrokerHttpBinding({ ... }))`.
 *
 * The runtime callable injects the bound broker's id, so `Req` is the
 * operation's request type without `BrokerId`.
 */
export const makeMqBrokerHttpBinding = (config) => Effect.gen(function* () {
    const op = yield* config.operation;
    return Effect.fn(function* (broker) {
        const BrokerId = yield* broker.brokerId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.MQ.${config.capability}(${broker}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...config.iamActions],
                            Resource: [Output.interpolate `${broker.brokerArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.MQ.${config.capability}(${broker.LogicalId})`)(function* (request) {
            return yield* op({
                ...(request ?? {}),
                BrokerId: yield* BrokerId,
            });
        });
    });
});
/**
 * Build the implementation effect for an account-level MQ capability (no
 * broker argument): `Layer.effect(Cap, makeMqAccountHttpBinding({ ... }))`.
 */
export const makeMqAccountHttpBinding = (config) => Effect.gen(function* () {
    const op = yield* config.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.MQ.${config.capability}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...config.iamActions],
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.MQ.${config.capability}`)(function* (request) {
            return yield* op(request ?? {});
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map