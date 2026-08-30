/**
 * Shared scaffolding for the Amazon S3 Control HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, makeS3Control…HttpBinding({ … }))` over one of the
 * builders below. Every S3 Control request carries the owning `AccountId`
 * (an endpoint host label), so each builder's only real job is deciding
 * where that account id comes from:
 *
 * - Access-point-scoped operations inject `AccountId` + `Name` from the
 *   bound {@link AccessPoint} and are granted on the access point ARN.
 * - Multi-Region Access Point operations inject `AccountId` + `Mrap` from
 *   the bound {@link MultiRegionAccessPoint}, are granted on the MRAP ARN,
 *   and are pinned to `us-west-2` (the region the MRAP control plane and
 *   route APIs are served from).
 * - Account-level operations (access point listing, S3 Batch Operations
 *   jobs) resolve the caller's account once via `sts:GetCallerIdentity`
 *   (cached per binding) and are granted on `*` — job ARNs are
 *   server-assigned at runtime and unknowable at deploy time.
 */
import { Region } from "@distilled.cloud/aws/Region";
import * as sts from "@distilled.cloud/aws/sts";
import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * All Multi-Region Access Point control-plane requests are routed to the
 * US West (Oregon) region regardless of the ambient region — mirrors the
 * {@link MultiRegionAccessPoint} resource provider.
 */
const inMrapRegion = (self) => self.pipe(Effect.provideService(Region, Effect.succeed("us-west-2")));
/**
 * Build the impl Effect for an S3 Control operation scoped to an
 * {@link AccessPoint}: the deploy-time half grants `actions` on the bound
 * access point's ARN, and the runtime half injects the access point's
 * `AccountId` and `Name` into every request.
 */
export const makeS3ControlAccessPointHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (accessPoint) {
        const AccountId = yield* accessPoint.accountId;
        const Name = yield* accessPoint.accessPointName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${accessPoint}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [accessPoint.accessPointArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${accessPoint.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                AccountId: yield* AccountId,
                Name: yield* Name,
            });
        });
    });
});
/**
 * Build the impl Effect for an S3 Control operation scoped to a
 * {@link MultiRegionAccessPoint}: the deploy-time half grants `actions` on
 * the bound MRAP's ARN, and the runtime half injects the MRAP's `AccountId`
 * and alias-addressed ARN (`Mrap`) into every request, pinned to the
 * `us-west-2` MRAP control-plane region.
 */
export const makeS3ControlMrapHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* inMrapRegion(options.operation);
    return Effect.fn(function* (mrap) {
        const AccountId = yield* mrap.accountId;
        const Mrap = yield* mrap.multiRegionAccessPointArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${mrap}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [mrap.multiRegionAccessPointArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${mrap.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                AccountId: yield* AccountId,
                Mrap: yield* Mrap,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level S3 Control operation (access
 * point listing, S3 Batch Operations jobs). The deploy-time half grants
 * `actions` on `*` — job ARNs are server-assigned at runtime and unknowable
 * at deploy time. The runtime half resolves the caller's account id once via
 * `sts:GetCallerIdentity` (needs no extra IAM permission) and injects it as
 * `AccountId`.
 */
export const makeS3ControlAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    const getCallerIdentity = yield* sts.getCallerIdentity;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const policyStatements = [
                    {
                        Effect: "Allow",
                        Action: [...options.actions],
                        Resource: ["*"],
                    },
                ];
                if (options.passRole) {
                    // No `iam:PassedToService` condition — IAM does not populate the
                    // key for `s3:CreateJob`, so a conditioned grant is always
                    // denied. This matches the policy AWS documents for Batch
                    // Operations job creators.
                    policyStatements.push({
                        Effect: "Allow",
                        Action: ["iam:PassRole"],
                        Resource: ["*"],
                    });
                }
                yield* host.bind `Allow(${host}, ${options.tag}())`({
                    policyStatements,
                });
            }
        }
        // Resolve the caller's account id lazily (first call inside the
        // Lambda) and cache it for the life of the binding.
        const accountId = yield* Effect.cached(getCallerIdentity({}).pipe(Effect.map((r) => r.Account)));
        return Effect.fn(options.tag)(function* (request) {
            return yield* op({
                ...request,
                AccountId: yield* accountId,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map