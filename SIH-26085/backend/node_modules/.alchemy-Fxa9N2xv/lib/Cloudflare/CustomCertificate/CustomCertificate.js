import * as customCertificates from "@distilled.cloud/cloudflare/custom-certificates";
import crypto from "node:crypto";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
import { listAllZones } from "../Zone/lookup.js";
const TypeId = "Cloudflare.CustomCertificate.CustomCertificate";
/**
 * A Cloudflare custom (BYO) edge certificate — upload your own SSL
 * certificate and private key to be served at Cloudflare's edge for a zone.
 *
 * Custom certificates are a **Business / Enterprise** feature; on lower
 * plans every API call fails with the typed `PlanLevelNotAllowed` error
 * (Cloudflare error code 1011).
 *
 * The certificate id is stable across in-place rotations: PATCHing a new
 * `certificate`/`privateKey` pair keeps the same id. Cloudflare never echoes
 * the PEM contents back, so a SHA-256 content hash of the pair is persisted
 * in the attributes and used as the rotation diff baseline. Only `zoneId`
 * and `type` force a replacement.
 * ### Uploading a certificate
 * **Example:** Basic SNI certificate
 * ```typescript
 * const cert = yield* Cloudflare.CustomCertificate.CustomCertificate("EdgeCert", {
 *   zoneId: zone.zoneId,
 *   certificate: certPem,
 *   privateKey: Redacted.make(keyPem),
 *   type: "sni_custom",
 * });
 * ```
 *
 * **Example:** Optimal bundle with a Geo Key Manager region
 * ```typescript
 * yield* Cloudflare.CustomCertificate.CustomCertificate("EuCert", {
 *   zoneId: zone.zoneId,
 *   certificate: certPem,
 *   privateKey: Redacted.make(keyPem),
 *   type: "sni_custom",
 *   bundleMethod: "optimal",
 *   geoRestrictions: { label: "eu" },
 * });
 * ```
 *
 * ### Rotating the certificate
 * **Example:** Rotate in place
 * ```typescript
 * // Changing `certificate`/`privateKey` PATCHes the same certificate id —
 * // no replacement, no coverage gap.
 * yield* Cloudflare.CustomCertificate.CustomCertificate("EdgeCert", {
 *   zoneId: zone.zoneId,
 *   certificate: renewedCertPem,
 *   privateKey: Redacted.make(renewedKeyPem),
 *   type: "sni_custom",
 * });
 * ```
 *
 * ### Prioritizing overlapping certificates
 * **Example:** Explicit priority
 * ```typescript
 * // Higher priority breaks ties across overlapping legacy_custom certs.
 * yield* Cloudflare.CustomCertificate.CustomCertificate("PrimaryCert", {
 *   zoneId: zone.zoneId,
 *   certificate: certPem,
 *   privateKey: Redacted.make(keyPem),
 *   priority: 1,
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/ssl/edge-certificates/custom-certificates/
 *
 * @resource
 * @product Custom Certificates
 * @category SSL/TLS & Certificates
 */
export const CustomCertificate = Resource(TypeId, {
    aliases: ["Cloudflare.CustomCertificate"],
});
/**
 * Returns true if the given value is a CustomCertificate resource.
 */
export const isCustomCertificate = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const CustomCertificateProvider = () => Provider.succeed(CustomCertificate, {
    stables: ["certificateId", "zoneId", "type", "uploadedOn"],
    // Zone-scoped collection: fan out over every zone and exhaustively
    // paginate that zone's custom certificates. The PEM contents and the
    // uploaded `type` are write-only (never echoed back), so — exactly like
    // `read`'s cold adoption path — the unknowable `type`/`contentHash`
    // default to `legacy_custom`/`""`. Plan-gated zones reject the route with
    // the typed `PlanLevelNotAllowed` (custom certs are Business/Enterprise),
    // zones that can't host custom certs (partial/pending/deleted between
    // list and read) reject with `ZoneNotFound` ("Cannot find a valid zone"),
    // and freshly-scoped tokens may blip `Forbidden`; all three skip the zone
    // so enumeration still returns every zone it can read.
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const zones = yield* listAllZones(accountId);
        const rows = yield* Effect.forEach(zones, (zone) => customCertificates.listCustomCertificates
            .pages({ zoneId: zone.id })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? []).map((cert) => toAttributes(cert, {
            type: "legacy_custom",
            contentHash: "",
        })))), Effect.catchTag(["PlanLevelNotAllowed", "ZoneNotFound", "Forbidden"], () => Effect.succeed([]))), { concurrency: 10 });
        return rows.flat();
    }),
    diff: Effect.fn(function* ({ olds, news, output }) {
        if (!isResolved(news))
            return undefined;
        // Zone move replaces. zoneId is Input<string>; compare only once
        // both sides are concrete.
        const oldZone = output?.zoneId ??
            (olds !== undefined && isResolved(olds)
                ? olds.zoneId
                : undefined);
        if (typeof oldZone === "string" &&
            typeof news.zoneId === "string" &&
            oldZone !== news.zoneId) {
            return { action: "replace" };
        }
        // `type` is create-only (the PATCH body does not accept it).
        const oldType = output?.type ??
            (olds !== undefined && isResolved(olds) ? olds.type : undefined) ??
            "legacy_custom";
        if ((news.type ?? "legacy_custom") !== oldType) {
            return { action: "replace" };
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ output, olds }) {
        const zoneId = output?.zoneId ?? olds?.zoneId;
        if (zoneId === undefined)
            return undefined;
        // Owned path: refresh by our persisted certificate id.
        if (output?.certificateId) {
            const observed = yield* getCertificate(zoneId, output.certificateId);
            return observed
                ? toAttributes(observed, {
                    type: output.type,
                    contentHash: output.contentHash,
                })
                : undefined;
        }
        // Cold path: state was lost. Custom certificates carry no ownership
        // markers and no name, so identify the desired certificate by its
        // parsed expiry timestamp (an upload of the same PEM always yields
        // the same `expires_on`) and report it as `Unowned` so the engine
        // gates takeover behind the adopt policy.
        if (olds?.certificate === undefined)
            return undefined;
        const parsed = yield* parseCertificate(olds.certificate);
        const observed = yield* findByExpiry(zoneId, parsed.expiresAtMs);
        if (observed) {
            return Unowned(toAttributes(observed, {
                type: olds.type ?? "legacy_custom",
                // The live cert/key contents are unknowable — force one
                // convergence PATCH after adoption.
                contentHash: "",
            }));
        }
        return undefined;
    }),
    reconcile: Effect.fn(function* ({ news, output }) {
        // Inputs have been resolved to concrete strings by Plan.
        const zoneId = news.zoneId;
        const customCsrId = news.customCsrId;
        const type = news.type ?? output?.type ?? "legacy_custom";
        const desiredHash = yield* hashContent(news);
        // 1. Observe — the certificate id cached on `output` is a hint, not
        //    a guarantee: a missing certificate falls through to create.
        let observed = output?.certificateId
            ? yield* getCertificate(zoneId, output.certificateId)
            : undefined;
        // 2. Ensure — upload when missing. Certificates have no uniqueness
        //    constraint on Cloudflare's side, so there is no AlreadyExists
        //    race to tolerate.
        if (!observed) {
            observed = yield* customCertificates.createCustomCertificate({
                zoneId,
                certificate: news.certificate,
                privateKey: news.privateKey
                    ? Redacted.value(news.privateKey)
                    : undefined,
                customCsrId,
                bundleMethod: news.bundleMethod,
                type: news.type,
                geoRestrictions: news.geoRestrictions,
                policy: news.policy,
                deploy: news.deploy,
            });
            // The freshly uploaded contents are the desired contents.
            observed = yield* syncPriority(zoneId, observed, news.priority);
            return toAttributes(observed, { type, contentHash: desiredHash });
        }
        // 3. Sync — diff observed cloud state against desired. The PEM
        //    contents are write-only, so the persisted content hash is the
        //    baseline for the certificate/key pair; everything else diffs
        //    against the observed response.
        const certDirty = output?.contentHash !== desiredHash;
        const bundleDirty = news.bundleMethod !== undefined &&
            observed.bundleMethod !== news.bundleMethod;
        const geoDirty = news.geoRestrictions !== undefined &&
            observed.geoRestrictions?.label !== news.geoRestrictions.label;
        const policyDirty = news.policy !== undefined &&
            (observed.policyRestrictions ?? undefined) !== news.policy;
        if (certDirty || bundleDirty || geoDirty || policyDirty) {
            observed = yield* customCertificates.patchCustomCertificate({
                zoneId,
                customCertificateId: observed.id,
                ...(certDirty
                    ? {
                        certificate: news.certificate,
                        privateKey: news.privateKey
                            ? Redacted.value(news.privateKey)
                            : undefined,
                        customCsrId,
                        deploy: news.deploy,
                    }
                    : {}),
                ...(bundleDirty ? { bundleMethod: news.bundleMethod } : {}),
                ...(geoDirty ? { geoRestrictions: news.geoRestrictions } : {}),
                ...(policyDirty ? { policy: news.policy } : {}),
            });
        }
        observed = yield* syncPriority(zoneId, observed, news.priority);
        return toAttributes(observed, { type, contentHash: desiredHash });
    }),
    delete: Effect.fn(function* ({ output }) {
        yield* customCertificates
            .deleteCustomCertificate({
            zoneId: output.zoneId,
            customCertificateId: output.certificateId,
        })
            .pipe(Effect.catchTag("CustomCertificateNotFound", () => Effect.void));
    }),
});
/**
 * Read a certificate by id, mapping "gone" (`CustomCertificateNotFound`,
 * HTTP 404) to `undefined`.
 */
const getCertificate = (zoneId, customCertificateId) => customCertificates.getCustomCertificate({ zoneId, customCertificateId }).pipe(Effect.map((cert) => cert), Effect.catchTag("CustomCertificateNotFound", () => Effect.succeed(undefined)));
/**
 * Find a certificate in the zone whose `expires_on` matches the desired
 * PEM's parsed expiry. Uploading the same certificate always produces the
 * same expiry, making it the best identity available (the API neither
 * echoes the PEM nor exposes the serial number). If several match, pick the
 * oldest upload for determinism.
 */
const findByExpiry = (zoneId, expiresAtMs) => customCertificates.listCustomCertificates.items({ zoneId }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
    .filter((cert) => cert.expiresOn != null &&
    Date.parse(cert.expiresOn) === expiresAtMs)
    .sort((a, b) => (a.uploadedOn ?? "").localeCompare(b.uploadedOn ?? ""))
    .at(0)));
/**
 * Parse the leaf certificate of a PEM bundle. Sync CPU-only Node API,
 * wrapped in `Effect.try` so a malformed PEM surfaces as a typed failure
 * instead of a thrown exception.
 */
const parseCertificate = (pem) => Effect.try({
    try: () => {
        const x509 = new crypto.X509Certificate(pem);
        return { expiresAtMs: Date.parse(x509.validTo) };
    },
    catch: (cause) => new Error(`failed to parse certificate PEM: ${cause}`, { cause }),
});
/**
 * SHA-256 over the write-only inputs (certificate, private key, CSR id).
 * Persisted in the attributes as the rotation diff baseline because the API
 * never returns the PEM contents.
 */
const hashContent = (news) => Effect.sync(() => crypto
    .createHash("sha256")
    .update(news.certificate)
    .update("\n")
    .update(news.privateKey ? Redacted.value(news.privateKey) : "")
    .update("\n")
    .update(news.customCsrId ?? "")
    .digest("hex"));
/**
 * Converge the certificate's priority via the prioritize endpoint when an
 * explicit `priority` is desired and differs from the observed value.
 */
const syncPriority = (zoneId, observed, priority) => Effect.gen(function* () {
    if (priority === undefined || observed.priority === priority) {
        return observed;
    }
    yield* customCertificates.putPrioritize({
        zoneId,
        certificates: [{ id: observed.id, priority }],
    });
    // Re-observe so the returned attributes reflect the final state.
    const fresh = yield* getCertificate(zoneId, observed.id);
    return fresh ?? observed;
});
const toAttributes = (cert, meta) => ({
    certificateId: cert.id,
    zoneId: cert.zoneId,
    hosts: [...(cert.hosts ?? [])],
    issuer: cert.issuer ?? undefined,
    signature: cert.signature ?? undefined,
    expiresOn: cert.expiresOn ?? undefined,
    uploadedOn: cert.uploadedOn ?? undefined,
    modifiedOn: cert.modifiedOn ?? undefined,
    bundleMethod: cert.bundleMethod ?? undefined,
    type: meta.type,
    priority: cert.priority ?? undefined,
    status: cert.status ?? undefined,
    policyRestrictions: cert.policyRestrictions ?? undefined,
    geoRestrictions: cert.geoRestrictions?.label
        ? { label: cert.geoRestrictions.label }
        : undefined,
    contentHash: meta.contentHash,
});
//# sourceMappingURL=CustomCertificate.js.map