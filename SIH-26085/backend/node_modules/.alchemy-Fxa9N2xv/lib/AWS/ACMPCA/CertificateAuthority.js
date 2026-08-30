import * as acmpca from "@distilled.cloud/aws/acm-pca";
import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags, hasAlchemyTags } from "../../Tags.js";
import { toWireDays } from "../../Util/Duration.js";
/**
 * An Amazon Web Services Private CA certificate authority.
 *
 * A newly created CA starts in the `PENDING_CERTIFICATE` state — to
 * activate it you must retrieve its CSR, sign it (self-sign for a root
 * CA), and import the signed certificate. Private CAs bill a monthly fee
 * for as long as they exist, so destroy test CAs promptly. Deletion
 * places the CA in the `DELETED` state for a configurable 7-30 day
 * restoration window.
 * ### Creating a Certificate Authority
 * **Example:** Root CA
 * ```typescript
 * import * as ACMPCA from "alchemy/AWS/ACMPCA";
 *
 * const ca = yield* ACMPCA.CertificateAuthority("RootCA", {
 *   subject: { commonName: "corp.example.com" },
 * });
 * ```
 *
 * **Example:** ECDSA Subordinate CA
 * ```typescript
 * const ca = yield* ACMPCA.CertificateAuthority("IssuingCA", {
 *   type: "SUBORDINATE",
 *   keyAlgorithm: "EC_prime256v1",
 *   signingAlgorithm: "SHA256WITHECDSA",
 *   subject: {
 *     commonName: "issuing.corp.example.com",
 *     organization: "Example Corp",
 *     country: "US",
 *   },
 * });
 * ```
 *
 * **Example:** Short-Lived Certificate Mode
 * ```typescript
 * const ca = yield* ACMPCA.CertificateAuthority("ShortLivedCA", {
 *   subject: { commonName: "ephemeral.example.com" },
 *   usageMode: "SHORT_LIVED_CERTIFICATE",
 * });
 * ```
 *
 * ### Revocation
 * **Example:** CA with CRL published to S3
 * ```typescript
 * const ca = yield* ACMPCA.CertificateAuthority("RootCA", {
 *   subject: { commonName: "corp.example.com" },
 *   revocationConfiguration: {
 *     crlConfiguration: {
 *       enabled: true,
 *       expiration: "7 days",
 *       s3BucketName: bucket.bucketName,
 *     },
 *   },
 * });
 * ```
 *
 * ### Granting ACM Access
 * **Example:** Allow ACM to auto-renew certificates issued by this CA
 * ```typescript
 * const permission = yield* ACMPCA.Permission("AcmRenewal", {
 *   certificateAuthorityArn: ca.certificateAuthorityArn,
 * });
 * ```
 *
 * ### Reacting to CA Events
 * **Example:** Consume ACM PCA Events from EventBridge
 * ```typescript
 * // ACM PCA emits lifecycle events (certificate issuance, expiry, CRL and
 * // audit-report generation) on the default EventBridge bus under the
 * // `aws.acm-pca` source — consume them with the generic EventBridge
 * // event source; there is no ACM PCA-specific notification config.
 * yield* AWS.EventBridge.consumeBusEvents(
 *   {
 *     source: ["aws.acm-pca"],
 *     "detail-type": ["ACM Private CA Certificate Issuance"],
 *   },
 *   (events) =>
 *     Stream.runForEach(events, (event) => Effect.log(event.detail)),
 * );
 * ```
 *
 * @resource
 */
export const CertificateAuthority = Resource("AWS.ACMPCA.CertificateAuthority");
/**
 * Internal signal used to poll a freshly created CA out of the
 * `CREATING` state on a bounded schedule.
 */
class CertificateAuthorityStillCreating extends Data.TaggedError("CertificateAuthorityStillCreating") {
}
// Bounded retry helpers with explicit signatures. Inlining Effect.retry in
// lifecycle ops leaks Retry.Return's conditional type into declaration emit
// and widens the provider layer to `unknown` for every consumer.
const retryWhileCreating = (self) => Effect.retry(self, {
    while: (e) => e._tag === "CertificateAuthorityStillCreating",
    schedule: Schedule.max([Schedule.fixed(2000), Schedule.recurs(30)]),
});
const retryWhileConcurrentlyModified = (self) => Effect.retry(self, {
    while: (e) => e._tag === "ConcurrentModificationException",
    schedule: Schedule.max([Schedule.fixed(2000), Schedule.recurs(10)]),
});
const buildSubject = (subject) => ({
    CommonName: subject.commonName,
    Organization: subject.organization,
    OrganizationalUnit: subject.organizationalUnit,
    Country: subject.country,
    State: subject.state,
    Locality: subject.locality,
    SerialNumber: subject.serialNumber,
    Title: subject.title,
    Surname: subject.surname,
    GivenName: subject.givenName,
    Initials: subject.initials,
    Pseudonym: subject.pseudonym,
    DistinguishedNameQualifier: subject.distinguishedNameQualifier,
    GenerationQualifier: subject.generationQualifier,
});
const buildRevocationConfiguration = (props) => {
    if (props === undefined)
        return undefined;
    const crl = props.crlConfiguration;
    const ocsp = props.ocspConfiguration;
    return {
        CrlConfiguration: crl
            ? {
                Enabled: crl.enabled,
                ExpirationInDays: toWireDays(crl.expiration),
                CustomCname: crl.customCname,
                S3BucketName: crl.s3BucketName,
                S3ObjectAcl: crl.s3ObjectAcl,
                CrlType: crl.crlType,
                CustomPath: crl.customPath,
            }
            : undefined,
        OcspConfiguration: ocsp
            ? {
                Enabled: ocsp.enabled,
                OcspCustomCname: ocsp.ocspCustomCname,
            }
            : undefined,
    };
};
export const CertificateAuthorityProvider = () => Provider.effect(CertificateAuthority, Effect.gen(function* () {
    // Describe a CA by ARN; typed not-found → undefined. A CA in the
    // DELETED state is inside its restoration window — for lifecycle
    // purposes it is gone (we never restore automatically).
    const describeCa = Effect.fn(function* (arn) {
        return yield* acmpca
            .describeCertificateAuthority({ CertificateAuthorityArn: arn })
            .pipe(Effect.map((r) => r.CertificateAuthority), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    const listCaTags = Effect.fn(function* (arn) {
        const tags = yield* acmpca.listTags
            .items({ CertificateAuthorityArn: arn })
            .pipe(Stream.runCollect, Effect.map((chunk) => Object.fromEntries(Array.from(chunk)
            .filter((t) => t.Value !== undefined)
            .map((t) => [t.Key, t.Value]))), Effect.catch(() => Effect.succeed({})));
        return tags;
    });
    const subjectFromAsn1 = (s) => ({
        commonName: s?.CommonName,
        organization: s?.Organization,
        organizationalUnit: s?.OrganizationalUnit,
        country: s?.Country,
        state: s?.State,
        locality: s?.Locality,
        serialNumber: s?.SerialNumber,
        title: s?.Title,
        surname: s?.Surname,
        givenName: s?.GivenName,
        initials: s?.Initials,
        pseudonym: s?.Pseudonym,
        distinguishedNameQualifier: s?.DistinguishedNameQualifier,
        generationQualifier: s?.GenerationQualifier,
    });
    // Does the live CA's immutable configuration match the desired props?
    // The tag-search fallback below must NOT match a CA whose immutable
    // config differs — during a replacement the new instance reconciles
    // with `output === undefined` and the same logical id, and matching
    // the old CA by tags alone would silently re-adopt it instead of
    // creating the replacement.
    const matchesImmutableConfig = (ca, props) => {
        const config = ca.CertificateAuthorityConfiguration;
        return ((ca.Type ?? "ROOT") === (props.type ?? "ROOT") &&
            config?.KeyAlgorithm === (props.keyAlgorithm ?? "RSA_2048") &&
            config?.SigningAlgorithm ===
                (props.signingAlgorithm ?? "SHA256WITHRSA") &&
            (ca.UsageMode ?? "GENERAL_PURPOSE") ===
                (props.usageMode ?? "GENERAL_PURPOSE") &&
            (props.keyStorageSecurityStandard === undefined ||
                ca.KeyStorageSecurityStandard ===
                    props.keyStorageSecurityStandard) &&
            JSON.stringify(buildSubject(subjectFromAsn1(config?.Subject))) ===
                JSON.stringify(buildSubject(props.subject ?? {})));
    };
    // ARNs are auto-assigned, so after a state persistence failure the
    // only way back to an orphaned CA is its Alchemy ownership tags.
    // Leaking a CA would keep billing, so reconcile searches by tags
    // (plus matching immutable configuration) before creating.
    const findManagedCa = Effect.fn(function* (id, props) {
        const cas = yield* acmpca.listCertificateAuthorities.items({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).filter((ca) => ca.Arn !== undefined && ca.Status !== "DELETED")));
        for (const ca of cas) {
            if (!matchesImmutableConfig(ca, props))
                continue;
            const tags = yield* listCaTags(ca.Arn);
            if (yield* hasAlchemyTags(id, tags)) {
                return ca;
            }
        }
        return undefined;
    });
    // Poll a freshly created CA out of CREATING (bounded ~60s; the
    // transition to PENDING_CERTIFICATE is normally fast).
    const waitUntilCreated = Effect.fn(function* (arn) {
        return yield* describeCa(arn).pipe(Effect.flatMap((ca) => ca?.Status === "CREATING"
            ? Effect.fail(new CertificateAuthorityStillCreating({ arn }))
            : Effect.succeed(ca)), retryWhileCreating);
    });
    const toAttrs = (arn, status) => ({
        certificateAuthorityArn: arn,
        status: status ?? "PENDING_CERTIFICATE",
    });
    return {
        stables: ["certificateAuthorityArn"],
        list: () => acmpca.listCertificateAuthorities.items({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
            // DELETED CAs are already inside their restoration window
            // and cannot be deleted again.
            .filter((ca) => ca.Arn !== undefined && ca.Status !== "DELETED")
            .map((ca) => toAttrs(ca.Arn, ca.Status)))),
        read: Effect.fn(function* ({ id, olds, output }) {
            // The ARN is auto-assigned: prefer the cached output, fall back
            // to searching by ownership tags (state persistence failure).
            let ca = output?.certificateAuthorityArn !== undefined
                ? yield* describeCa(output.certificateAuthorityArn)
                : undefined;
            if ((ca === undefined || ca.Status === "DELETED") && olds) {
                ca = yield* findManagedCa(id, olds);
            }
            if (ca?.Arn === undefined || ca.Status === "DELETED") {
                return undefined;
            }
            const attrs = toAttrs(ca.Arn, ca.Status);
            const tags = yield* listCaTags(ca.Arn);
            return (yield* hasAlchemyTags(id, tags)) ? attrs : Unowned(attrs);
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return;
            const immutableChanged = (news.type ?? "ROOT") !== (olds.type ?? "ROOT") ||
                (news.keyAlgorithm ?? "RSA_2048") !==
                    (olds.keyAlgorithm ?? "RSA_2048") ||
                (news.signingAlgorithm ?? "SHA256WITHRSA") !==
                    (olds.signingAlgorithm ?? "SHA256WITHRSA") ||
                (news.usageMode ?? "GENERAL_PURPOSE") !==
                    (olds.usageMode ?? "GENERAL_PURPOSE") ||
                news.keyStorageSecurityStandard !==
                    olds.keyStorageSecurityStandard ||
                JSON.stringify(buildSubject(news.subject)) !==
                    JSON.stringify(buildSubject(olds.subject));
            if (immutableChanged) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const internalTags = yield* createInternalTags(id);
            const desiredRevocation = buildRevocationConfiguration(news.revocationConfiguration);
            // 1. OBSERVE — output is only an ARN cache; cloud state is
            // authoritative. Fall back to a tag search so a persistence
            // failure never leaks (and double-bills) a CA.
            let ca = output?.certificateAuthorityArn !== undefined
                ? yield* describeCa(output.certificateAuthorityArn)
                : undefined;
            if (ca === undefined || ca.Status === "DELETED") {
                ca = yield* findManagedCa(id, news);
            }
            // 2. ENSURE — create if missing and wait out the CREATING state.
            if (ca?.Arn === undefined || ca.Status === "DELETED") {
                const created = yield* acmpca.createCertificateAuthority({
                    CertificateAuthorityConfiguration: {
                        KeyAlgorithm: news.keyAlgorithm ?? "RSA_2048",
                        SigningAlgorithm: news.signingAlgorithm ?? "SHA256WITHRSA",
                        Subject: buildSubject(news.subject),
                    },
                    CertificateAuthorityType: news.type ?? "ROOT",
                    RevocationConfiguration: desiredRevocation,
                    KeyStorageSecurityStandard: news.keyStorageSecurityStandard,
                    UsageMode: news.usageMode,
                    Tags: Object.entries({
                        ...news.tags,
                        ...internalTags,
                    }).map(([Key, Value]) => ({ Key, Value })),
                });
                const arn = created.CertificateAuthorityArn;
                yield* session.note(`Created certificate authority ${arn}`);
                ca = (yield* waitUntilCreated(arn)) ?? { Arn: arn };
            }
            const arn = ca.Arn;
            // 3. SYNC revocation configuration — AWS only allows
            // UpdateCertificateAuthority while the CA is ACTIVE or DISABLED,
            // so a PENDING_CERTIFICATE CA keeps its create-time settings.
            if (desiredRevocation !== undefined &&
                (ca.Status === "ACTIVE" || ca.Status === "DISABLED")) {
                const observed = JSON.stringify(buildRevocationConfiguration({
                    crlConfiguration: ca.RevocationConfiguration?.CrlConfiguration
                        ? {
                            enabled: ca.RevocationConfiguration.CrlConfiguration.Enabled,
                            expiration: ca.RevocationConfiguration.CrlConfiguration
                                .ExpirationInDays === undefined
                                ? undefined
                                : Duration.days(ca.RevocationConfiguration.CrlConfiguration
                                    .ExpirationInDays),
                            customCname: ca.RevocationConfiguration.CrlConfiguration.CustomCname,
                            s3BucketName: ca.RevocationConfiguration.CrlConfiguration
                                .S3BucketName,
                            s3ObjectAcl: ca.RevocationConfiguration.CrlConfiguration
                                .S3ObjectAcl,
                            crlType: ca.RevocationConfiguration.CrlConfiguration
                                .CrlType,
                            customPath: ca.RevocationConfiguration.CrlConfiguration.CustomPath,
                        }
                        : undefined,
                    ocspConfiguration: ca.RevocationConfiguration?.OcspConfiguration
                        ? {
                            enabled: ca.RevocationConfiguration.OcspConfiguration.Enabled,
                            ocspCustomCname: ca.RevocationConfiguration.OcspConfiguration
                                .OcspCustomCname,
                        }
                        : undefined,
                }));
                if (observed !== JSON.stringify(desiredRevocation)) {
                    yield* acmpca
                        .updateCertificateAuthority({
                        CertificateAuthorityArn: arn,
                        RevocationConfiguration: desiredRevocation,
                    })
                        .pipe(retryWhileConcurrentlyModified);
                }
            }
            // 3b. SYNC tags — diff against OBSERVED cloud tags so adoption
            // converges.
            const currentTags = yield* listCaTags(arn);
            const desiredTags = {
                ...news.tags,
                ...internalTags,
            };
            const { upsert, removed } = diffTags(currentTags, desiredTags);
            if (upsert.length > 0) {
                yield* acmpca.tagCertificateAuthority({
                    CertificateAuthorityArn: arn,
                    Tags: upsert,
                });
            }
            if (removed.length > 0) {
                yield* acmpca.untagCertificateAuthority({
                    CertificateAuthorityArn: arn,
                    Tags: removed.map((Key) => ({ Key })),
                });
            }
            // 4. RETURN fresh attributes.
            const final = yield* describeCa(arn);
            yield* session.note(arn);
            return toAttrs(arn, final?.Status ?? ca.Status);
        }),
        delete: Effect.fn(function* ({ olds, output, session }) {
            const arn = output.certificateAuthorityArn;
            const ca = yield* describeCa(arn);
            if (ca === undefined || ca.Status === "DELETED") {
                return;
            }
            // An ACTIVE CA must be DISABLED before it can be deleted.
            if (ca.Status === "ACTIVE") {
                yield* acmpca
                    .updateCertificateAuthority({
                    CertificateAuthorityArn: arn,
                    Status: "DISABLED",
                })
                    .pipe(retryWhileConcurrentlyModified, Effect.catchTag("ResourceNotFoundException", () => Effect.void));
            }
            // The restoration window may only be set while the CA is in the
            // PENDING_CERTIFICATE or DISABLED state (CREATING/FAILED CAs have
            // no restoration period).
            const canSetWindow = ca.Status === "PENDING_CERTIFICATE" ||
                ca.Status === "DISABLED" ||
                ca.Status === "ACTIVE"; // just disabled above
            yield* acmpca
                .deleteCertificateAuthority({
                CertificateAuthorityArn: arn,
                PermanentDeletionTimeInDays: canSetWindow
                    ? (toWireDays(olds?.permanentDeletionTime) ?? 7)
                    : undefined,
            })
                .pipe(retryWhileConcurrentlyModified, Effect.catchTag("ResourceNotFoundException", () => Effect.void));
            yield* session.note(`Deleted certificate authority ${arn}`);
        }),
    };
}));
//# sourceMappingURL=CertificateAuthority.js.map