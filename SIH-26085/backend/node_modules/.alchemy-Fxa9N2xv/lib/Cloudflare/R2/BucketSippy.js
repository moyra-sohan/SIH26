import * as r2 from "@distilled.cloud/cloudflare/r2";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
const TypeId = "Cloudflare.R2.BucketSippy";
/**
 * Sippy — incremental migration from AWS S3 or Google Cloud Storage
 * into a Cloudflare R2 bucket.
 *
 * When Sippy is enabled on a bucket, any object requested from R2 that
 * is not yet present is fetched from the configured source bucket,
 * served, and copied into R2 — migrating data on demand without a bulk
 * transfer and without paying double storage during the transition.
 *
 * One Sippy configuration exists per bucket (it is a singleton
 * sub-resource of the bucket). Destroying the resource disables Sippy;
 * objects already migrated stay in the R2 bucket.
 * ### Migrating from AWS S3
 * **Example:** Enable Sippy on a bucket with an S3 source
 * ```typescript
 * const bucket = yield* Cloudflare.R2.Bucket("Media");
 *
 * yield* Cloudflare.R2.BucketSippy("MediaMigration", {
 *   bucketName: bucket.bucketName,
 *   source: {
 *     provider: "aws",
 *     bucket: "legacy-media",
 *     region: "us-east-1",
 *     accessKeyId: yield* Config.redacted("AWS_ACCESS_KEY_ID"),
 *     secretAccessKey: yield* Config.redacted("AWS_SECRET_ACCESS_KEY"),
 *   },
 *   destination: {
 *     accessKeyId: yield* Config.redacted("R2_ACCESS_KEY_ID"),
 *     secretAccessKey: yield* Config.redacted("R2_SECRET_ACCESS_KEY"),
 *   },
 * });
 * ```
 *
 * ### Migrating from Google Cloud Storage
 * **Example:** Enable Sippy with a GCS source
 * ```typescript
 * yield* Cloudflare.R2.BucketSippy("MediaMigration", {
 *   bucketName: bucket.bucketName,
 *   source: {
 *     provider: "gcs",
 *     bucket: "legacy-media",
 *     clientEmail: "sippy@my-project.iam.gserviceaccount.com",
 *     privateKey: yield* Config.redacted("GCS_PRIVATE_KEY"),
 *   },
 *   destination: {
 *     accessKeyId: yield* Config.redacted("R2_ACCESS_KEY_ID"),
 *     secretAccessKey: yield* Config.redacted("R2_SECRET_ACCESS_KEY"),
 *   },
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/r2/data-migration/sippy/
 *
 * @resource
 * @product R2
 * @category Storage & Databases
 */
export const BucketSippy = Resource(TypeId);
/**
 * Returns true if the given value is an BucketSippy resource.
 */
export const isBucketSippy = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const BucketSippyProvider = () => Provider.succeed(BucketSippy, {
    stables: ["bucketName", "accountId", "jurisdiction"],
    diff: Effect.fn(function* ({ olds, news }) {
        if (!isResolved(news))
            return undefined;
        // The bucket is the configuration's identity — moving Sippy to a
        // different bucket (or jurisdiction) is a replacement. Compare
        // only once both sides are concrete strings.
        if (typeof olds.bucketName === "string" &&
            typeof news.bucketName === "string" &&
            olds.bucketName !== news.bucketName) {
            return { action: "replace" };
        }
        if (olds.bucketName !== undefined &&
            (olds.jurisdiction ?? "default") !== (news.jurisdiction ?? "default")) {
            return { action: "replace" };
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ output, olds }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        // The bucket is the configuration's identity; cold reads derive it
        // from the last-persisted props.
        const bucketName = output?.bucketName ??
            (typeof olds?.bucketName === "string" ? olds.bucketName : undefined);
        if (bucketName === undefined)
            return undefined;
        const jurisdiction = output?.jurisdiction ?? olds?.jurisdiction ?? "default";
        const observed = yield* r2
            .getBucketSippy({ accountId: acct, bucketName, jurisdiction })
            .pipe(Effect.map((config) => config), 
        // The bucket itself is gone — so is its Sippy configuration.
        Effect.catchTag("NoSuchBucket", () => Effect.succeed(undefined)));
        // A bucket with Sippy never configured (or disabled) reads back as
        // `{ enabled: false }` — that is "absent" for this resource.
        if (!observed || observed.enabled !== true)
            return undefined;
        const attrs = toAttributes(observed, acct, bucketName, jurisdiction);
        // Sippy configs carry no ownership markers. With no prior output we
        // cannot prove we enabled it — brand it `Unowned` so takeover is
        // gated behind the adopt policy.
        return output ? attrs : Unowned(attrs);
    }),
    reconcile: Effect.fn(function* ({ news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        // Inputs have been resolved to concrete strings by Plan.
        const bucketName = news.bucketName;
        const jurisdiction = news.jurisdiction ?? "default";
        // The PUT is a full upsert of the bucket's single Sippy
        // configuration — enabling when absent and re-configuring when
        // present — so observe/ensure/sync collapse into one idempotent
        // call. Source/destination secrets are write-only, so an observed
        // config can never be diffed against the desired one anyway.
        const synced = yield* r2.putBucketSippy({
            accountId: acct,
            bucketName,
            jurisdiction,
            source: toRequestSource(news.source),
            destination: {
                provider: "r2",
                accessKeyId: Redacted.value(news.destination.accessKeyId),
                secretAccessKey: Redacted.value(news.destination.secretAccessKey),
            },
        });
        return toAttributes(synced, acct, bucketName, jurisdiction);
    }),
    delete: Effect.fn(function* ({ output }) {
        // Disabling Sippy on a bucket where it is already disabled is a
        // success (`{ enabled: false }`); a missing bucket means there is
        // nothing left to disable — both make delete idempotent.
        yield* r2
            .deleteBucketSippy({
            accountId: output.accountId,
            bucketName: output.bucketName,
            jurisdiction: output.jurisdiction,
        })
            .pipe(Effect.catchTag("NoSuchBucket", () => Effect.void));
    }),
    // Sippy is a per-bucket singleton with no account-wide enumeration
    // API, so fan out from the parent: enumerate every R2 bucket, read its
    // Sippy config with bounded concurrency, and emit one item per bucket
    // that actually has Sippy enabled (mirroring `read`, which treats a
    // disabled/absent config as "not present").
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const { buckets } = yield* r2.listBuckets({ accountId });
        const perBucket = yield* Effect.forEach(buckets ?? [], (bucket) => {
            const bucketName = bucket.name;
            if (bucketName == null) {
                return Effect.succeed([]);
            }
            const jurisdiction = (bucket.jurisdiction ??
                "default");
            return r2
                .getBucketSippy({ accountId, bucketName, jurisdiction })
                .pipe(Effect.map((config) => config.enabled === true
                ? [toAttributes(config, accountId, bucketName, jurisdiction)]
                : []), 
            // A bucket that vanished mid-enumeration, or one whose plan
            // rejects the Sippy route, contributes nothing — skip it.
            Effect.catchTag(["NoSuchBucket", "InvalidRoute", "Forbidden"], () => Effect.succeed([])));
        }, { concurrency: 10 });
        return perBucket.flat();
    }),
});
/**
 * Build the request body shape the distilled `putBucketSippy` method
 * accepts. Secrets are unwrapped here because the distilled TS types
 * declare the credential fields as plain strings.
 */
const toRequestSource = (source) => source.provider === "aws"
    ? {
        provider: "aws",
        bucket: source.bucket,
        region: source.region,
        accessKeyId: Redacted.value(source.accessKeyId),
        secretAccessKey: Redacted.value(source.secretAccessKey),
    }
    : {
        provider: "gcs",
        bucket: source.bucket,
        clientEmail: source.clientEmail,
        privateKey: Redacted.value(source.privateKey),
    };
const toAttributes = (config, accountId, bucketName, jurisdiction) => ({
    bucketName,
    accountId,
    jurisdiction,
    enabled: config.enabled ?? false,
    source: {
        // Cloudflare reports AWS sources as either "aws" or the legacy "s3".
        provider: config.source?.provider === "gcs"
            ? "gcs"
            : config.source?.provider != null
                ? "aws"
                : undefined,
        bucket: config.source?.bucket ?? undefined,
        region: config.source?.region ?? undefined,
        bucketUrl: config.source?.bucketUrl ?? undefined,
    },
    destination: {
        provider: config.destination?.provider ?? undefined,
        account: config.destination?.account ?? undefined,
        bucket: config.destination?.bucket ?? undefined,
        accessKeyId: config.destination?.accessKeyId ?? undefined,
    },
});
//# sourceMappingURL=BucketSippy.js.map