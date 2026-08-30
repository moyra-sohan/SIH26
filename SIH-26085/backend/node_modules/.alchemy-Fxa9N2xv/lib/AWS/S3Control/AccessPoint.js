import * as s3control from "@distilled.cloud/aws/s3-control";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
/**
 * An Amazon S3 Access Point — a named network endpoint attached to a bucket
 * with its own policy, public-access-block settings, and optional VPC
 * restriction. Use access points to manage shared-dataset access at scale
 * instead of maintaining one giant bucket policy.
 * ### Creating Access Points
 * **Example:** Internet access point on a bucket
 * ```typescript
 * import * as S3 from "alchemy/AWS/S3";
 * import * as S3Control from "alchemy/AWS/S3Control";
 *
 * const bucket = yield* S3.Bucket("data", {});
 * const accessPoint = yield* S3Control.AccessPoint("data-ap", {
 *   bucket: bucket.bucketName,
 * });
 * ```
 *
 * **Example:** VPC-only access point
 * ```typescript
 * const accessPoint = yield* S3Control.AccessPoint("internal-ap", {
 *   bucket: bucket.bucketName,
 *   vpcConfiguration: { vpcId: vpc.vpcId },
 * });
 * ```
 *
 * **Example:** Access point with explicit public-access-block
 * ```typescript
 * const accessPoint = yield* S3Control.AccessPoint("locked-ap", {
 *   bucket: bucket.bucketName,
 *   publicAccessBlock: {
 *     blockPublicAcls: true,
 *     ignorePublicAcls: true,
 *     blockPublicPolicy: true,
 *     restrictPublicBuckets: true,
 *   },
 *   tags: { team: "data" },
 * });
 * ```
 *
 * ### Granting Access
 * **Example:** Attach a policy to the access point
 * ```typescript
 * yield* S3Control.AccessPointPolicy("data-ap-policy", {
 *   accessPointName: accessPoint.accessPointName,
 *   policy: {
 *     Version: "2012-10-17",
 *     Statement: [
 *       {
 *         Effect: "Allow",
 *         Principal: { AWS: `arn:aws:iam::${accountId}:role/reader` },
 *         Action: ["s3:GetObject"],
 *         Resource: [Output.interpolate`${accessPoint.accessPointArn}/object/*`],
 *       },
 *     ],
 *   },
 * });
 * ```
 *
 * @resource
 */
export const AccessPoint = Resource("AWS.S3Control.AccessPoint");
/**
 * Retry while the freshly-created access point has not propagated yet.
 * `TagResource`/`ListTagsForResource` (and occasionally `GetAccessPoint`)
 * return `NoSuchAccessPoint` for a few seconds after `CreateAccessPoint`
 * succeeds.
 *
 * Explicitly typed at module scope — inlining `Effect.retry` in a lifecycle
 * op leaks `Retry.Return`'s conditional type into declaration emit, widening
 * the provider layer to `unknown` and poisoning `AWS.providers()`.
 */
const retryWhileAccessPointPropagates = (self) => Effect.retry(self, {
    while: (e) => e._tag === "NoSuchAccessPoint",
    schedule: Schedule.max([Schedule.fixed("1 second"), Schedule.recurs(10)]),
});
/**
 * Marker error for the delete verification loop: the access point is still
 * observable after `DeleteAccessPoint` reported success (or a spurious
 * `NoSuchAccessPoint`). The same control-plane propagation lag that makes
 * `GetAccessPoint`/`TagResource` 404 for a few seconds after create can make
 * `DeleteAccessPoint` 404 for a freshly-created access point WITHOUT deleting
 * it — swallowing that 404 as "already gone" orphans the access point (and
 * poisons the owning bucket's delete with `BucketHasAccessPointsAttached`).
 */
class AccessPointNotYetDeleted extends Data.TaggedError("AccessPointNotYetDeleted") {
}
/**
 * Retry while the access point is still observable after a delete attempt.
 * Explicitly typed at module scope for the same declaration-emit reason as
 * {@link retryWhileAccessPointPropagates}.
 */
const retryWhileAccessPointNotYetDeleted = (self) => Effect.retry(self, {
    while: (e) => e._tag === "AccessPointNotYetDeleted",
    schedule: Schedule.max([Schedule.exponential(500), Schedule.recurs(6)]),
});
export const AccessPointProvider = () => Provider.effect(AccessPoint, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        // Access point names: 3-50 chars, lowercase letters/numbers/hyphens.
        return (props.accessPointName ??
            (yield* createPhysicalName({ id, maxLength: 50, lowercase: true })));
    });
    const accessPointArn = (region, accountId, name) => `arn:aws:s3:${region}:${accountId}:accesspoint/${name}`;
    const observeAccessPoint = (accountId, name) => s3control
        .getAccessPoint({ AccountId: accountId, Name: name })
        .pipe(Effect.catchTag("NoSuchAccessPoint", () => Effect.succeed(undefined)));
    const observedTags = (accountId, arn) => s3control
        .listTagsForResource({ AccountId: accountId, ResourceArn: arn })
        .pipe(Effect.map((r) => Object.fromEntries((r.Tags ?? []).map((t) => [t.Key, t.Value]))), Effect.catchTag("NoSuchAccessPoint", () => Effect.succeed({})));
    const toAttrs = (name, live, region, accountId) => ({
        accessPointName: name,
        accessPointArn: live.AccessPointArn ?? accessPointArn(region, accountId, name),
        alias: live.Alias,
        bucket: live.Bucket ?? "",
        networkOrigin: live.NetworkOrigin ?? "Internet",
        region,
        accountId,
    });
    // Public-access-block flags default to `true` on access points.
    const canonPab = (pab) => JSON.stringify({
        a: pab?.blockPublicAcls ?? true,
        i: pab?.ignorePublicAcls ?? true,
        p: pab?.blockPublicPolicy ?? true,
        r: pab?.restrictPublicBuckets ?? true,
    });
    return AccessPoint.Provider.of({
        stables: [
            "accessPointName",
            "accessPointArn",
            "alias",
            "bucket",
            "networkOrigin",
            "region",
            "accountId",
        ],
        list: () => Effect.gen(function* () {
            const { accountId, region } = yield* AWSEnvironment.current;
            const pages = yield* s3control.listAccessPoints
                .pages({ AccountId: accountId })
                .pipe(Stream.runCollect);
            return Array.from(pages).flatMap((page) => (page.AccessPointList ?? []).map((ap) => ({
                accessPointName: ap.Name,
                accessPointArn: ap.AccessPointArn ??
                    accessPointArn(region, accountId, ap.Name),
                alias: ap.Alias,
                bucket: ap.Bucket,
                networkOrigin: ap.NetworkOrigin,
                region,
                accountId,
            })));
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.accessPointName ?? (yield* createName(id, olds ?? {}));
            const live = yield* observeAccessPoint(accountId, name);
            if (live === undefined)
                return undefined;
            const attrs = toAttrs(name, live, region, accountId);
            const tags = yield* observedTags(accountId, attrs.accessPointArn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldProps = olds ?? {};
            const oldName = yield* createName(id, oldProps);
            const newName = yield* createName(id, news);
            if (oldName !== newName ||
                oldProps.bucket !== news.bucket ||
                (oldProps.bucketAccountId ?? undefined) !==
                    (news.bucketAccountId ?? undefined) ||
                (oldProps.vpcConfiguration?.vpcId ?? undefined) !==
                    (news.vpcConfiguration?.vpcId ?? undefined) ||
                canonPab(oldProps.publicAccessBlock) !==
                    canonPab(news.publicAccessBlock)) {
                // Everything except tags is create-only on an access point.
                return { action: "replace" };
            }
            // fall through: engine default update path (tags)
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { accountId, region } = yield* AWSEnvironment.current;
            const name = output?.accessPointName ?? (yield* createName(id, news));
            // 1. OBSERVE — cloud state is authoritative.
            let live = yield* observeAccessPoint(accountId, name);
            // 2. ENSURE — create when missing; a concurrent create surfaces as
            //    the typed AccessPointAlreadyOwnedByYou tag (treated as a race)
            //    and a freshly-created access point can 404 for a few seconds.
            if (live === undefined) {
                yield* s3control
                    .createAccessPoint({
                    AccountId: accountId,
                    Name: name,
                    Bucket: news.bucket,
                    BucketAccountId: news.bucketAccountId,
                    VpcConfiguration: news.vpcConfiguration
                        ? { VpcId: news.vpcConfiguration.vpcId }
                        : undefined,
                    PublicAccessBlockConfiguration: news.publicAccessBlock
                        ? {
                            BlockPublicAcls: news.publicAccessBlock.blockPublicAcls,
                            IgnorePublicAcls: news.publicAccessBlock.ignorePublicAcls,
                            BlockPublicPolicy: news.publicAccessBlock.blockPublicPolicy,
                            RestrictPublicBuckets: news.publicAccessBlock.restrictPublicBuckets,
                        }
                        : undefined,
                })
                    .pipe(Effect.catchTag("AccessPointAlreadyOwnedByYou", () => Effect.void));
                live = yield* retryWhileAccessPointPropagates(s3control.getAccessPoint({ AccountId: accountId, Name: name }));
            }
            const attrs = toAttrs(name, live, region, accountId);
            // 3. SYNC TAGS — diff against OBSERVED cloud tags so adoption
            //    converges. Tagging a fresh access point can race propagation.
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...news.tags, ...internalTags };
            const currentTags = yield* observedTags(accountId, attrs.accessPointArn);
            const { upsert, removed } = diffTags(currentTags, desiredTags);
            if (upsert.length > 0) {
                yield* retryWhileAccessPointPropagates(s3control.tagResource({
                    AccountId: accountId,
                    ResourceArn: attrs.accessPointArn,
                    Tags: upsert,
                }));
            }
            if (removed.length > 0) {
                yield* s3control.untagResource({
                    AccountId: accountId,
                    ResourceArn: attrs.accessPointArn,
                    TagKeys: removed,
                });
            }
            yield* session.note(name);
            return attrs;
        }),
        delete: Effect.fn(function* ({ output }) {
            const { accountId } = yield* AWSEnvironment.current;
            const name = output.accessPointName;
            const deleteOnce = s3control
                .deleteAccessPoint({ AccountId: accountId, Name: name })
                .pipe(
            // Idempotent delete — already gone is success.
            Effect.catchTag("NoSuchAccessPoint", () => Effect.void));
            yield* deleteOnce;
            // Verify the access point is actually gone. `DeleteAccessPoint`
            // can spuriously return `NoSuchAccessPoint` for a freshly-created
            // access point (control-plane propagation lag) without deleting
            // it; treating that as success orphans the access point. While
            // the access point is still observable, delete again — bounded,
            // then fail loudly rather than silently leak.
            yield* retryWhileAccessPointNotYetDeleted(observeAccessPoint(accountId, name).pipe(Effect.flatMap((live) => live === undefined
                ? Effect.void
                : deleteOnce.pipe(Effect.flatMap(() => Effect.fail(new AccessPointNotYetDeleted({ name })))))));
        }),
    });
}));
//# sourceMappingURL=AccessPoint.js.map