import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Amazon GuardDuty HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two builders
 * below. Everything except the operation and the IAM action list is
 * boilerplate.
 */
/**
 * Build the impl Effect for a GuardDuty operation scoped to a
 * {@link Detector}: the deploy-time half grants `actions` (on the bound
 * detector's ARN where the action supports resource-level permissions,
 * otherwise on `*`), and the runtime half injects the detector's
 * `DetectorId` into every request.
 */
export const makeGuardDutyDetectorHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (detector) {
        const DetectorId = yield* detector.detectorId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${detector}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.resourceLevel
                                ? [detector.detectorArn]
                                : ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${detector.LogicalId})`)(function* (request) {
            const detectorId = yield* DetectorId;
            return yield* op({ ...request, DetectorId: detectorId });
        });
    });
});
/**
 * Build the impl Effect for an account-level GuardDuty operation — the
 * member-account invitation flow (`ListInvitations`, `DeclineInvitations`,
 * `DeleteInvitations`, `GetInvitationsCount`), the organization-admin
 * actions, and the on-demand malware scan operations. The deploy-time half
 * grants `actions` on `*`: these operations either take no resource at all
 * or target resources (EC2 instances, S3 objects, foreign detectors) whose
 * ARNs are only known at runtime.
 */
export const makeGuardDutyAccountHttpBinding = (options) => Effect.gen(function* () {
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
                            Resource: ["*"],
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