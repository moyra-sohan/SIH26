import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Amazon IVS Real-Time HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, makeIvsRealtime…HttpBinding({ … }))` over one of the
 * builders below. Everything except the operation, the IAM action list, and
 * an optional request-shape mapper is boilerplate.
 */
/**
 * Compositions are addressed by server-generated ARNs only known at runtime,
 * so composition-plane grants use this wildcard.
 */
export const COMPOSITION_ARN_WILDCARD = "arn:aws:ivs:*:*:composition/*";
/**
 * Encoder configurations referenced by a composition's destinations are
 * runtime data, so StartComposition grants include this wildcard.
 */
export const ENCODER_CONFIGURATION_ARN_WILDCARD = "arn:aws:ivs:*:*:encoder-configuration/*";
/**
 * Storage configurations referenced by a composition's S3 destinations are
 * runtime data, so StartComposition grants include this wildcard.
 */
export const STORAGE_CONFIGURATION_ARN_WILDCARD = "arn:aws:ivs:*:*:storage-configuration/*";
/**
 * Build the impl Effect for an IVS Real-Time operation scoped to a
 * {@link Stage}: the deploy-time half grants `actions` on the bound stage's
 * ARN (plus any `extraResources`), and the runtime half injects the stage's
 * ARN under `requestKey` (default `stageArn`; `ListParticipantReplicas`
 * addresses the stage as `sourceStageArn`).
 *
 * `prepare` (optional) maps a friendlier public request shape onto the wire
 * request — e.g. `CreateParticipantToken` converts a `Duration.Input` into
 * the wire `duration` minutes. It defaults to identity.
 */
export const makeIvsRealtimeStageHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (stage) {
        // Output yields a DEFERRED effect — resolve again per invocation below.
        const StageArn = yield* stage.stageArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${stage}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [stage.stageArn, ...(options.extraResources ?? [])],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${stage.LogicalId})`)(function* (request) {
            const stageArn = yield* StageArn;
            const wire = options.prepare
                ? options.prepare((request ?? {}))
                : (request ?? {});
            return yield* op({
                ...wire,
                [options.requestKey ?? "stageArn"]: stageArn,
            });
        });
    });
});
/**
 * Build the impl Effect for an IVS Real-Time participant-replication
 * operation: the runtime callable is bound to a **source** and a
 * **destination** {@link Stage}, injects both ARNs, and the deploy-time half
 * grants `actions` on both stage ARNs.
 */
export const makeIvsRealtimeReplicationHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (sourceStage, destinationStage) {
        const SourceStageArn = yield* sourceStage.stageArn;
        const DestinationStageArn = yield* destinationStage.stageArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${sourceStage}, ${destinationStage}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [sourceStage.stageArn, destinationStage.stageArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${sourceStage.LogicalId}, ${destinationStage.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                sourceStageArn: yield* SourceStageArn,
                destinationStageArn: yield* DestinationStageArn,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level IVS Real-Time operation
 * (composition management — compositions are addressed by server-generated
 * ARNs that are runtime data). The deploy-time half grants `actions` on
 * `resources` (default `*`).
 */
export const makeIvsRealtimeAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
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