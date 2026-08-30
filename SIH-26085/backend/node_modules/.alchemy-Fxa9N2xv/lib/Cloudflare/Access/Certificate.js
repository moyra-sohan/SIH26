import * as zeroTrust from "@distilled.cloud/cloudflare/zero-trust";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
/**
 * A Cloudflare Zero Trust Access mTLS certificate. Uploads a CA certificate
 * that Access uses to validate client certificates presented to protected
 * applications on the associated hostnames.
 *
 * The certificate body is immutable — changing the PEM replaces the
 * resource. The name and associated hostnames converge in place.
 * ### Creating a Certificate
 * **Example:** Upload a CA certificate
 * ```typescript
 * const ca = yield* Cloudflare.Access.Certificate("ClientCa", {
 *   certificate: CA_PEM, // -----BEGIN CERTIFICATE----- ...
 * });
 * ```
 *
 * **Example:** Certificate with associated hostnames
 * ```typescript
 * const ca = yield* Cloudflare.Access.Certificate("ClientCa", {
 *   name: "corp-client-ca",
 *   certificate: CA_PEM,
 *   associatedHostnames: ["app.example.com"],
 * });
 * ```
 *
 * ### Updating Hostnames
 * **Example:** Associate more hostnames in place
 * ```typescript
 * const ca = yield* Cloudflare.Access.Certificate("ClientCa", {
 *   certificate: CA_PEM,
 *   associatedHostnames: ["app.example.com", "admin.example.com"],
 * });
 * ```
 *
 * @resource
 * @product Access
 * @category Cloudflare One (Zero Trust)
 */
export const Certificate = Resource("Cloudflare.Access.Certificate");
export const isCertificate = (value) => Predicate.hasProperty(value, "Type") &&
    value.Type === "Cloudflare.Access.Certificate";
export const CertificateProvider = () => Provider.succeed(Certificate, {
    stables: ["certificateId", "accountId", "fingerprint"],
    // Account-scoped collection (pattern b). Cloudflare never returns the
    // certificate PEM body, so the persisted `certificate` field is empty for
    // enumerated items — every other attribute matches the `read` shape.
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        return yield* zeroTrust.listAccessCertificatesForAccount
            .pages({ accountId })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? [])
            .filter((c) => c.id != null)
            .map((c) => toAttrs(c, accountId, "")))));
    }),
    diff: Effect.fn(function* ({ news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        if (!isResolved(news))
            return undefined;
        if ((output?.accountId ?? accountId) !== accountId) {
            return { action: "replace" };
        }
        // The certificate body is immutable on the Cloudflare API.
        if (output && news.certificate !== output.certificate) {
            return { action: "replace" };
        }
        // name/associatedHostnames converge via PUT.
    }),
    read: Effect.fn(function* ({ id, output, olds }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        if (output?.certificateId) {
            const direct = yield* zeroTrust
                .getAccessCertificateForAccount({
                accountId: acct,
                certificateId: output.certificateId,
            })
                .pipe(Effect.catchTag("AccessCertificateNotFound", () => Effect.succeed(undefined)));
            if (direct && direct.id) {
                return toAttrs(direct, acct, output.certificate);
            }
        }
        // Cold lookup — the certificate body never comes back from the API,
        // so recovery is only possible when we still know the uploaded PEM.
        const pem = olds?.certificate ?? output?.certificate;
        if (pem === undefined)
            return undefined;
        const name = yield* createCertificateName(id, olds?.name ?? output?.name);
        const existing = yield* findCertificateByName(acct, name);
        if (!existing || !existing.id)
            return undefined;
        return toAttrs(existing, acct, pem);
    }),
    reconcile: Effect.fn(function* ({ id, news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        const name = yield* createCertificateName(id, news.name);
        const desiredHostnames = news.associatedHostnames ?? [];
        // Observe — prefer the cached id, fall back to a name lookup so we
        // recover from out-of-band deletes and state-persistence failures.
        let observed;
        if (output?.certificateId) {
            observed = yield* zeroTrust
                .getAccessCertificateForAccount({
                accountId: acct,
                certificateId: output.certificateId,
            })
                .pipe(Effect.catchTag("AccessCertificateNotFound", () => Effect.succeed(undefined)));
        }
        if (!observed || !observed.id) {
            observed = yield* findCertificateByName(acct, name);
        }
        // Ensure — upload the certificate when missing. Tolerate a same-named
        // create race by re-observing.
        if (!observed || !observed.id) {
            const created = yield* zeroTrust
                .createAccessCertificateForAccount({
                accountId: acct,
                name,
                certificate: news.certificate,
                associatedHostnames: desiredHostnames,
            })
                .pipe(Effect.catch((err) => Effect.gen(function* () {
                const existing = yield* findCertificateByName(acct, name);
                if (existing && existing.id)
                    return existing;
                return yield* Effect.fail(err);
            })));
            if (!created.id) {
                return yield* Effect.fail(new Error("Certificate: created certificate missing id"));
            }
            return toAttrs(created, acct, news.certificate);
        }
        // Sync — converge name and associated hostnames via PUT only when the
        // observed state differs from the desired state.
        const observedHostnames = [...(observed.associatedHostnames ?? [])];
        if (observed.name !== name ||
            !sameMembers(observedHostnames, desiredHostnames)) {
            const updated = yield* zeroTrust.updateAccessCertificateForAccount({
                accountId: acct,
                certificateId: observed.id,
                name,
                associatedHostnames: desiredHostnames,
            });
            observed = {
                id: updated.id ?? observed.id,
                name: updated.name ?? name,
                fingerprint: updated.fingerprint ?? observed.fingerprint,
                associatedHostnames: updated.associatedHostnames ?? desiredHostnames,
                expiresOn: updated.expiresOn ?? observed.expiresOn,
            };
        }
        return toAttrs(observed, acct, news.certificate);
    }),
    delete: Effect.fn(function* ({ output }) {
        // The API refuses to delete a certificate that still has associated
        // hostnames — disassociate first, tolerating an already-gone cert.
        yield* zeroTrust
            .updateAccessCertificateForAccount({
            accountId: output.accountId,
            certificateId: output.certificateId,
            name: output.name,
            associatedHostnames: [],
        })
            .pipe(Effect.catchTag("AccessCertificateNotFound", () => Effect.void));
        yield* zeroTrust
            .deleteAccessCertificateForAccount({
            accountId: output.accountId,
            certificateId: output.certificateId,
        })
            .pipe(Effect.catchTag("AccessCertificateNotFound", () => Effect.void));
    }),
});
const createCertificateName = (id, name) => Effect.gen(function* () {
    if (name)
        return name;
    return yield* createPhysicalName({ id });
});
const findCertificateByName = (acct, name) => zeroTrust.listAccessCertificatesForAccount.items({ accountId: acct }).pipe(Stream.filter((c) => c.name === name), Stream.runHead, Effect.map(Option.getOrUndefined), Effect.catch(() => Effect.succeed(undefined)));
const sameMembers = (a, b) => a.length === b.length &&
    [...a].sort().join("\n") === [...b].sort().join("\n");
const toAttrs = (observed, accountId, certificate) => ({
    certificateId: observed.id,
    accountId,
    name: observed.name ?? "",
    certificate,
    fingerprint: observed.fingerprint ?? undefined,
    associatedHostnames: [...(observed.associatedHostnames ?? [])],
    expiresOn: observed.expiresOn ?? undefined,
});
//# sourceMappingURL=Certificate.js.map