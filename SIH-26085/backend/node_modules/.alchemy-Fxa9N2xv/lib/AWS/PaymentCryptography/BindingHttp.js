import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the AWS Payment Cryptography HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the IAM action, and (for two-key
 * operations) the injected request fields is boilerplate.
 *
 * Payment Cryptography data-plane operations authorize against the key ARN,
 * so every builder grants `actions` on the bound {@link Key}(s) and the
 * runtime callable injects the key ARN(s) into every request.
 */
/**
 * Build the impl Effect for an operation scoped to a single {@link Key}
 * whose input carries the key ARN in a `KeyIdentifier` field (all
 * single-key Payment Cryptography operations use this field name).
 */
export const makePaymentCryptographyKeyHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (key) {
        // Outputs yield a DEFERRED effect — resolve again per invocation below.
        const KeyArn = yield* key.keyArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${key}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [key.keyArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${key.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                KeyIdentifier: yield* KeyArn,
            });
        });
    });
});
/**
 * Build the impl Effect for an operation spanning two {@link Key}s (e.g.
 * `ReEncryptData` with incoming + outgoing keys, `GeneratePinData` with
 * generation + encryption keys). The deploy-time half grants `actions` on
 * both key ARNs, and the runtime callable injects each key's ARN into the
 * request field named by `keyFields` (in bind-argument order).
 */
export const makePaymentCryptographyKeyPairHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (first, second) {
        const FirstArn = yield* first.keyArn;
        const SecondArn = yield* second.keyArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                for (const key of [first, second]) {
                    yield* host.bind `Allow(${host}, ${options.tag}(${key}))`({
                        policyStatements: [
                            {
                                Effect: "Allow",
                                Action: [...options.actions],
                                Resource: [key.keyArn],
                            },
                        ],
                    });
                }
            }
        }
        return Effect.fn(`${options.tag}(${first.LogicalId}, ${second.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                [options.keyFields[0]]: yield* FirstArn,
                [options.keyFields[1]]: yield* SecondArn,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map