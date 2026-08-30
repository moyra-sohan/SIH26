import * as aiGateway from "@distilled.cloud/cloudflare/ai-gateway";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Stream from "effect/Stream";
import { deepEqual, isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
const TypeId = "Cloudflare.AI.Dataset";
/**
 * A saved log filter ("dataset") on a Cloudflare.AI. Gateway.
 *
 * Datasets capture a slice of the gateway's request logs (filtered by
 * provider, model, success, cost, tokens, etc.) and serve as the input to AI
 * Gateway evaluations. Name, enablement, and filters are all mutable in
 * place; only moving the dataset to a different gateway forces a replacement.
 * ### Creating a Dataset
 * **Example:** Capture successful requests
 * ```typescript
 * const gateway = yield* Cloudflare.AI.Gateway("Gateway");
 *
 * const dataset = yield* Cloudflare.AI.Dataset("SuccessLogs", {
 *   gatewayId: gateway.gatewayId,
 *   filters: [{ key: "success", operator: "eq", value: [true] }],
 * });
 * ```
 *
 * **Example:** Capture logs for a specific model
 * ```typescript
 * const dataset = yield* Cloudflare.AI.Dataset("LlamaLogs", {
 *   gatewayId: gateway.gatewayId,
 *   name: "llama-traffic",
 *   filters: [
 *     { key: "provider", operator: "eq", value: ["workers-ai"] },
 *     { key: "model", operator: "contains", value: ["llama"] },
 *   ],
 * });
 * ```
 *
 * ### Updating a Dataset
 * **Example:** Disable collection without deleting
 * ```typescript
 * const dataset = yield* Cloudflare.AI.Dataset("SuccessLogs", {
 *   gatewayId: gateway.gatewayId,
 *   enable: false,
 *   filters: [{ key: "success", operator: "eq", value: [true] }],
 * });
 * ```
 *
 * @see https://developers.cloudflare.com/ai-gateway/evaluations/set-up-evaluations/
 *
 * @resource
 * @product AI Gateway
 * @category AI
 */
export const Dataset = Resource(TypeId, {
    aliases: ["Cloudflare.AiGateway.Dataset"],
});
/**
 * Returns true if the given value is a Dataset resource.
 */
export const isDataset = (value) => Predicate.hasProperty(value, "Type") && value.Type === TypeId;
export const DatasetProvider = () => Provider.succeed(Dataset, {
    stables: ["datasetId", "accountId", "gatewayId", "createdAt"],
    diff: Effect.fn(function* ({ olds, news, output }) {
        if (!isResolved(news))
            return undefined;
        const { accountId } = yield* yield* CloudflareEnvironment;
        if ((output?.accountId ?? accountId) !== accountId) {
            return { action: "replace" };
        }
        // The gateway is a path parameter — a dataset cannot move between
        // gateways in place. By diff time both sides are resolved strings.
        const oldGatewayId = output?.gatewayId ?? olds?.gatewayId;
        if (typeof oldGatewayId === "string" &&
            typeof news.gatewayId === "string" &&
            oldGatewayId !== news.gatewayId) {
            return { action: "replace" };
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ id, olds, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        const gatewayId = output?.gatewayId ?? olds?.gatewayId;
        if (gatewayId === undefined)
            return undefined;
        if (output?.datasetId) {
            const observed = yield* getDataset(acct, gatewayId, output.datasetId);
            return observed ? toAttributes(observed, acct) : undefined;
        }
        // Cold read — recover from lost state by matching the deterministic
        // physical name. Names are not unique on Cloudflare's side; an exact
        // match on our generated/explicit name is the best identity we have.
        const name = yield* createDatasetName(id, olds?.name);
        const match = yield* findByName(acct, gatewayId, name);
        return match ? toAttributes(match, acct) : undefined;
    }),
    reconcile: Effect.fn(function* ({ id, news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const gatewayId = news.gatewayId;
        const name = yield* createDatasetName(id, news.name);
        const desired = {
            name,
            enable: news.enable ?? true,
            filters: news.filters ?? [],
        };
        // Observe — the datasetId cached on `output` is a hint, not a
        // guarantee: a missing dataset falls through and we recreate.
        let observed = output?.datasetId
            ? yield* getDataset(output.accountId ?? accountId, gatewayId, output.datasetId)
            : undefined;
        if (!observed) {
            // Ensure — greenfield (or out-of-band delete). Cloudflare enforces
            // name uniqueness per gateway, so a name conflict (e.g. a leftover
            // from an interrupted run or a create race) is converged by
            // adopting the existing dataset and syncing it to the desired
            // shape below instead of failing.
            const created = yield* aiGateway
                .createDataset({
                accountId,
                gatewayId,
                ...desired,
            })
                .pipe(Effect.catchTag("DatasetNameAlreadyExists", (originalError) => findByName(accountId, gatewayId, name).pipe(Effect.flatMap((match) => match ? Effect.succeed(match) : Effect.fail(originalError)))));
            observed = created;
        }
        // Sync — diff observed cloud state against desired; the update API is
        // a PUT that takes the full body, so send everything, but skip the
        // call entirely on a no-op.
        const observedShape = {
            name: observed.name,
            enable: observed.enable,
            filters: normalizeFilters(observed.filters),
        };
        if (deepEqual(observedShape, desired)) {
            return toAttributes(observed, accountId);
        }
        const updated = yield* aiGateway.updateDataset({
            accountId,
            gatewayId,
            id: observed.id,
            ...desired,
        });
        return toAttributes(updated, accountId);
    }),
    delete: Effect.fn(function* ({ output }) {
        yield* aiGateway
            .deleteDataset({
            accountId: output.accountId,
            gatewayId: output.gatewayId,
            id: output.datasetId,
        })
            // Cloudflare reports both a missing dataset and a missing gateway
            // with code 7002 on this endpoint — either way it's already gone.
            .pipe(Effect.catchTag("DatasetNotFound", () => Effect.void));
    }),
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        // Datasets are scoped under a gateway and there is no account-wide
        // dataset list, so fan out: enumerate every account gateway, then
        // exhaustively list each gateway's datasets.
        const gateways = yield* aiGateway.listAiGateways
            .pages({ accountId })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.result ?? [])));
        const rows = yield* Effect.forEach(gateways, (gateway) => aiGateway.listDatasets
            .pages({ accountId, gatewayId: gateway.id })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? []).map((d) => toAttributes(d, accountId)))), 
        // A gateway removed between enumeration and its dataset list
        // is gone — skip it rather than failing the whole listing.
        Effect.catchTag("GatewayNotFound", () => Effect.succeed([]))), { concurrency: 10 });
        return rows.flat();
    }),
});
/**
 * Read a dataset by id, mapping "gone" (`DatasetNotFound`, Cloudflare error
 * code 7002 — which also covers a deleted parent gateway) to `undefined`.
 */
const getDataset = (accountId, gatewayId, id) => aiGateway
    .getDataset({ accountId, gatewayId, id })
    .pipe(Effect.catchTag("DatasetNotFound", () => Effect.succeed(undefined)));
/**
 * Find a dataset by exact name. Cloudflare's `name` query is a fuzzy match,
 * so re-check exactly client-side. If several datasets carry the same name,
 * pick the oldest for determinism. A missing parent gateway means the
 * dataset is gone too.
 */
const findByName = (accountId, gatewayId, name) => aiGateway.listDatasets
    .items({ accountId, gatewayId, name, perPage: 50 })
    .pipe(Stream.filter((d) => d.name === name), Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .at(0)), Effect.catchTag("GatewayNotFound", () => Effect.succeed(undefined)));
const createDatasetName = (id, name) => Effect.gen(function* () {
    return name ?? (yield* createPhysicalName({ id, lowercase: true }));
});
/**
 * Strip readonly markers / open-union widening from the wire filters so they
 * diff structurally against the user's props.
 */
const normalizeFilters = (filters) => filters.map((f) => ({
    key: f.key,
    operator: f.operator,
    value: [...f.value],
}));
const toAttributes = (dataset, accountId) => ({
    datasetId: dataset.id,
    accountId,
    gatewayId: dataset.gatewayId,
    name: dataset.name,
    enable: dataset.enable,
    filters: normalizeFilters(dataset.filters),
    createdAt: dataset.createdAt,
    modifiedAt: dataset.modifiedAt,
});
//# sourceMappingURL=Dataset.js.map