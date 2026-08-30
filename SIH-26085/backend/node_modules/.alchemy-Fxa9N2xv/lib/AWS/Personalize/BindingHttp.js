import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared HTTP scaffolding for the Amazon Personalize runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the three
 * builders below. Everything except the distilled operation, the identifier
 * injection, and the IAM action list is boilerplate:
 *
 * - dataset-scoped operations (`PutItems`, `PutUsers`, `PutActions`) inject
 *   the bound {@link Dataset}'s ARN as `datasetArn` and grant on it,
 * - event-tracker-scoped operations (`PutEvents`, `PutActionInteractions`)
 *   inject the bound {@link EventTracker}'s `trackingId`; per the service
 *   authorization reference these actions support no resource types, so the
 *   grant is on `Resource: ["*"]`,
 * - account-level operations (the `personalize-runtime` recommenders and the
 *   MLOps retraining loop) address campaigns / solutions / import jobs whose
 *   ARNs are created at runtime, so they grant on `Resource: ["*"]`.
 */
/**
 * Build the impl Effect for a dataset-scoped Personalize operation: the
 * runtime callable injects the bound {@link Dataset}'s ARN as `datasetArn`
 * and the deploy-time half grants `actions` on the dataset ARN.
 */
export const makePersonalizeDatasetHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (dataset) {
        const datasetArn = yield* dataset.datasetArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${dataset}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [dataset.datasetArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${dataset.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                datasetArn: yield* datasetArn,
            });
        });
    });
});
/**
 * Build the impl Effect for an event-tracker-scoped Personalize operation:
 * the runtime callable injects the bound {@link EventTracker}'s tracking ID
 * as `trackingId`. The deploy-time half grants `actions` on `Resource: ["*"]`
 * — `personalize:PutEvents` / `personalize:PutActionInteractions` support no
 * resource types (a tracker-ARN-scoped grant answers AccessDeniedException).
 */
export const makePersonalizeEventTrackerHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (tracker) {
        const trackingId = yield* tracker.trackingId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${tracker}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            // The event-ingestion actions support no resource types.
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${tracker.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                trackingId: yield* trackingId,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level Personalize operation (the
 * `personalize-runtime` recommendation calls and the MLOps retraining loop):
 * campaigns, solutions, and import jobs are addressed by ARNs the caller
 * supplies at runtime, so the deploy-time half grants `actions` on
 * `Resource: ["*"]`.
 */
export const makePersonalizeAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const policyStatements = [
                    {
                        Effect: "Allow",
                        Action: [...options.actions],
                        // Campaign/solution/import-job ARNs are chosen at runtime.
                        Resource: ["*"],
                    },
                ];
                if (options.passRole) {
                    policyStatements.push({
                        Effect: "Allow",
                        Action: ["iam:PassRole"],
                        Resource: ["*"],
                        Condition: {
                            StringEquals: {
                                "iam:PassedToService": "personalize.amazonaws.com",
                            },
                        },
                    });
                }
                yield* host.bind `Allow(${host}, ${options.tag}())`({
                    policyStatements,
                });
            }
        }
        return Effect.fn(options.tag)(function* (request) {
            return yield* op(request);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map