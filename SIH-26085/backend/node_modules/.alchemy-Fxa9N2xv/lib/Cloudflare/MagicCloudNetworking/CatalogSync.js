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
const TypeId = "Cloudflare.MagicCloudNetworking.CatalogSync";
/**
 * A Magic Cloud Networking catalog sync — continuously materializes the
 * catalog of discovered cloud resources (filtered by a policy expression)
 * into a destination such as a Zero Trust list.
 *
 * The destination is provisioned when the sync is created, so
 * `destinationType` is immutable and forces a replacement; `name`,
 * `description`, `policy`, and `updateMode` are all patched in place.
 *
 * Magic Cloud Networking is an entitlement-gated add-on (Magic WAN family).
 * On accounts without the entitlement every API call fails with the typed
 * `FeatureNotEnabled` error (Cloudflare code 1012, "feature not enabled").
 * ### Creating a sync
 * **Example:** Sync discovered VPC CIDRs into a Zero Trust list
 * ```typescript
 * const sync = yield* Cloudflare.MagicCloudNetworking.CatalogSync("VpcCidrs", {
 *   destinationType: "ZERO_TRUST_LIST",
 *   updateMode: "AUTO",
 *   policy: "kind in ('aws_vpc','azurerm_virtual_network','google_compute_network')",
 * });
 * // sync.destinationId is the provisioned Zero Trust list
 * ```
 *
 * **Example:** Manual sync without a destination
 * ```typescript
 * yield* Cloudflare.MagicCloudNetworking.CatalogSync("DryRun", {
 *   destinationType: "NONE",
 *   updateMode: "MANUAL",
 * });
 * ```
 *
 * ### Destroy behavior
 * **Example:** Keep the destination list on destroy
 * ```typescript
 * yield* Cloudflare.MagicCloudNetworking.CatalogSync("VpcCidrs", {
 *   destinationType: "ZERO_TRUST_LIST",
 *   updateMode: "AUTO",
 *   deleteDestination: false,
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/magic-cloud-networking/
 *
 * @resource
 * @product Magic Cloud Networking
 * @category Network
 */
export const CatalogSync = Resource(TypeId);
/**
 * Returns true if the given value is a CatalogSync resource.
 */
export const isCatalogSync = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const CatalogSyncProvider = () => Provider.succeed(CatalogSync, {
    stables: ["syncId", "accountId", "destinationType", "destinationId"],
    diff: Effect.fn(function* ({ olds, news, output }) {
        if (!isResolved(news))
            return undefined;
        const oldDestination = output?.destinationType ??
            (olds !== undefined && isResolved(olds)
                ? olds.destinationType
                : undefined);
        if (oldDestination !== undefined &&
            oldDestination !== news.destinationType) {
            return { action: "replace" };
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ id, output, olds }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        const deleteDestination = output?.deleteDestination ?? olds?.deleteDestination ?? true;
        // Owned path: refresh by our persisted sync id.
        if (output?.syncId) {
            const observed = yield* getSync(acct, output.syncId);
            if (observed)
                return toAttributes(observed, acct, deleteDestination);
            return undefined;
        }
        // Cold read — recover from lost state by matching the deterministic
        // physical name. Syncs carry no ownership markers, so report a match
        // as Unowned and let the engine gate adoption.
        const name = yield* syncName(id, olds?.name);
        const match = yield* findByName(acct, name);
        return match
            ? Unowned(toAttributes(match, acct, deleteDestination))
            : undefined;
    }),
    reconcile: Effect.fn(function* ({ id, news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const name = yield* syncName(id, news.name);
        const deleteDestination = news.deleteDestination ?? true;
        // 1. Observe — the id cached on `output` is a hint, not a guarantee:
        //    a missing sync falls through to the name scan and create.
        let observed = output?.syncId
            ? yield* getSync(output.accountId ?? accountId, output.syncId)
            : undefined;
        if (!observed) {
            observed = yield* findByName(accountId, name);
        }
        // 2. Ensure — create when missing. Names are not unique on
        //    Cloudflare's side so there is no AlreadyExists race to tolerate.
        if (!observed) {
            observed = yield* mcn.createCatalogSync({
                accountId,
                name,
                destinationType: news.destinationType,
                updateMode: news.updateMode,
                description: news.description,
                policy: news.policy,
            });
            return toAttributes(observed, accountId, deleteDestination);
        }
        // 3. Sync — diff observed cloud state against desired; PATCH only the
        //    delta and skip the call entirely on a no-op.
        const patch = {
            accountId,
            syncId: observed.id,
        };
        let dirty = false;
        if (observed.name !== name) {
            patch.name = name;
            dirty = true;
        }
        if (observed.updateMode !== news.updateMode) {
            patch.updateMode = news.updateMode;
            dirty = true;
        }
        if (news.description !== undefined &&
            observed.description !== news.description) {
            patch.description = news.description;
            dirty = true;
        }
        if (news.policy !== undefined && observed.policy !== news.policy) {
            patch.policy = news.policy;
            dirty = true;
        }
        if (dirty) {
            observed = yield* mcn.patchCatalogSync(patch);
        }
        return toAttributes(observed, accountId, deleteDestination);
    }),
    delete: Effect.fn(function* ({ output }) {
        yield* mcn
            .deleteCatalogSync({
            accountId: output.accountId,
            syncId: output.syncId,
            deleteDestination: output.deleteDestination,
        })
            .pipe(Effect.catchTag("CatalogSyncNotFound", () => Effect.void));
    }),
    // Account-scoped collection: exhaustively paginate the catalog-sync list
    // API. `deleteDestination` is an alchemy-only prop with no cloud
    // representation, so it defaults to `true`. Magic Cloud Networking is an
    // entitlement-gated add-on; an unentitled account rejects the list with
    // the typed `FeatureNotEnabled` error — treat that as "nothing to list".
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        return yield* mcn.listCatalogSyncs.pages({ accountId }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? []).map((sync) => toAttributes(sync, accountId, true)))), Effect.catchTag("FeatureNotEnabled", () => Effect.succeed([])));
    }),
});
/**
 * Read a sync by id, mapping "gone" (`CatalogSyncNotFound`) to `undefined`.
 */
const getSync = (accountId, syncId) => mcn.getCatalogSync({ accountId, syncId }).pipe(Effect.map((sync) => sync), Effect.catchTag("CatalogSyncNotFound", () => Effect.succeed(undefined)));
/**
 * Find a sync by exact name. Names are not unique on Cloudflare's side; if
 * several syncs carry the same name, pick the lexicographically-first id
 * for determinism.
 */
const findByName = (accountId, name) => mcn.listCatalogSyncs.items({ accountId }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
    .filter((sync) => sync.name === name)
    .sort((a, b) => a.id.localeCompare(b.id))
    .at(0)));
const syncName = (id, name) => Effect.gen(function* () {
    return name ?? (yield* createPhysicalName({ id, lowercase: true }));
});
const toAttributes = (sync, accountId, deleteDestination) => ({
    syncId: sync.id,
    accountId,
    name: sync.name,
    // Distilled widens generated string enums to open unions (`string & {}`).
    destinationType: sync.destinationType,
    destinationId: sync.destinationId,
    updateMode: sync.updateMode,
    description: sync.description,
    policy: sync.policy,
    lastUserUpdateAt: sync.lastUserUpdateAt,
    includesDiscoveriesUntil: sync.includesDiscoveriesUntil ?? undefined,
    deleteDestination,
});
//# sourceMappingURL=CatalogSync.js.map