import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Amazon Fraud Detector HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two builders
 * below. Everything except the operation and the IAM action list is
 * boilerplate.
 */
/**
 * Build the impl Effect for a Fraud Detector operation scoped to a
 * {@link Detector}: the deploy-time half grants `actions` on the bound
 * detector's ARN, and the runtime half injects the detector's `detectorId`
 * into every request.
 */
export const makeFraudDetectorDetectorHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (detector) {
        // Output yields a DEFERRED effect — resolve again per invocation below.
        const DetectorId = yield* detector.detectorId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${detector}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [detector.arn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${detector.LogicalId})`)(function* (request) {
            const detectorId = yield* DetectorId;
            return yield* op({ ...request, detectorId });
        });
    });
});
/**
 * Build the impl Effect for a Fraud Detector event data-plane operation
 * scoped to an {@link EventType} (`SendEvent`, `GetEvent`, `DeleteEvent`,
 * `UpdateEventLabel`): the deploy-time half grants `actions` on the bound
 * event type's ARN, and the runtime half injects the event type's
 * `eventTypeName` into every request.
 */
/**
 * Build the impl Effect for a Fraud Detector list data-plane operation scoped
 * to a {@link List} (`GetListElements`, `UpdateList`): the deploy-time half
 * grants `actions` on the bound list's ARN, and the runtime half injects the
 * list's `name` into every request.
 */
export const makeFraudDetectorListHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (list) {
        // Output yields a DEFERRED effect — resolve again per invocation below.
        const ListName = yield* list.name;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${list}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [list.arn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${list.LogicalId})`)(function* (request) {
            const name = yield* ListName;
            return yield* op({ ...request, name });
        });
    });
});
export const makeFraudDetectorEventTypeHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (eventType) {
        // Output yields a DEFERRED effect — resolve again per invocation below.
        const EventTypeName = yield* eventType.name;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${eventType}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [eventType.arn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${eventType.LogicalId})`)(function* (request) {
            const eventTypeName = yield* EventTypeName;
            return yield* op({ ...request, eventTypeName });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map