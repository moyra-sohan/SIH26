import * as zeroTrust from "@distilled.cloud/cloudflare/zero-trust";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { isResourceOfType, Resource } from "../../Resource.js";
import { arrayEquals } from "../../Util/equal.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
import { normalizePolicyRules, } from "./Policy.js";
export const isApplication = (value) => isResourceOfType(value, "Cloudflare.Access.Application");
/**
 * A Cloudflare Zero Trust Access application.
 *
 * Replaces the curl-based `POST /accounts/{accountId}/access/apps` workflow
 * with an Alchemy-managed resource. Supports every Cloudflare application
 * type including `warp`, which Cloudflare requires for device enrolment via
 * the WARP client.
 *
 * Access policies are authored as standalone {@link Policy} resources
 * and referenced here by id — there is no inline-policy support.
 * ### Creating an Application
 * **Example:** Self-hosted application gated by a reusable Access policy
 * ```typescript
 * const allowMyOrg = yield* Cloudflare.Access.Policy("AllowMyOrg", {
 *   name: "Allow example.com via Google",
 *   decision: "allow",
 *   include: [{ emailDomain: { domain: "example.com" } }],
 * });
 *
 * const app = yield* Cloudflare.Access.Application("InternalDashboard", {
 *   type: "self_hosted",
 *   domain: "dashboard.example.com",
 *   sessionDuration: "24h",
 *   policies: [allowMyOrg],
 * });
 * ```
 *
 * **Example:** Managed OAuth for an MCP server
 * ```typescript
 * const app = yield* Cloudflare.Access.Application("McpServer", {
 *   type: "self_hosted",
 *   domain: "mcp.example.com",
 *   oauthConfiguration: {
 *     enabled: true,
 *     grant: {
 *       sessionDuration: "24h",
 *       accessTokenLifetime: "15m",
 *     },
 *     dynamicClientRegistration: {
 *       enabled: true,
 *       allowAnyOnLocalhost: true,
 *       allowAnyOnLoopback: true,
 *     },
 *   },
 * });
 * ```
 *
 * ### Protecting Cloudflare Workers
 * **Example:** Require Access on a specific Worker
 * ```typescript
 * // The application owns the policies (inline here — no separate Policy
 * // resource needed); the Worker enrolls itself via its `access` prop,
 * // covering its custom domains, routes, workers.dev URL, and version
 * // preview URLs.
 * const App = Cloudflare.Access.Application("TeamOnly", {
 *   type: "self_hosted",
 *   policies: [
 *     { decision: "allow", include: [{ emailDomain: "example.com" }] },
 *   ],
 * });
 *
 * export default class Api extends Cloudflare.Worker<Api>()("Api", {
 *   main: import.meta.url,
 *   access: { application: App },
 * }, /* ... *​/) {}
 * ```
 *
 * **Example:** Require Access on every Worker in the account
 * ```typescript
 * // Covers all current AND future Workers. Hostname-level policies beat
 * // Worker-level policies, which beat this account-level policy — so an
 * // individual Worker can still be opened up with its own application.
 * yield* Cloudflare.Access.Application("ProtectAllWorkers", {
 *   type: "self_hosted",
 *   destinations: [
 *     Cloudflare.Access.AllWorkers,         // production traffic of every Worker
 *     Cloudflare.Access.AllWorkerPreviews,  // every Worker's preview URLs
 *   ],
 *   policies: [
 *     { decision: "allow", include: [{ emailDomain: "example.com" }] },
 *   ],
 * });
 * ```
 *
 * ### Device-enrollment (warp)
 * **Example:** WARP device-enrollment application
 * ```typescript
 * // There can only be ONE warp app per account; Cloudflare auto-derives the
 * // domain (`${authDomain}/warp`) so do not pass `domain` for this type.
 * const allowCorp = yield* Cloudflare.Access.Policy("AllowCorpUsers", {
 *   name: "Allow corp users",
 *   decision: "allow",
 *   include: [{ emailDomain: { domain: "example.com" } }],
 * });
 *
 * const enroll = yield* Cloudflare.Access.Application("warp-login", {
 *   type: "warp",
 *   allowedIdps: [googleIdpId],
 *   autoRedirectToIdentity: true,
 *   sessionDuration: "720h",
 *   policies: [allowCorp],
 * });
 * ```
 *
 * ### Self-hosted with Google IdP
 * **Example:** Self-hosted application restricted to a Google Workspace group
 * ```typescript
 * const admins = yield* Cloudflare.Access.Policy("AdminsOnly", {
 *   name: "Admins only",
 *   decision: "allow",
 *   include: [
 *     {
 *       gsuite: {
 *         email: "admins@example.com",
 *         identityProviderId: googleIdpUuid,
 *       },
 *     },
 *   ],
 * });
 *
 * const app = yield* Cloudflare.Access.Application("AdminConsole", {
 *   type: "self_hosted",
 *   domain: "admin.example.com",
 *   allowedIdps: [googleIdpUuid],
 *   autoRedirectToIdentity: true,
 *   policies: [admins],
 * });
 * ```
 *
 * @resource
 * @product Access
 * @category Cloudflare One (Zero Trust)
 */
export const Application = Resource("Cloudflare.Access.Application");
// Ride out the two transient failure modes Cloudflare's Access endpoints
// exhibit under load:
//
//   - `AccessReferenceNotFound` (400 `policy <id> not found`): Access
//     validates referenced entities (e.g. the `policies` an application gates
//     on) synchronously, but a *freshly created* policy propagates
//     eventually-consistently — so a create/update referencing it, or a list
//     hydrating an app that references it, is briefly rejected. Distilled
//     types this 400 distinctly (vs. a generic `BadRequest`) so we retry only
//     this case and still fail fast on real bad requests.
//   - `Forbidden` (403): Cloudflare frequently returns 403 when throttling a
//     valid token rather than a dedicated rate-limit status, so a 403 here is
//     a transient back-pressure signal, not an auth failure.
//
// Capped exponential, bounded to ride out the window (~45s) then fail.
const retryTransientAccessError = (effect) => effect.pipe(Effect.retry({
    while: (e) => e._tag === "AccessReferenceNotFound" || e._tag === "Forbidden",
    schedule: Schedule.max([
        Schedule.min([
            Schedule.exponential("1 second", 1.5),
            Schedule.spaced("5 seconds"),
        ]),
        Schedule.recurs(12),
    ]),
}));
export const ApplicationProvider = () => Provider.succeed(Application, {
    stables: ["applicationId", "aud", "type", "accountId"],
    diff: Effect.fn(function* ({ olds = {}, news }) {
        if (olds.type !== undefined) {
            if (olds.type !== news.type) {
                return { action: "replace" };
            }
        }
    }),
    read: Effect.fn(function* ({ output, olds }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        // Prefer the persisted physical id. After state loss there is no
        // applicationId to probe, so fall back to matching an existing app
        // by domain — without this the engine plans a blind `create`, and
        // Cloudflare happily creates a second application on the same
        // domain with a fresh `aud`, silently breaking existing JWT
        // validation. Warp apps are excluded from the fallback: they are a
        // per-account singleton that `reconcile` already recovers.
        let observed;
        if (output?.applicationId) {
            observed = yield* observeById(accountId, output.applicationId);
        }
        else if (olds?.type !== "warp" && typeof olds?.domain === "string") {
            observed = yield* findByDomain(accountId, olds.domain);
        }
        else {
            return undefined;
        }
        if (!observed?.id || !observed.aud || !observed.type) {
            return undefined;
        }
        const domain = observed.domain ??
            output?.domain ??
            olds?.domain ??
            // Worker-destination apps (`worker`/`all_workers`/...) have no
            // hostname; Cloudflare omits `domain` for them entirely.
            (observed.destinations !== undefined ? "" : undefined);
        const name = observed.name ?? output?.name;
        if (domain === undefined || name === undefined) {
            return undefined;
        }
        const attrs = {
            applicationId: observed.id,
            aud: observed.aud,
            domain,
            destinations: observed.destinations ?? output?.destinations,
            // Live cloud state is authoritative. In particular, do not resurrect
            // a persisted configuration when Cloudflare explicitly returns null.
            oauthConfiguration: observed.oauthConfiguration,
            type: observed.type,
            name,
            accountId: output?.accountId ?? accountId,
            createdAt: observed.createdAt ?? output?.createdAt,
            updatedAt: observed.updatedAt ?? output?.updatedAt,
        };
        // Recovered by id → positively ours. Recovered by domain scan →
        // existence is certain but ownership is not (Access applications
        // carry no alchemy marker), so gate takeover behind `--adopt`.
        return output?.applicationId ? attrs : Unowned(attrs);
    }),
    reconcile: Effect.fn(function* ({ id, news, output, bindings }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const resolvedName = yield* resolveName(id, news.name);
        const resolvedIdps = resolveAllowedIdps(news.allowedIdps);
        const resolvedPolicies = resolvePolicies(news.policies);
        if (resolvedPolicies !== undefined &&
            resolvedPolicies.some((p) => typeof p !== "string" && isInlinePolicy(p)) &&
            resolvedPolicies.some((p) => typeof p === "string" || !isInlinePolicy(p))) {
            return yield* Effect.fail(new Error("Cloudflare Access applications cannot mix inline policies with " +
                "reusable policy references — use one form for the whole " +
                "`policies` list."));
        }
        const body = buildMutableBody(news, resolvedName, resolvedIdps, resolvedPolicies);
        // Destinations contributed through the binding contract (e.g. Workers
        // enrolling via their `access` prop) extend the declared ones. The
        // engine dedupes and sid-sorts bindings, so the merged order is
        // stable across deploys.
        const boundDestinations = (bindings ?? []).flatMap((b) => (b.data.destinations ?? []));
        if (boundDestinations.length > 0) {
            body.destinations = [
                ...(body.destinations ?? []),
                ...boundDestinations,
            ];
        }
        // 1. Observe
        let observed;
        if (output?.applicationId) {
            observed = yield* observeById(accountId, output.applicationId);
        }
        if (!observed && news.type === "warp") {
            // Warp is a singleton per account — reuse any existing app.
            observed = yield* findWarpApp(accountId);
        }
        // 2. Ensure
        if (!observed) {
            const created = yield* zeroTrust
                .createAccessApplicationForAccount({
                accountId,
                domain: body.domain,
                type: news.type,
                name: resolvedName,
                sessionDuration: body.sessionDuration,
                allowedIdps: body.allowedIdps === undefined
                    ? undefined
                    : Array.from(body.allowedIdps),
                autoRedirectToIdentity: body.autoRedirectToIdentity,
                appLauncherVisible: body.appLauncherVisible,
                tags: body.tags === undefined ? undefined : Array.from(body.tags),
                policies: toRequestPolicies(body.policies),
                destinations: body.destinations === undefined
                    ? undefined
                    : Array.from(body.destinations),
                oauthConfiguration: toRequestOAuthConfiguration(body.oauthConfiguration),
            })
                .pipe(
            // A referenced policy may be propagating, or the call may be
            // throttled (403) — ride out both before falling through.
            retryTransientAccessError, 
            // Distilled does not tag Conflict; surface any creation error
            // through the warp-singleton recovery path before re-failing.
            Effect.catch((err) => Effect.gen(function* () {
                if (news.type === "warp") {
                    const existing = yield* findWarpApp(accountId);
                    if (existing)
                        return existing;
                }
                return yield* Effect.fail(err);
            })));
            observed = narrowApp(created);
        }
        // 3. Sync — Cloudflare's update endpoint is PUT-style; resend the
        // full desired body whenever any mutable field differs.
        if (!observed.id) {
            return yield* Effect.fail(new Error("Cloudflare did not return an application id for Access application"));
        }
        if (!bodyEqualsObserved(body, observed)) {
            const updated = yield* zeroTrust
                .updateAccessApplicationForAccount({
                accountId,
                appId: observed.id,
                domain: body.domain ?? observed.domain,
                type: news.type,
                name: resolvedName,
                sessionDuration: body.sessionDuration,
                allowedIdps: body.allowedIdps === undefined
                    ? undefined
                    : Array.from(body.allowedIdps),
                autoRedirectToIdentity: body.autoRedirectToIdentity,
                appLauncherVisible: body.appLauncherVisible,
                tags: body.tags === undefined ? undefined : Array.from(body.tags),
                policies: toRequestPolicies(attachObservedPolicyIds(body.policies, observed.policies)),
                destinations: body.destinations === undefined
                    ? undefined
                    : Array.from(body.destinations),
                // Preserve a live managed OAuth configuration when the caller
                // does not manage it but another mutable field triggers this
                // PUT-style update.
                oauthConfiguration: toRequestOAuthConfiguration(mergeOAuthConfiguration(observed.oauthConfiguration, body.oauthConfiguration)),
            })
                // A just-added policy reference may still be propagating, or the
                // call may be throttled (403) — ride out both.
                .pipe(retryTransientAccessError);
            observed = narrowApp(updated);
        }
        // 4. Return
        if (!observed.id || !observed.aud || !observed.type) {
            return yield* Effect.fail(new Error("Cloudflare returned an Access application without id/aud/type"));
        }
        return {
            applicationId: observed.id,
            aud: observed.aud,
            domain: observed.domain ?? body.domain ?? "",
            destinations: observed.destinations ?? body.destinations,
            // Keep the provider output cloud-authoritative. If Cloudflare rejects
            // or clears the desired configuration, do not mask that drift with
            // the request body.
            oauthConfiguration: observed.oauthConfiguration,
            type: observed.type,
            name: observed.name ?? resolvedName,
            accountId,
            createdAt: observed.createdAt,
            updatedAt: observed.updatedAt,
        };
    }),
    // Account-scoped collection (pattern (b)): enumerate every Access
    // application in the ambient account, exhaustively paginated, and hydrate
    // each into the exact `read`/`reconcile` Attributes shape. Items missing
    // the mandatory id/aud/type triplet are skipped (typed per-item drop).
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        return yield* zeroTrust.listAccessApplicationsForAccount
            .pages({ accountId })
            .pipe(Stream.runCollect, 
        // The list hydrates each app's `policies`; Cloudflare rejects the
        // whole enumeration with the typed `AccessReferenceNotFound` (400
        // "policy ... not found") while a sibling app references a policy
        // that is still propagating or mid-deletion, and 403s the call when
        // throttling. Ride out both.
        retryTransientAccessError, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? []).flatMap((raw) => {
            const app = narrowApp(raw);
            if (!app.id || !app.aud || !app.type)
                return [];
            return [
                {
                    applicationId: app.id,
                    aud: app.aud,
                    domain: app.domain ?? "",
                    destinations: app.destinations,
                    oauthConfiguration: app.oauthConfiguration,
                    type: app.type,
                    name: app.name ?? "",
                    accountId,
                    createdAt: app.createdAt,
                    updatedAt: app.updatedAt,
                },
            ];
        }))));
    }),
    delete: Effect.fn(function* ({ output }) {
        yield* zeroTrust
            .deleteAccessApplicationForAccount({
            accountId: output.accountId,
            appId: output.applicationId,
        })
            .pipe(Effect.catch(() => Effect.void));
    }),
});
const resolveName = (id, name) => Effect.gen(function* () {
    if (name)
        return name;
    return yield* createPhysicalName({ id });
});
const resolveAllowedIdps = (idps) => idps === undefined
    ? undefined
    : // Inputs have already been resolved by the Plan layer by the time
        // we run, so they're concrete strings here.
        idps;
// Cloudflare allows only one `warp` app per account. When we have no
// cached applicationId, scan the account and reuse it. Requirements
// (Credentials | HttpClient) are inferred and provided by the Provider
// runtime — matches the un-annotated Tunnel.findTunnelByName pattern.
const findWarpApp = (accountId) => zeroTrust.listAccessApplicationsForAccount.items({ accountId }).pipe(Stream.runCollect, 
// A sibling app mid-teardown can transiently reject the whole
// enumeration (AccessReferenceNotFound), and Cloudflare 403s when
// throttling — same transient windows `list` rides out.
retryTransientAccessError, Effect.map((chunk) => Array.from(chunk).find((a) => a.type === "warp")), Effect.map((found) => found === undefined
    ? undefined
    : narrowApp(found)));
// Cold-recovery scan for `read` when no applicationId was persisted:
// match an existing application by its domain (unique per account for
// non-warp app types).
const findByDomain = (accountId, domain) => zeroTrust.listAccessApplicationsForAccount.items({ accountId }).pipe(Stream.runCollect, 
// A sibling app mid-teardown can transiently reject the whole
// enumeration (AccessReferenceNotFound), and Cloudflare 403s when
// throttling. A missed scan here is worse than a slow one: the engine
// would plan a blind `create` and either duplicate the app or trip
// Cloudflare's `application_already_exists` Conflict.
retryTransientAccessError, Effect.map((chunk) => Array.from(chunk).find((a) => a.domain === domain)), Effect.map((found) => found === undefined
    ? undefined
    : narrowApp(found)));
const observeById = (accountId, appId) => Effect.gen(function* () {
    const r = yield* zeroTrust
        .getAccessApplicationForAccount({ accountId, appId })
        .pipe(
    // A missing application is typed (404 → AccessApplicationNotFound):
    // observe falls through to recreate. Transient 403 back-pressure is
    // retried; anything else is a real failure and propagates.
    retryTransientAccessError, Effect.catchTag("AccessApplicationNotFound", () => Effect.succeed(undefined)));
    if (r === undefined)
        return undefined;
    return narrowApp(r);
});
const undef = (v) => v == null ? undefined : v;
const undefArr = (v) => v == null ? undefined : v.filter((x) => x != null);
const narrowOAuthConfiguration = (raw) => raw == null
    ? undefined
    : {
        enabled: undef(raw.enabled),
        grant: raw.grant == null
            ? undefined
            : {
                accessTokenLifetime: undef(raw.grant.accessTokenLifetime),
                sessionDuration: undef(raw.grant.sessionDuration),
            },
        dynamicClientRegistration: raw.dynamicClientRegistration == null
            ? undefined
            : {
                enabled: undef(raw.dynamicClientRegistration.enabled),
                allowedUris: undefArr(raw.dynamicClientRegistration.allowedUris),
                allowAnyOnLocalhost: undef(raw.dynamicClientRegistration.allowAnyOnLocalhost),
                allowAnyOnLoopback: undef(raw.dynamicClientRegistration.allowAnyOnLoopback),
            },
    };
const narrowApp = (raw) => ({
    id: undef(raw.id),
    aud: undef(raw.aud),
    name: undef(raw.name),
    type: raw.type == null ? undefined : raw.type,
    domain: undef(raw.domain),
    destinations: raw.destinations == null
        ? undefined
        : raw.destinations,
    oauthConfiguration: narrowOAuthConfiguration(raw.oauthConfiguration),
    allowedIdps: undefArr(raw.allowedIdps ?? undefined),
    autoRedirectToIdentity: undef(raw.autoRedirectToIdentity),
    appLauncherVisible: undef(raw.appLauncherVisible),
    sessionDuration: undef(raw.sessionDuration),
    tags: undefArr(raw.tags ?? undefined),
    policies: raw.policies == null
        ? undefined
        : raw.policies,
    createdAt: undef(raw.createdAt),
    updatedAt: undef(raw.updatedAt),
});
const isInlinePolicy = (p) => typeof p !== "string" && "decision" in p;
const policyIdOf = (p) => typeof p === "string" ? p : p.id;
const toRequestPolicy = (p) => {
    if (typeof p === "string")
        return p;
    if (isInlinePolicy(p)) {
        return {
            // `id` present when this inline body updates an observed
            // application-owned policy in place (attachObservedPolicyIds).
            id: p.id,
            decision: p.decision,
            include: normalizePolicyRules(p.include),
            exclude: normalizePolicyRules(p.exclude),
            require: normalizePolicyRules(p.require),
            name: p.name,
            precedence: p.precedence,
            sessionDuration: p.sessionDuration,
            approvalRequired: p.approvalRequired,
            approvalGroups: p.approvalGroups === undefined
                ? undefined
                : p.approvalGroups.map((g) => ({
                    approvalsNeeded: g.approvalsNeeded,
                    emailAddresses: g.emailAddresses === undefined
                        ? undefined
                        : Array.from(g.emailAddresses),
                    emailListUuid: g.emailListUuid,
                })),
            isolationRequired: p.isolationRequired,
            purposeJustificationRequired: p.purposeJustificationRequired,
            purposeJustificationPrompt: p.purposeJustificationPrompt,
        };
    }
    // The simple `{ id, precedence? }` form lacks the per-app override fields;
    // narrow once to a permissive view so we can copy them through uniformly.
    const rich = p;
    return {
        id: rich.id,
        precedence: rich.precedence,
        approvalRequired: rich.approvalRequired,
        isolationRequired: rich.isolationRequired,
        purposeJustificationRequired: rich.purposeJustificationRequired,
        purposeJustificationPrompt: rich.purposeJustificationPrompt,
        sessionDuration: rich.sessionDuration,
        approvalGroups: rich.approvalGroups === undefined
            ? undefined
            : rich.approvalGroups.map((g) => ({
                approvalsNeeded: g.approvalsNeeded,
                emailAddresses: g.emailAddresses === undefined
                    ? undefined
                    : Array.from(g.emailAddresses),
                emailListUuid: g.emailListUuid,
            })),
    };
};
const toRequestPolicies = (policies) => policies === undefined ? undefined : policies.map(toRequestPolicy);
const mergeOAuthConfiguration = (observed, desired) => {
    if (desired === undefined)
        return observed;
    return {
        enabled: desired.enabled ?? observed?.enabled,
        grant: desired.grant === undefined
            ? observed?.grant
            : {
                accessTokenLifetime: desired.grant.accessTokenLifetime ??
                    observed?.grant?.accessTokenLifetime,
                sessionDuration: desired.grant.sessionDuration ?? observed?.grant?.sessionDuration,
            },
        dynamicClientRegistration: desired.dynamicClientRegistration === undefined
            ? observed?.dynamicClientRegistration
            : {
                enabled: desired.dynamicClientRegistration.enabled ??
                    observed?.dynamicClientRegistration?.enabled,
                allowedUris: desired.dynamicClientRegistration.allowedUris ??
                    observed?.dynamicClientRegistration?.allowedUris,
                allowAnyOnLocalhost: desired.dynamicClientRegistration.allowAnyOnLocalhost ??
                    observed?.dynamicClientRegistration?.allowAnyOnLocalhost,
                allowAnyOnLoopback: desired.dynamicClientRegistration.allowAnyOnLoopback ??
                    observed?.dynamicClientRegistration?.allowAnyOnLoopback,
            },
    };
};
const toRequestOAuthConfiguration = (config) => config === undefined
    ? undefined
    : {
        enabled: config.enabled,
        grant: config.grant,
        dynamicClientRegistration: config.dynamicClientRegistration === undefined
            ? undefined
            : {
                ...config.dynamicClientRegistration,
                allowedUris: config.dynamicClientRegistration.allowedUris === undefined
                    ? undefined
                    : Array.from(config.dynamicClientRegistration.allowedUris),
            },
    };
const resolvePolicies = (policies) => policies === undefined
    ? undefined
    : // Inputs are concrete values here — the Plan layer resolved them
        // before the reconciler ran. A whole `Access.Policy` resource resolves
        // to its Attributes; normalize it to the bare policy id so everything
        // downstream (diffing, request building) sees one shape.
        policies.map((p) => (typeof p !== "string" && "policyId" in p ? p.policyId : p));
const buildMutableBody = (news, resolvedName, resolvedAllowedIdps, resolvedPolicies) => {
    const body = {
        type: news.type,
        name: resolvedName,
    };
    // Warp apps cannot accept a user-supplied domain — Cloudflare derives it.
    if (news.type !== "warp" && news.domain !== undefined) {
        body.domain = news.domain;
    }
    if (news.destinations !== undefined) {
        body.destinations = news.destinations;
    }
    if (news.oauthConfiguration !== undefined) {
        body.oauthConfiguration = news.oauthConfiguration;
    }
    if (news.sessionDuration !== undefined) {
        body.sessionDuration = news.sessionDuration;
    }
    if (resolvedAllowedIdps !== undefined) {
        body.allowedIdps = resolvedAllowedIdps;
    }
    if (news.autoRedirectToIdentity !== undefined) {
        body.autoRedirectToIdentity = news.autoRedirectToIdentity;
    }
    if (news.appLauncherVisible !== undefined) {
        body.appLauncherVisible = news.appLauncherVisible;
    }
    if (news.tags !== undefined) {
        body.tags = news.tags;
    }
    if (resolvedPolicies !== undefined) {
        body.policies = resolvedPolicies;
    }
    return body;
};
// ---------------------------------------------------------------------------
// Drift detection
// ---------------------------------------------------------------------------
const jsonEq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const oauthConfigurationEquals = (desired, observed) => {
    if (desired === undefined)
        return true;
    if (observed === undefined)
        return false;
    if (desired.enabled !== undefined && desired.enabled !== observed.enabled) {
        return false;
    }
    const desiredGrant = desired.grant;
    if (desiredGrant?.accessTokenLifetime !== undefined) {
        if (desiredGrant.accessTokenLifetime !== observed.grant?.accessTokenLifetime) {
            return false;
        }
    }
    if (desiredGrant?.sessionDuration !== undefined) {
        if (desiredGrant.sessionDuration !== observed.grant?.sessionDuration) {
            return false;
        }
    }
    const desiredRegistration = desired.dynamicClientRegistration;
    const observedRegistration = observed.dynamicClientRegistration;
    if (desiredRegistration?.enabled !== undefined &&
        desiredRegistration.enabled !== observedRegistration?.enabled) {
        return false;
    }
    if (desiredRegistration?.allowAnyOnLocalhost !== undefined &&
        desiredRegistration.allowAnyOnLocalhost !==
            observedRegistration?.allowAnyOnLocalhost) {
        return false;
    }
    if (desiredRegistration?.allowAnyOnLoopback !== undefined &&
        desiredRegistration.allowAnyOnLoopback !==
            observedRegistration?.allowAnyOnLoopback) {
        return false;
    }
    if (desiredRegistration?.allowedUris !== undefined &&
        !arrayEquals([...desiredRegistration.allowedUris].sort(), [...(observedRegistration?.allowedUris ?? [])].sort(), jsonEq)) {
        return false;
    }
    return true;
};
const policiesEq = (desired, observed) => {
    if (desired === undefined && observed === undefined)
        return true;
    if (desired === undefined || observed === undefined) {
        // An explicit empty `[]` should be honoured; nothing observed and
        // nothing desired collapses to "in sync".
        return (desired ?? []).length === 0 && (observed ?? []).length === 0;
    }
    if (desired.length !== observed.length)
        return false;
    for (let i = 0; i < desired.length; i++) {
        const d = desired[i];
        const o = observed[i];
        if (typeof d !== "string" && isInlinePolicy(d)) {
            // Inline (application-owned) policy: compare the fields the caller
            // set against the observed policy body. Cloudflare echoes rule
            // objects structurally, so JSON equality is stable; getting this
            // wrong is costly — a false inequality re-PUTs the policy list and
            // id-less inline items would mint fresh policies every deploy.
            if (o.reusable === true)
                return false;
            if (d.decision !== o.decision)
                return false;
            // Compare in wire shape: the caller may have used the scalar
            // shorthand while Cloudflare echoes expanded rules.
            const include = normalizePolicyRules(d.include);
            if (!jsonEq(include, (o.include ?? []))) {
                return false;
            }
            const exclude = normalizePolicyRules(d.exclude);
            if (exclude !== undefined &&
                !jsonEq(exclude, (o.exclude ?? []))) {
                return false;
            }
            const require = normalizePolicyRules(d.require);
            if (require !== undefined &&
                !jsonEq(require, (o.require ?? []))) {
                return false;
            }
            if (d.name !== undefined && d.name !== o.name)
                return false;
            if (d.precedence !== undefined &&
                o.precedence !== undefined &&
                d.precedence !== o.precedence) {
                return false;
            }
            if (d.sessionDuration !== undefined &&
                d.sessionDuration !== o.sessionDuration) {
                return false;
            }
            if (d.approvalRequired !== undefined &&
                d.approvalRequired !== (o.approvalRequired ?? false)) {
                return false;
            }
            if (d.isolationRequired !== undefined &&
                d.isolationRequired !== (o.isolationRequired ?? false)) {
                return false;
            }
            if (d.purposeJustificationRequired !== undefined &&
                d.purposeJustificationRequired !==
                    (o.purposeJustificationRequired ?? false)) {
                return false;
            }
            continue;
        }
        // Reference forms: an observed application-owned policy can never
        // satisfy a reusable reference.
        if (o.reusable === false)
            return false;
        if (policyIdOf(d) !== o.id)
            return false;
        if (typeof d !== "string") {
            if (d.precedence !== undefined &&
                o.precedence !== undefined &&
                d.precedence !== o.precedence) {
                return false;
            }
        }
    }
    return true;
};
/**
 * Zip desired inline policies with the observed application-owned policies
 * so an update PUT carries their ids and updates them in place — an id-less
 * inline item in an update creates a brand-new policy (and drops the old
 * one), churning policy ids on every deploy that touches any app field.
 * Positional matching, guarded on `reusable === false` (never attach a
 * reusable policy's id to an inline body — that would mutate the shared
 * policy) and on a matching decision.
 */
const attachObservedPolicyIds = (desired, observed) => desired === undefined || observed === undefined
    ? desired
    : desired.map((p, i) => {
        const o = observed[i];
        return typeof p !== "string" &&
            isInlinePolicy(p) &&
            p.id === undefined &&
            o?.id !== undefined &&
            o.reusable === false &&
            o.decision === p.decision
            ? { ...p, id: o.id }
            : p;
    });
const bodyEqualsObserved = (desired, observed) => {
    if (desired.name !== undefined && desired.name !== observed.name) {
        return false;
    }
    // Only diff domain when caller actually set one (warp's auto-derived
    // domain must not trigger a perpetual update loop).
    if (desired.domain !== undefined && desired.domain !== observed.domain) {
        return false;
    }
    // Same rule for destinations — Cloudflare may echo back an enriched
    // shape (e.g. server-assigned `vnetId`); we only diff when the caller
    // explicitly set them.
    if (desired.destinations !== undefined &&
        JSON.stringify(desired.destinations) !==
            JSON.stringify(observed.destinations ?? [])) {
        return false;
    }
    if (!oauthConfigurationEquals(desired.oauthConfiguration, observed.oauthConfiguration)) {
        return false;
    }
    if (desired.sessionDuration !== undefined &&
        desired.sessionDuration !== observed.sessionDuration) {
        return false;
    }
    if (desired.autoRedirectToIdentity !== undefined &&
        desired.autoRedirectToIdentity !== observed.autoRedirectToIdentity) {
        return false;
    }
    if (desired.appLauncherVisible !== undefined &&
        desired.appLauncherVisible !== observed.appLauncherVisible) {
        return false;
    }
    if (desired.allowedIdps !== undefined &&
        !arrayEquals(desired.allowedIdps, observed.allowedIdps, jsonEq)) {
        return false;
    }
    if (desired.tags !== undefined &&
        !arrayEquals(desired.tags, observed.tags, jsonEq)) {
        return false;
    }
    if (!policiesEq(desired.policies, observed.policies)) {
        return false;
    }
    return true;
};
//# sourceMappingURL=Application.js.map