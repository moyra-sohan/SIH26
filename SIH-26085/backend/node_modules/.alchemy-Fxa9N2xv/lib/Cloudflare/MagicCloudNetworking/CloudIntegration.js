import * as mcn from "@distilled.cloud/cloudflare/magic-cloud-networking";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Stream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
const TypeId = "Cloudflare.MagicCloudNetworking.CloudIntegration";
/**
 * A Magic Cloud Networking cloud integration — registers an AWS, Azure, or
 * GCP account with Cloudflare so Magic Cloud Networking can discover its
 * networking resources (VPCs, subnets, gateways, …).
 *
 * Creating an integration returns provider-side setup data; credential
 * wiring (`awsArn`, `azureSubscriptionId`/`azureTenantId`,
 * `gcpProjectId`/`gcpServiceAccountEmail`) is applied in place. Only
 * `cloudType` forces a replacement.
 *
 * Magic Cloud Networking is an entitlement-gated add-on (Magic WAN family).
 * On accounts without the entitlement every API call fails with the typed
 * `FeatureNotEnabled` error (Cloudflare code 1012, "feature not enabled").
 * ### Creating an integration
 * **Example:** Register an AWS account
 * ```typescript
 * const aws = yield* Cloudflare.MagicCloudNetworking.CloudIntegration("Discovery", {
 *   cloudType: "AWS",
 *   description: "production AWS account",
 * });
 * // aws.lifecycleState === "PENDING_SETUP" until credentials are wired
 * ```
 *
 * **Example:** Wire credentials after creating the IAM role
 * ```typescript
 * yield* Cloudflare.MagicCloudNetworking.CloudIntegration("Discovery", {
 *   cloudType: "AWS",
 *   awsArn: "arn:aws:iam::123456789012:role/cloudflare-mcn-discovery",
 * });
 * ```
 *
 * ### GCP
 * **Example:** Register a GCP project
 * ```typescript
 * yield* Cloudflare.MagicCloudNetworking.CloudIntegration("GcpDiscovery", {
 *   cloudType: "GOOGLE",
 *   gcpProjectId: "my-project",
 *   gcpServiceAccountEmail: "mcn@my-project.iam.gserviceaccount.com",
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/magic-cloud-networking/
 *
 * @resource
 * @product Magic Cloud Networking
 * @category Network
 */
export const CloudIntegration = Resource(TypeId);
/**
 * Returns true if the given value is a CloudIntegration resource.
 */
export const isCloudIntegration = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const CloudIntegrationProvider = () => Provider.succeed(CloudIntegration, {
    stables: ["integrationId", "accountId", "cloudType"],
    diff: Effect.fn(function* ({ olds, news, output }) {
        if (!isResolved(news))
            return undefined;
        const oldCloudType = output?.cloudType ??
            (olds !== undefined && isResolved(olds) ? olds.cloudType : undefined);
        if (oldCloudType !== undefined && oldCloudType !== news.cloudType) {
            return { action: "replace" };
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ id, output, olds }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        // Owned path: refresh by our persisted integration id.
        if (output?.integrationId) {
            const observed = yield* getIntegration(acct, output.integrationId);
            if (observed)
                return toAttributes(observed, acct);
            return undefined;
        }
        // Cold read — recover from lost state by matching the deterministic
        // physical name. Integrations carry no ownership markers, so report
        // a match as Unowned and let the engine gate adoption.
        const name = yield* integrationName(id, olds?.friendlyName);
        const match = yield* findByName(acct, name);
        return match ? Unowned(toAttributes(match, acct)) : undefined;
    }),
    reconcile: Effect.fn(function* ({ id, news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const name = yield* integrationName(id, news.friendlyName);
        // 1. Observe — the id cached on `output` is a hint, not a guarantee:
        //    a missing integration falls through to the name scan and create.
        let observed = output?.integrationId
            ? yield* getIntegration(output.accountId ?? accountId, output.integrationId)
            : undefined;
        if (!observed) {
            observed = yield* findByName(accountId, name);
        }
        // 2. Ensure — create when missing. Names are not unique on
        //    Cloudflare's side so there is no AlreadyExists race to tolerate.
        if (!observed) {
            const created = yield* mcn.createCloudIntegration({
                accountId,
                cloudType: news.cloudType,
                friendlyName: name,
                description: news.description,
            });
            observed = yield* getIntegration(accountId, created.id).pipe(Effect.map((latest) => latest ?? created));
        }
        // 3. Sync — diff observed cloud state against desired; PATCH only the
        //    delta and skip the call entirely on a no-op.
        const patch = {
            accountId,
            providerId: observed.id,
        };
        let dirty = false;
        if (observed.friendlyName !== name) {
            patch.friendlyName = name;
            dirty = true;
        }
        if (news.description !== undefined &&
            (observed.description ?? "") !== news.description) {
            patch.description = news.description;
            dirty = true;
        }
        for (const key of credentialKeys) {
            const desired = news[key];
            if (desired !== undefined && (observed[key] ?? "") !== desired) {
                patch[key] = desired;
                dirty = true;
            }
        }
        if (dirty) {
            observed = yield* mcn.patchCloudIntegration(patch);
        }
        return toAttributes(observed, accountId);
    }),
    delete: Effect.fn(function* ({ output }) {
        yield* mcn
            .deleteCloudIntegration({
            accountId: output.accountId,
            providerId: output.integrationId,
        })
            .pipe(Effect.catchTag("CloudIntegrationNotFound", () => Effect.void));
    }),
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        // Account-scoped collection: the list response already carries the
        // full per-integration shape `read` returns, so no per-item hydrate
        // is needed. Paginate exhaustively and map each row to Attributes.
        return yield* mcn.listCloudIntegrations.pages({ accountId }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? []).map((integration) => toAttributes(integration, accountId)))), 
        // Magic Cloud Networking is an entitlement-gated add-on; accounts
        // without it can't enumerate integrations — treat as empty.
        Effect.catchTag("FeatureNotEnabled", () => Effect.succeed([])));
    }),
});
const credentialKeys = [
    "awsArn",
    "azureSubscriptionId",
    "azureTenantId",
    "gcpProjectId",
    "gcpServiceAccountEmail",
];
/**
 * Read an integration by id, mapping "gone" (`CloudIntegrationNotFound`)
 * to `undefined`.
 */
const getIntegration = (accountId, providerId) => mcn.getCloudIntegration({ accountId, providerId }).pipe(Effect.map((integration) => integration), Effect.catchTag("CloudIntegrationNotFound", () => Effect.succeed(undefined)));
/**
 * Find an integration by exact friendly name. Names are not unique on
 * Cloudflare's side; if several integrations carry the same name, pick the
 * lexicographically-first id for determinism.
 */
const findByName = (accountId, friendlyName) => mcn.listCloudIntegrations.items({ accountId }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
    .filter((integration) => integration.friendlyName === friendlyName)
    .sort((a, b) => a.id.localeCompare(b.id))
    .at(0)));
const integrationName = (id, name) => Effect.gen(function* () {
    return name ?? (yield* createPhysicalName({ id, lowercase: true }));
});
const toAttributes = (integration, accountId) => ({
    integrationId: integration.id,
    accountId,
    // Distilled widens generated string enums to open unions (`string & {}`).
    cloudType: integration.cloudType,
    friendlyName: integration.friendlyName,
    description: integration.description ?? undefined,
    lifecycleState: integration.lifecycleState,
    state: integration.state,
    awsArn: integration.awsArn ?? undefined,
    azureSubscriptionId: integration.azureSubscriptionId ?? undefined,
    azureTenantId: integration.azureTenantId ?? undefined,
    gcpProjectId: integration.gcpProjectId ?? undefined,
    gcpServiceAccountEmail: integration.gcpServiceAccountEmail ?? undefined,
    lastUpdated: integration.lastUpdated,
});
//# sourceMappingURL=CloudIntegration.js.map