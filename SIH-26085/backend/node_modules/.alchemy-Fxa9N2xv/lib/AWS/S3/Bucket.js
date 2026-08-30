import { Region } from "@distilled.cloud/aws/Region";
import * as s3 from "@distilled.cloud/aws/s3";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { diffTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
import { durationToDays } from "../IAM/common.js";
/**
 * An S3 bucket for storing objects in AWS.
 *
 * A bucket name is auto-generated from the app, stage, and logical ID unless
 * you provide one explicitly via `bucketName`. Enable `forceDestroy` to allow
 * Alchemy to empty the bucket before deleting it.
 * ### Creating a Bucket
 * **Example:** Basic Bucket
 * ```typescript
 * import * as S3 from "alchemy/AWS/S3";
 *
 * const bucket = yield* S3.Bucket("my-bucket", {});
 * ```
 *
 * **Example:** Bucket with a custom name
 * ```typescript
 * const bucket = yield* S3.Bucket("my-bucket", {
 *   bucketName: "my-company-assets",
 * });
 * ```
 *
 * **Example:** Bucket with force destroy
 * ```typescript
 * const bucket = yield* S3.Bucket("my-bucket", {
 *   forceDestroy: true,
 * });
 * ```
 *
 * ### Configuring a Bucket
 * **Example:** Versioning and encryption
 * ```typescript
 * const bucket = yield* S3.Bucket("my-bucket", {
 *   versioning: "Enabled",
 *   encryption: { sseAlgorithm: "AES256" },
 * });
 * ```
 *
 * **Example:** Block all public access
 * ```typescript
 * const bucket = yield* S3.Bucket("my-bucket", {
 *   publicAccessBlock: {
 *     blockPublicAcls: true,
 *     ignorePublicAcls: true,
 *     blockPublicPolicy: true,
 *     restrictPublicBuckets: true,
 *   },
 * });
 * ```
 *
 * **Example:** CORS and lifecycle rules
 * ```typescript
 * const bucket = yield* S3.Bucket("my-bucket", {
 *   cors: [
 *     {
 *       AllowedMethods: ["GET"],
 *       AllowedOrigins: ["*"],
 *       AllowedHeaders: ["*"],
 *       MaxAgeSeconds: 3000,
 *     },
 *   ],
 *   lifecycleRules: [
 *     {
 *       ID: "expire-old",
 *       Status: "Enabled",
 *       Filter: { Prefix: "logs/" },
 *       Expiration: { Days: 30 },
 *     },
 *   ],
 * });
 * ```
 *
 * **Example:** Static website hosting
 * ```typescript
 * const bucket = yield* S3.Bucket("my-bucket", {
 *   objectOwnership: "BucketOwnerPreferred",
 *   website: {
 *     indexDocument: { suffix: "index.html" },
 *     errorDocument: { key: "error.html" },
 *   },
 * });
 * ```
 *
 * ### Runtime Operations
 * Bind S3 operations in the init phase and use them in runtime
 * handlers. Bindings inject the bucket name and grant scoped IAM
 * permissions automatically.
 *
 * **Example:** Read and write objects
 * ```typescript
 * // init
 * const getObject = yield* S3.GetObject(bucket);
 * const putObject = yield* S3.PutObject(bucket);
 *
 * return {
 *   fetch: Effect.gen(function* () {
 *     // runtime
 *     yield* putObject({
 *       Key: "hello.txt",
 *       Body: "Hello, World!",
 *       ContentType: "text/plain",
 *     });
 *     const response = yield* getObject({ Key: "hello.txt" });
 *     return HttpServerResponse.text("OK");
 *   }),
 * };
 * ```
 *
 * **Example:** Delete an object
 * ```typescript
 * // init
 * const deleteObject = yield* S3.DeleteObject(bucket);
 * ```
 *
 * ### Event Notifications
 * Subscribe to bucket events from the init phase. The subscription
 * and Lambda invoke permissions are created automatically.
 *
 * **Example:** Process object creation events
 * ```typescript
 * // init
 * yield* S3.consumeBucketEvents(bucket, {
 *   events: ["s3:ObjectCreated:*"],
 * }, (stream) =>
 *   stream.pipe(
 *     Stream.runForEach((event) =>
 *       Effect.log(`New object: ${event.key}`),
 *     ),
 *   ),
 * );
 * ```
 *
 * @resource
 */
export const Bucket = Resource("AWS.S3.Bucket");
export const BucketProvider = () => Provider.effect(Bucket, Effect.gen(function* () {
    const createBucketName = (id, props) => Effect.gen(function* () {
        if (props.bucketName) {
            return props.bucketName;
        }
        return yield* createPhysicalName({
            id,
            maxLength: 63,
            lowercase: true,
        });
    });
    const deleteAllObjects = Effect.fn(function* (bucketName) {
        yield* Effect.logInfo(`S3 Bucket delete: deleting all objects from ${bucketName}`);
        // Delete every object VERSION and DELETE MARKER, by Key+VersionId.
        // `DeleteBucket` fails with BucketNotEmpty until all of them are
        // gone — deleting only current objects (listObjectsV2) leaves
        // versions/markers behind in versioned buckets. listObjectVersions
        // also covers unversioned buckets (plain objects surface as
        // Versions with VersionId "null"), so this single loop empties
        // both. Pagination is gated on IsTruncated — never on NextKeyMarker,
        // which S3 may omit even mid-listing.
        let isTruncated = true;
        let keyMarker;
        let versionIdMarker;
        while (isTruncated) {
            const page = yield* s3.listObjectVersions({
                Bucket: bucketName,
                KeyMarker: keyMarker,
                VersionIdMarker: versionIdMarker,
            });
            const objectsToDelete = [
                ...(page.Versions ?? []).map((v) => ({
                    Key: v.Key,
                    VersionId: v.VersionId,
                })),
                ...(page.DeleteMarkers ?? []).map((dm) => ({
                    Key: dm.Key,
                    VersionId: dm.VersionId,
                })),
            ];
            if (objectsToDelete.length > 0) {
                yield* Effect.logInfo(`S3 Bucket delete: deleting ${objectsToDelete.length} object version(s)/delete marker(s) from ${bucketName}`);
                yield* s3.deleteObjects({
                    Bucket: bucketName,
                    Delete: {
                        Objects: objectsToDelete,
                        Quiet: true,
                    },
                });
            }
            isTruncated = page.IsTruncated === true;
            keyMarker = page.NextKeyMarker;
            versionIdMarker = page.NextVersionIdMarker;
        }
        // Abort any in-progress multipart uploads — their stored parts also
        // keep DeleteBucket failing with BucketNotEmpty.
        let uploadsTruncated = true;
        let uploadKeyMarker;
        let uploadIdMarker;
        while (uploadsTruncated) {
            const uploads = yield* s3.listMultipartUploads({
                Bucket: bucketName,
                KeyMarker: uploadKeyMarker,
                UploadIdMarker: uploadIdMarker,
            });
            const inProgress = (uploads.Uploads ?? []).filter((u) => u.Key != null && u.UploadId != null);
            if (inProgress.length > 0) {
                yield* Effect.logInfo(`S3 Bucket delete: aborting ${inProgress.length} in-progress multipart upload(s) in ${bucketName}`);
                yield* Effect.all(inProgress.map((u) => s3
                    .abortMultipartUpload({
                    Bucket: bucketName,
                    Key: u.Key,
                    UploadId: u.UploadId,
                })
                    // Already aborted/completed concurrently — a race, not a
                    // failure.
                    .pipe(Effect.catchTag("NoSuchUpload", () => Effect.void))), { concurrency: 8 });
            }
            uploadsTruncated = uploads.IsTruncated === true;
            uploadKeyMarker = uploads.NextKeyMarker;
            uploadIdMarker = uploads.NextUploadIdMarker;
        }
    });
    const ensureBucketExists = Effect.fn(function* ({ id, news = {}, }) {
        const { region } = yield* AWSEnvironment.current;
        const { accountId } = yield* AWSEnvironment.current;
        const bucketName = yield* createBucketName(id, news);
        yield* Effect.logInfo(`S3 Bucket create: bucket=${bucketName} region=${region} `);
        // For us-east-1, BucketAlreadyOwnedByYou is not thrown, so we need to
        // pre-emptively check if the bucket exists for idempotency
        if (region === "us-east-1") {
            const exists = yield* s3.headBucket({ Bucket: bucketName }).pipe(Effect.map(() => true), Effect.catchTag("NotFound", () => Effect.succeed(false)), Effect.catch(() => Effect.succeed(false)));
            yield* Effect.logInfo(`S3 Bucket create: us-east-1 existence check for ${bucketName} -> ${exists}`);
            if (!exists) {
                yield* Effect.logInfo(`S3 Bucket create: creating bucket ${bucketName} in us-east-1`);
                yield* s3
                    .createBucket({
                    Bucket: bucketName,
                    ObjectLockEnabledForBucket: news.objectLockEnabled ?? false,
                })
                    .pipe(Effect.retry({
                    while: (e) => e._tag === "OperationAborted" ||
                        e._tag === "ServiceUnavailable",
                    schedule: Schedule.exponential(100),
                }));
            }
        }
        else {
            // For non-us-east-1 regions, we can rely on BucketAlreadyOwnedByYou
            yield* Effect.logInfo(`S3 Bucket create: creating bucket ${bucketName} in ${region}`);
            yield* s3
                .createBucket({
                Bucket: bucketName,
                CreateBucketConfiguration: {
                    LocationConstraint: region,
                },
                ObjectLockEnabledForBucket: news.objectLockEnabled,
            })
                .pipe(Effect.catchTag("BucketAlreadyOwnedByYou", () => Effect.void), Effect.retry({
                while: (e) => e._tag === "OperationAborted" ||
                    e._tag === "ServiceUnavailable",
                schedule: Schedule.exponential(100),
            }));
        }
        // Wait for bucket to exist (eventual consistency)
        yield* Effect.retry(s3.headBucket({ Bucket: bucketName }), Schedule.max([Schedule.exponential(100), Schedule.recurs(10)]));
        yield* Effect.logInfo(`S3 Bucket create: bucket is available ${bucketName}`);
        return {
            bucketName,
            bucketArn: `arn:aws:s3:::${bucketName}`,
            bucketDomainName: `${bucketName}.s3.amazonaws.com`,
            bucketRegionalDomainName: `${bucketName}.s3.${region}.amazonaws.com`,
            region,
            accountId,
        };
    });
    const fetchBucketTags = (bucketName) => s3.getBucketTagging({ Bucket: bucketName }).pipe(Effect.map((r) => Object.fromEntries((r.TagSet ?? []).map((t) => [t.Key, t.Value]))), Effect.catchTag("NoSuchTagSet", () => Effect.succeed({})), Effect.catch(() => Effect.succeed({})));
    const syncBucketTags = Effect.fn(function* ({ bucketName, oldTags, newTags, session, operation, }) {
        // Compare against the cloud's actual tags so drift surfaces
        // correctly even after a cold-start adoption (where olds.tags
        // equals news.tags and would otherwise look like a no-op).
        const previousTags = oldTags ?? (yield* fetchBucketTags(bucketName));
        const desiredTags = newTags ?? {};
        const { removed, upsert } = diffTags(previousTags, desiredTags);
        const canSkip = oldTags !== undefined;
        yield* Effect.logInfo(`S3 Bucket ${operation}: bucket=${bucketName} removedTags=${removed.length} upsertTags=${Object.keys(upsert).length}`);
        if (canSkip &&
            removed.length === 0 &&
            Object.keys(upsert).length === 0) {
            return;
        }
        if (Object.keys(desiredTags).length > 0) {
            yield* Effect.logInfo(`S3 Bucket ${operation}: writing ${Object.keys(desiredTags).length} total tag(s) to ${bucketName}`);
            yield* s3.putBucketTagging({
                Bucket: bucketName,
                Tagging: {
                    TagSet: Object.entries(desiredTags).map(([Key, Value]) => ({
                        Key,
                        Value,
                    })),
                },
            });
            yield* session.note(`Updated bucket tags: ${bucketName}`);
            return;
        }
        yield* Effect.logInfo(`S3 Bucket ${operation}: removing all tags from ${bucketName}`);
        yield* s3.deleteBucketTagging({
            Bucket: bucketName,
        });
        yield* session.note(`Removed all tags from bucket: ${bucketName}`);
    });
    const syncBucketPolicy = Effect.fn(function* ({ bucketName, bindings, explicitStatements, session, operation, }) {
        const policyStatements = [
            ...(explicitStatements ?? []),
            ...bindings.flatMap((binding) => binding.data.policyStatements ?? []),
        ];
        const desiredPolicy = policyStatements.length > 0
            ? JSON.stringify({
                Version: "2012-10-17",
                Statement: policyStatements,
            })
            : undefined;
        const existingPolicy = yield* s3
            .getBucketPolicy({ Bucket: bucketName })
            .pipe(Effect.map((r) => r.Policy), Effect.catchTag("NoSuchBucketPolicy", () => Effect.succeed(undefined)));
        yield* Effect.logInfo(`S3 Bucket ${operation}: bucket=${bucketName} policyStatements=${policyStatements.length}`);
        if (desiredPolicy) {
            if (existingPolicy === desiredPolicy) {
                return;
            }
            yield* Effect.logInfo(`S3 Bucket ${operation}: applying ${policyStatements.length} policy statement(s) to ${bucketName}`);
            yield* s3.putBucketPolicy({
                Bucket: bucketName,
                Policy: desiredPolicy,
            });
            yield* session.note(`Updated bucket policy: ${bucketName}`);
            return;
        }
        if (existingPolicy === undefined) {
            return;
        }
        yield* Effect.logInfo(`S3 Bucket ${operation}: deleting bucket policy for ${bucketName}`);
        yield* s3.deleteBucketPolicy({ Bucket: bucketName });
        yield* session.note(`Removed bucket policy: ${bucketName}`);
    });
    // Apply S3 event notification configuration declared via bindings
    // (e.g. `S3.consumeBucketEvents(bucket, handler)`). Without this the
    // binding is recorded in state but never reaches the bucket, so no
    // events are ever delivered.
    // Canonical form of the Lambda targets, ignoring S3-assigned `Id`s and
    // event ordering, so drift detection doesn't churn across deploys.
    const canonicalLambda = (configs) => JSON.stringify(Arr.map(configs, (c) => ({
        arn: c.LambdaFunctionArn,
        events: Arr.sort(c.Events ?? [], Order.String),
        filter: c.Filter ?? null,
    })));
    const syncBucketNotifications = Effect.fn(function* ({ bucketName, bindings, session, operation, }) {
        const desired = Arr.flatMap(bindings, (binding) => binding.data.notificationConfiguration
            ?.LambdaFunctionConfigurations ?? []);
        // Nothing declared — leave any externally-managed config untouched.
        if (Arr.isReadonlyArrayEmpty(desired))
            return;
        const existing = yield* s3.getBucketNotificationConfiguration({
            Bucket: bucketName,
        });
        if (canonicalLambda(existing.LambdaFunctionConfigurations ?? []) ===
            canonicalLambda(desired)) {
            return;
        }
        yield* Effect.logInfo(`S3 Bucket ${operation}: applying notification configuration to ${bucketName}`);
        yield* s3.putBucketNotificationConfiguration({
            Bucket: bucketName,
            // Preserve any Topic/Queues/EventBridge config already on the bucket;
            // only manage the Lambda targets declared through bindings.
            NotificationConfiguration: {
                ...existing,
                LambdaFunctionConfigurations: desired,
            },
            // The Lambda invoke permission is created as a separate resource
            // that may be applied after this bucket reconcile. Skip S3's
            // synchronous test-invoke so the PUT doesn't fail on ordering;
            // the permission exists by the time events are delivered.
            SkipDestinationValidation: true,
        });
        yield* session.note(`Updated bucket notifications: ${bucketName}`);
    });
    // ---- Bucket configuration sync helpers ------------------------------
    // Each helper observes the bucket's live cloud state, computes the
    // desired state from `news`, early-returns on a no-op, and applies only
    // the delta. The "not configured" read error for each aspect is already
    // a typed tag in distilled (see processes/AWS/catalog/S3.md), so we
    // `Effect.catchTag` it rather than inspecting status codes.
    const syncBucketVersioning = Effect.fn(function* ({ bucketName, versioning, mfaDelete, session, }) {
        if (versioning === undefined && mfaDelete === undefined)
            return;
        const current = yield* s3.getBucketVersioning({ Bucket: bucketName });
        const desiredStatus = versioning;
        const desiredMfa = mfaDelete;
        if ((desiredStatus === undefined || current.Status === desiredStatus) &&
            (desiredMfa === undefined || current.MFADelete === desiredMfa)) {
            return;
        }
        yield* s3.putBucketVersioning({
            Bucket: bucketName,
            VersioningConfiguration: {
                Status: desiredStatus,
                MFADelete: desiredMfa,
            },
        });
        yield* session.note(`Updated bucket versioning: ${bucketName}`);
    });
    const syncBucketEncryption = Effect.fn(function* ({ bucketName, encryption, session, }) {
        if (encryption === undefined)
            return;
        const desiredRule = {
            ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: encryption.sseAlgorithm,
                KMSMasterKeyID: encryption.kmsMasterKeyId,
            },
            BucketKeyEnabled: encryption.bucketKeyEnabled ?? false,
        };
        const current = yield* s3
            .getBucketEncryption({ Bucket: bucketName })
            .pipe(Effect.map((r) => r.ServerSideEncryptionConfiguration?.Rules?.[0]), 
        // Some partitions return 404 with no default config; treat any
        // not-configured read as "no rule" so we converge by writing.
        Effect.catch(() => Effect.succeed(undefined)));
        const canon = (r) => JSON.stringify({
            alg: r?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm ?? null,
            key: r?.ApplyServerSideEncryptionByDefault?.KMSMasterKeyID ?? null,
            bucketKey: r?.BucketKeyEnabled ?? false,
        });
        if (canon(current) === canon(desiredRule))
            return;
        yield* s3.putBucketEncryption({
            Bucket: bucketName,
            ServerSideEncryptionConfiguration: { Rules: [desiredRule] },
        });
        yield* session.note(`Updated bucket encryption: ${bucketName}`);
    });
    const syncPublicAccessBlock = Effect.fn(function* ({ bucketName, publicAccessBlock, session, }) {
        if (publicAccessBlock === undefined)
            return;
        const desired = {
            BlockPublicAcls: publicAccessBlock.blockPublicAcls ?? false,
            IgnorePublicAcls: publicAccessBlock.ignorePublicAcls ?? false,
            BlockPublicPolicy: publicAccessBlock.blockPublicPolicy ?? false,
            RestrictPublicBuckets: publicAccessBlock.restrictPublicBuckets ?? false,
        };
        const current = yield* s3
            .getPublicAccessBlock({ Bucket: bucketName })
            .pipe(Effect.map((r) => r.PublicAccessBlockConfiguration), Effect.catchTag("NoSuchPublicAccessBlockConfiguration", () => Effect.succeed(undefined)));
        const canon = (c) => JSON.stringify({
            a: c?.BlockPublicAcls ?? false,
            i: c?.IgnorePublicAcls ?? false,
            p: c?.BlockPublicPolicy ?? false,
            r: c?.RestrictPublicBuckets ?? false,
        });
        if (canon(current) === canon(desired))
            return;
        yield* s3.putPublicAccessBlock({
            Bucket: bucketName,
            PublicAccessBlockConfiguration: desired,
        });
        yield* session.note(`Updated public access block: ${bucketName}`);
    });
    const canonCors = (rules) => JSON.stringify(Arr.map(rules, (r) => ({
        // Drop S3-assigned `ID`s and sort member arrays so re-ordering
        // doesn't read as drift.
        headers: Arr.sort(r.AllowedHeaders ?? [], Order.String),
        methods: Arr.sort(r.AllowedMethods ?? [], Order.String),
        origins: Arr.sort(r.AllowedOrigins ?? [], Order.String),
        expose: Arr.sort(r.ExposeHeaders ?? [], Order.String),
        maxAge: r.MaxAgeSeconds ?? null,
    })));
    const syncBucketCors = Effect.fn(function* ({ bucketName, cors, session, }) {
        if (cors === undefined)
            return;
        const current = yield* s3.getBucketCors({ Bucket: bucketName }).pipe(Effect.map((r) => r.CORSRules ?? []), Effect.catchTag("NoSuchCORSConfiguration", () => Effect.succeed([])));
        if (cors.length === 0) {
            if (current.length === 0)
                return;
            yield* s3.deleteBucketCors({ Bucket: bucketName });
            yield* session.note(`Removed bucket CORS: ${bucketName}`);
            return;
        }
        if (canonCors(current) === canonCors(cors))
            return;
        yield* s3.putBucketCors({
            Bucket: bucketName,
            CORSConfiguration: { CORSRules: cors },
        });
        yield* session.note(`Updated bucket CORS: ${bucketName}`);
    });
    const canonLifecycle = (rules) => JSON.stringify(Arr.sort(Arr.map(rules, (r) => ({ ...r })), Order.mapInput(Order.String, (r) => r.ID ?? "")));
    const syncBucketLifecycle = Effect.fn(function* ({ bucketName, lifecycleRules, session, }) {
        if (lifecycleRules === undefined)
            return;
        const current = yield* s3
            .getBucketLifecycleConfiguration({ Bucket: bucketName })
            .pipe(Effect.map((r) => r.Rules ?? []), Effect.catchTag("NoSuchLifecycleConfiguration", () => Effect.succeed([])));
        if (lifecycleRules.length === 0) {
            if (current.length === 0)
                return;
            yield* s3.deleteBucketLifecycle({ Bucket: bucketName });
            yield* session.note(`Removed bucket lifecycle: ${bucketName}`);
            return;
        }
        if (canonLifecycle(current) === canonLifecycle(lifecycleRules))
            return;
        yield* s3.putBucketLifecycleConfiguration({
            Bucket: bucketName,
            LifecycleConfiguration: { Rules: lifecycleRules },
        });
        yield* session.note(`Updated bucket lifecycle: ${bucketName}`);
    });
    const syncBucketOwnershipControls = Effect.fn(function* ({ bucketName, objectOwnership, session, }) {
        if (objectOwnership === undefined)
            return;
        const current = yield* s3
            .getBucketOwnershipControls({ Bucket: bucketName })
            .pipe(Effect.map((r) => r.OwnershipControls?.Rules?.[0]?.ObjectOwnership), Effect.catchTag("OwnershipControlsNotFoundError", () => Effect.succeed(undefined)));
        if (current === objectOwnership)
            return;
        yield* s3.putBucketOwnershipControls({
            Bucket: bucketName,
            OwnershipControls: {
                Rules: [{ ObjectOwnership: objectOwnership }],
            },
        });
        yield* session.note(`Updated object ownership: ${bucketName}`);
    });
    const syncBucketAcl = Effect.fn(function* ({ bucketName, acl, session, }) {
        // S3 has no canned-ACL read, so we cannot diff; only apply when set.
        // putBucketAcl is idempotent for canned ACLs.
        if (acl === undefined)
            return;
        yield* s3.putBucketAcl({ Bucket: bucketName, ACL: acl });
        yield* session.note(`Updated bucket ACL: ${bucketName}`);
    });
    const syncBucketLogging = Effect.fn(function* ({ bucketName, logging, session, }) {
        if (logging === undefined)
            return;
        const current = yield* s3
            .getBucketLogging({ Bucket: bucketName })
            .pipe(Effect.map((r) => r.LoggingEnabled));
        const desired = {
            TargetBucket: logging.targetBucket,
            TargetPrefix: logging.targetPrefix,
            TargetGrants: logging.targetGrants,
            TargetObjectKeyFormat: logging.targetObjectKeyFormat,
        };
        if (current?.TargetBucket === desired.TargetBucket &&
            current?.TargetPrefix === desired.TargetPrefix &&
            JSON.stringify(current?.TargetGrants ?? null) ===
                JSON.stringify(desired.TargetGrants ?? null)) {
            return;
        }
        yield* s3.putBucketLogging({
            Bucket: bucketName,
            BucketLoggingStatus: { LoggingEnabled: desired },
        });
        yield* session.note(`Updated bucket logging: ${bucketName}`);
    });
    const syncTransferAcceleration = Effect.fn(function* ({ bucketName, transferAcceleration, session, }) {
        if (transferAcceleration === undefined)
            return;
        const current = yield* s3
            .getBucketAccelerateConfiguration({ Bucket: bucketName })
            .pipe(Effect.map((r) => r.Status));
        if (current === transferAcceleration)
            return;
        yield* s3.putBucketAccelerateConfiguration({
            Bucket: bucketName,
            AccelerateConfiguration: { Status: transferAcceleration },
        });
        yield* session.note(`Updated transfer acceleration: ${bucketName}`);
    });
    const syncRequestPayment = Effect.fn(function* ({ bucketName, requestPayer, session, }) {
        if (requestPayer === undefined)
            return;
        const current = yield* s3
            .getBucketRequestPayment({ Bucket: bucketName })
            .pipe(Effect.map((r) => r.Payer));
        if (current === requestPayer)
            return;
        yield* s3.putBucketRequestPayment({
            Bucket: bucketName,
            RequestPaymentConfiguration: { Payer: requestPayer },
        });
        yield* session.note(`Updated request payment: ${bucketName}`);
    });
    const syncBucketWebsite = Effect.fn(function* ({ bucketName, website, session, }) {
        if (website === undefined)
            return;
        const current = yield* s3.getBucketWebsite({ Bucket: bucketName }).pipe(Effect.map((r) => r), Effect.catchTag("NoSuchWebsiteConfiguration", () => Effect.succeed(undefined)));
        const desired = {
            IndexDocument: website.indexDocument
                ? { Suffix: website.indexDocument.suffix }
                : undefined,
            ErrorDocument: website.errorDocument
                ? { Key: website.errorDocument.key }
                : undefined,
            RedirectAllRequestsTo: website.redirectAllRequestsTo
                ? {
                    HostName: website.redirectAllRequestsTo.hostName,
                    Protocol: website.redirectAllRequestsTo.protocol,
                }
                : undefined,
            RoutingRules: website.routingRules,
        };
        const canon = (w) => JSON.stringify({
            index: w?.IndexDocument ?? null,
            error: w?.ErrorDocument ?? null,
            redirect: w?.RedirectAllRequestsTo ?? null,
            routing: w?.RoutingRules ?? null,
        });
        if (canon(current) === canon(desired))
            return;
        yield* s3.putBucketWebsite({
            Bucket: bucketName,
            WebsiteConfiguration: desired,
        });
        yield* session.note(`Updated bucket website: ${bucketName}`);
    });
    const canonReplication = (cfg) => JSON.stringify({
        role: cfg?.Role ?? null,
        rules: Arr.sort(Arr.map(cfg?.Rules ?? [], (r) => ({ ...r })), Order.mapInput(Order.String, (r) => r.ID ?? "")),
    });
    const syncBucketReplication = Effect.fn(function* ({ bucketName, replication, session, }) {
        if (replication === undefined)
            return;
        const current = yield* s3
            .getBucketReplication({ Bucket: bucketName })
            .pipe(Effect.map((r) => r.ReplicationConfiguration), Effect.catchTag("ReplicationConfigurationNotFoundError", () => Effect.succeed(undefined)));
        const desired = {
            Role: replication.role,
            Rules: replication.rules,
        };
        if (canonReplication(current) === canonReplication(desired))
            return;
        yield* s3.putBucketReplication({
            Bucket: bucketName,
            ReplicationConfiguration: desired,
        });
        yield* session.note(`Updated bucket replication: ${bucketName}`);
    });
    const syncIntelligentTiering = Effect.fn(function* ({ bucketName, intelligentTiering, oldIntelligentTiering, session, }) {
        if (intelligentTiering === undefined)
            return;
        const desiredById = new Map(Arr.map(intelligentTiering, (c) => [c.Id, c]));
        // Reconcile each desired id: put when missing or changed (observed
        // against the per-id read, which is read-after-write consistent).
        for (const [id, desired] of desiredById) {
            const current = yield* s3
                .getBucketIntelligentTieringConfiguration({
                Bucket: bucketName,
                Id: id,
            })
                .pipe(Effect.map((r) => r.IntelligentTieringConfiguration), Effect.catchTag("NoSuchConfiguration", () => Effect.succeed(undefined)));
            if (JSON.stringify(current) === JSON.stringify(desired))
                continue;
            yield* s3.putBucketIntelligentTieringConfiguration({
                Bucket: bucketName,
                Id: id,
                IntelligentTieringConfiguration: desired,
            });
            yield* session.note(`Updated intelligent-tiering ${id}: ${bucketName}`);
        }
        // Remove ids that were previously declared but are no longer desired.
        // `list` is eventually-consistent, so diff against the prior props
        // (when available) and fall back to listing for adoption. Each delete
        // tolerates a config that is already gone.
        const removedIds = new Set();
        for (const old of oldIntelligentTiering ?? []) {
            if (old.Id && !desiredById.has(old.Id))
                removedIds.add(old.Id);
        }
        if (oldIntelligentTiering === undefined) {
            const observed = yield* s3
                .listBucketIntelligentTieringConfigurations({ Bucket: bucketName })
                .pipe(Effect.map((r) => r.IntelligentTieringConfigurationList ?? []));
            for (const cfg of observed) {
                if (cfg.Id && !desiredById.has(cfg.Id))
                    removedIds.add(cfg.Id);
            }
        }
        for (const id of removedIds) {
            // delete is idempotent server-side (no NoSuchConfiguration in the
            // typed error union), so a missing id is simply a no-op.
            yield* s3.deleteBucketIntelligentTieringConfiguration({
                Bucket: bucketName,
                Id: id,
            });
            yield* session.note(`Removed intelligent-tiering ${id}: ${bucketName}`);
        }
    });
    const syncObjectLockRetention = Effect.fn(function* ({ bucketName, objectLockConfiguration, session, }) {
        if (objectLockConfiguration === undefined)
            return;
        const current = yield* s3
            .getObjectLockConfiguration({ Bucket: bucketName })
            .pipe(Effect.map((r) => r.ObjectLockConfiguration?.Rule?.DefaultRetention), Effect.catchTag("ObjectLockConfigurationNotFoundError", () => Effect.succeed(undefined)));
        const desired = {
            Mode: objectLockConfiguration.mode,
            Days: durationToDays(objectLockConfiguration.days),
            Years: objectLockConfiguration.years,
        };
        const canon = (r) => JSON.stringify({
            mode: r?.Mode ?? null,
            days: r?.Days ?? null,
            years: r?.Years ?? null,
        });
        if (canon(current) === canon(desired))
            return;
        yield* s3.putObjectLockConfiguration({
            Bucket: bucketName,
            ObjectLockConfiguration: {
                ObjectLockEnabled: "Enabled",
                Rule: { DefaultRetention: desired },
            },
        });
        yield* session.note(`Updated object-lock retention: ${bucketName}`);
    });
    return {
        stables: ["bucketName", "bucketArn", "region", "accountId"],
        // S3 bucket names are globally unique. `headBucket` succeeds only when
        // the bucket exists in our account, so a successful response is itself
        // proof of account-level ownership — there is no separate ownership
        // signal to surface as `Unowned`.
        list: () => Effect.gen(function* () {
            const { accountId, region } = yield* AWSEnvironment.current;
            // S3 only includes `BucketRegion` in the response when the request
            // carries at least one parameter — hence the explicit MaxBuckets.
            return yield* s3.listBuckets.pages({ MaxBuckets: 1000 }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.Buckets ?? [])
                .filter((b) => b.Name != null)
                .map((b) => {
                // ListBuckets is global — record each bucket's actual
                // region so later operations (delete) can target it.
                const bucketRegion = (b.BucketRegion ??
                    region);
                return {
                    bucketName: b.Name,
                    bucketArn: `arn:aws:s3:::${b.Name}`,
                    bucketDomainName: `${b.Name}.s3.amazonaws.com`,
                    bucketRegionalDomainName: `${b.Name}.s3.${bucketRegion}.amazonaws.com`,
                    region: bucketRegion,
                    accountId,
                };
            }))));
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const bucketName = output?.bucketName ?? (yield* createBucketName(id, olds ?? {}));
            const { accountId, region } = yield* AWSEnvironment.current;
            const exists = yield* s3.headBucket({ Bucket: bucketName }).pipe(Effect.map(() => true), Effect.catchTag("NotFound", () => Effect.succeed(false)), Effect.catch(() => Effect.succeed(false)));
            if (!exists)
                return undefined;
            return {
                bucketName,
                bucketArn: `arn:aws:s3:::${bucketName}`,
                bucketDomainName: `${bucketName}.s3.amazonaws.com`,
                bucketRegionalDomainName: `${bucketName}.s3.${region}.amazonaws.com`,
                region,
                accountId,
            };
        }),
        diff: Effect.fn(function* ({ id, news = {}, olds = {} }) {
            if (!isResolved(news))
                return undefined;
            const oldBucketName = yield* createBucketName(id, olds);
            const newBucketName = yield* createBucketName(id, news);
            yield* Effect.logInfo(`S3 Bucket diff: old=${oldBucketName} new=${newBucketName} oldObjectLock=${olds.objectLockEnabled ?? false} newObjectLock=${news.objectLockEnabled ?? false}`);
            if (oldBucketName !== newBucketName) {
                yield* Effect.logInfo(`S3 Bucket diff: replacing bucket because name changed from ${oldBucketName} to ${newBucketName}`);
                return { action: "replace" };
            }
            // Object lock can only be enabled at creation time
            if ((olds.objectLockEnabled ?? false) !==
                (news.objectLockEnabled ?? false)) {
                yield* Effect.logInfo(`S3 Bucket diff: replacing bucket because object lock changed for ${newBucketName}`);
                return { action: "replace" };
            }
        }),
        precreate: (props) => ensureBucketExists(props),
        reconcile: Effect.fn(function* ({ id, news = {}, olds, output, session, bindings, }) {
            const operation = output === undefined ? "create" : "update";
            const resolved = output ?? (yield* ensureBucketExists({ id, news }));
            yield* syncBucketTags({
                bucketName: resolved.bucketName,
                // Omit `oldTags` so syncBucketTags fetches the cloud's actual
                // current tags. This makes drift detection correct even after
                // a cold-start adoption where olds.tags would equal news.tags.
                newTags: news.tags,
                session,
                operation,
            });
            // Ownership + public-access-block must precede any ACL/policy that
            // grants public access, else those puts can fail with AccessDenied.
            yield* syncBucketOwnershipControls({
                bucketName: resolved.bucketName,
                objectOwnership: news.objectOwnership,
                session,
            });
            yield* syncPublicAccessBlock({
                bucketName: resolved.bucketName,
                publicAccessBlock: news.publicAccessBlock,
                session,
            });
            // Versioning before replication (replication requires it enabled).
            yield* syncBucketVersioning({
                bucketName: resolved.bucketName,
                versioning: news.versioning,
                mfaDelete: news.mfaDelete,
                session,
            });
            yield* syncBucketEncryption({
                bucketName: resolved.bucketName,
                encryption: news.encryption,
                session,
            });
            yield* syncBucketCors({
                bucketName: resolved.bucketName,
                cors: news.cors,
                session,
            });
            yield* syncBucketLifecycle({
                bucketName: resolved.bucketName,
                lifecycleRules: news.lifecycleRules,
                session,
            });
            yield* syncBucketLogging({
                bucketName: resolved.bucketName,
                logging: news.logging,
                session,
            });
            yield* syncTransferAcceleration({
                bucketName: resolved.bucketName,
                transferAcceleration: news.transferAcceleration,
                session,
            });
            yield* syncRequestPayment({
                bucketName: resolved.bucketName,
                requestPayer: news.requestPayer,
                session,
            });
            yield* syncBucketWebsite({
                bucketName: resolved.bucketName,
                website: news.website,
                session,
            });
            yield* syncBucketReplication({
                bucketName: resolved.bucketName,
                replication: news.replication,
                session,
            });
            yield* syncIntelligentTiering({
                bucketName: resolved.bucketName,
                intelligentTiering: news.intelligentTiering,
                oldIntelligentTiering: olds?.intelligentTiering,
                session,
            });
            yield* syncObjectLockRetention({
                bucketName: resolved.bucketName,
                objectLockConfiguration: news.objectLockConfiguration,
                session,
            });
            // ACL after ownership/public-access-block.
            yield* syncBucketAcl({
                bucketName: resolved.bucketName,
                acl: news.acl,
                session,
            });
            yield* syncBucketPolicy({
                bucketName: resolved.bucketName,
                bindings,
                explicitStatements: news.policy,
                session,
                operation,
            });
            yield* syncBucketNotifications({
                bucketName: resolved.bucketName,
                bindings,
                session,
                operation,
            });
            if (operation === "create") {
                yield* session.note(`Ensured bucket: ${resolved.bucketName}`);
            }
            return resolved;
        }),
        delete: Effect.fn(function* ({ olds = {}, output, session, force }) {
            // Whether we are allowed to destroy the bucket's contents.
            // - `olds.forceDestroy` — the user opted in on the resource props.
            // - `force` — set only by `alchemy unsafe nuke`, an explicit
            //   operator-confirmed account teardown. Nuke enumerates buckets
            //   straight from the cloud (its `olds` is Attributes, not Props),
            //   so `forceDestroy` is never present there. S3 ownership is
            //   account-level (see `list`/`read`: buckets are globally unique
            //   and only enumerable/headable in our own account; this provider
            //   deliberately does not stamp alchemy tags on buckets), so every
            //   bucket nuke hands us is one this account owns.
            // A normal destroy without `forceDestroy` must NOT empty the
            // bucket — a non-empty bucket fails with BucketNotEmpty, which is
            // the data-protection behavior users rely on.
            const mayEmpty = olds.forceDestroy === true || force === true;
            yield* Effect.logInfo(`S3 Bucket delete: bucket=${output.bucketName} forceDestroy=${olds.forceDestroy ?? false} force=${force ?? false} region=${output.region}`);
            const run = Effect.gen(function* () {
                // If we may destroy contents, delete all object versions and
                // delete markers first. The bucket may already be gone (deleted
                // out-of-band, or a previous destroy partially succeeded) —
                // treat NoSuchBucket as a no-op so the overall delete still
                // converges.
                if (mayEmpty) {
                    yield* session.note(`Force destroying bucket: ${output.bucketName} - deleting all objects...`);
                    yield* deleteAllObjects(output.bucketName).pipe(Effect.catchTag("NoSuchBucket", () => Effect.void));
                }
                yield* s3
                    .deleteBucket({
                    Bucket: output.bucketName,
                })
                    .pipe(Effect.catchTag("NoSuchBucket", () => Effect.void), 
                // BucketNotEmpty after an empty is eventual consistency (or
                // a concurrent writer landing new versions between the empty
                // and the DeleteBucket): re-empty so the bounded retry below
                // has a chance to succeed instead of spinning on a bucket
                // that still has content.
                Effect.catchTag("BucketNotEmpty", (e) => Effect.gen(function* () {
                    if (!mayEmpty)
                        return yield* Effect.fail(e);
                    yield* deleteAllObjects(output.bucketName).pipe(Effect.catchTag("NoSuchBucket", () => Effect.void));
                    // Re-fail with the original error so the retry policy
                    // drives the next DeleteBucket attempt.
                    return yield* Effect.fail(e);
                })), Effect.retry({
                    // BucketHasAccessPointsAttached: S3's access-point
                    // attachment view is eventually consistent — deleting a
                    // bucket immediately after its access points were deleted
                    // can transiently report attachments. Retry until the view
                    // converges (bounded).
                    while: (e) => e._tag === "BucketNotEmpty" ||
                        e._tag === "BucketHasAccessPointsAttached",
                    schedule: Schedule.max([
                        Schedule.exponential(250),
                        Schedule.recurs(7),
                    ]),
                }));
            });
            // The bucket may live in a different region than the ambient client
            // (list enumerates buckets from every region) — target the bucket's
            // own region to avoid PermanentRedirect. If we still get redirected
            // (e.g. a stale/missing region attribute), retry once in the region
            // the redirect reports.
            yield* (output.region
                ? run.pipe(Effect.provideService(Region, Effect.succeed(output.region)))
                : run).pipe(Effect.tapError(Effect.logInfo), Effect.catchTag("PermanentRedirect", (e) => e.BucketRegion
                ? run.pipe(Effect.provideService(Region, Effect.succeed(e.BucketRegion)))
                : Effect.fail(e)));
            yield* session.note(`Deleted bucket: ${output.bucketName}`);
        }),
    };
}));
//# sourceMappingURL=Bucket.js.map