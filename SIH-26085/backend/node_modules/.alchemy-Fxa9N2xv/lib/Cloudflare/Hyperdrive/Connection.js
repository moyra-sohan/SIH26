import * as hyperdrive from "@distilled.cloud/cloudflare/hyperdrive";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import * as ProviderLayer from "../../Local/ProviderLayer.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { isResourceOfType, Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
import { generateLocalId } from "../LocalRuntime.js";
/**
 * A Cloudflare Hyperdrive configuration.
 *
 * Hyperdrive accelerates and pools connections to existing PostgreSQL or
 * MySQL databases, exposing them to Workers via a binding. Create a config
 * as a resource, then bind it to a Worker to obtain a connection string.
 * ### Creating a Hyperdrive
 * **Example:** Public Postgres origin
 * ```typescript
 * const hd = yield* Cloudflare.Hyperdrive.Connection("my-pg", {
 *   origin: {
 *     scheme: "postgres",
 *     host: "db.example.com",
 *     port: 5432,
 *     database: "app",
 *     user: "app",
 *     password: yield* Config.redacted("DB_PASSWORD"),
 *   },
 * });
 * ```
 *
 * ### Binding to a Worker
 * **Example:** Using Hyperdrive inside a Worker
 * ```typescript
 * const hd = yield* Cloudflare.Hyperdrive.Connect(MyConnection);
 * const url = yield* hd.connectionString;
 * ```
 *
 * @resource
 * @product Hyperdrive
 * @category Storage & Databases
 */
export const Connection = Resource("Cloudflare.Hyperdrive");
export const isHyperdriveConnection = (value) => isResourceOfType(value, "Cloudflare.Hyperdrive");
export const ProviderLive = () => Provider.succeed(Connection, {
    // `hyperdriveId` is stable within live mode: `updateConfig` never changes
    // it, and the dev→deploy transition (which DOES mint a new id) is a
    // mode-switch the engine plans as a REPLACEMENT, so updates can rely on it.
    stables: ["hyperdriveId", "accountId"],
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        return yield* hyperdrive.listConfigs.pages({ accountId }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.result ?? []).map((c) => ({
            hyperdriveId: c.id,
            name: c.name,
            accountId,
            // The connection-string password is write-only and never
            // returned by the API, so it is absent here (matching `read`,
            // which sources it from `olds`).
            origin: { ...c.origin },
            mtls: {
                caCertificateId: c.mtls?.caCertificateId ?? undefined,
                mtlsCertificateId: c.mtls?.mtlsCertificateId ?? undefined,
                sslmode: c.mtls?.sslmode ?? undefined,
            },
            dev: undefined,
        })))));
    }),
    diff: Effect.fn(function* ({ id, olds, news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        if (!isResolved(news))
            return undefined;
        if ((output?.accountId ?? accountId) !== accountId) {
            return { action: "replace" };
        }
        const oldName = output?.name ?? (yield* createConfigName(id, olds.name));
        // Auto-generated names are engine-owned: the deployed name stays
        // authoritative even if the generator would name this id differently
        // today. Only an explicit user-provided name can force a replace.
        const name = news.name ?? oldName;
        if (oldName !== name) {
            return { action: "replace" };
        }
    }),
    read: Effect.fn(function* ({ id, output, olds }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        if (output?.hyperdriveId) {
            return yield* hyperdrive
                .getConfig({
                accountId: output.accountId,
                hyperdriveId: output.hyperdriveId,
            })
                .pipe(Effect.map((c) => ({
                hyperdriveId: c.id,
                name: c.name,
                accountId: output.accountId,
                origin: {
                    ...c.origin,
                    password: olds?.origin?.password,
                },
                mtls: {
                    caCertificateId: c.mtls?.caCertificateId ?? undefined,
                    mtlsCertificateId: c.mtls?.mtlsCertificateId ?? undefined,
                    sslmode: c.mtls?.sslmode ?? undefined,
                },
                dev: output?.dev,
            })), Effect.catchTag("HyperdriveConfigNotFound", () => Effect.succeed(undefined)));
        }
        const name = yield* createConfigName(id, olds?.name);
        const match = yield* findByName(name);
        if (match) {
            return {
                hyperdriveId: match.id,
                name: match.name,
                accountId,
                origin: {
                    ...match.origin,
                    password: olds?.origin?.password,
                },
                mtls: {
                    caCertificateId: match.mtls?.caCertificateId ?? undefined,
                    mtlsCertificateId: match.mtls?.mtlsCertificateId ?? undefined,
                    sslmode: match.mtls?.sslmode ?? undefined,
                },
                dev: output?.dev,
            };
        }
        return undefined;
    }),
    reconcile: Effect.fn(function* ({ id, news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const name = output?.name ?? (yield* createConfigName(id, news.name));
        const requestBody = {
            origin: toRequestOrigin(news.origin),
            caching: news.caching,
            mtls: news.mtls,
            originConnectionLimit: news.originConnectionLimit,
        };
        // Observe + ensure. When we know the hyperdriveId we go straight
        // to update; otherwise we createConfig and fall back to "find by
        // name then update" if Cloudflare reports the name is already in
        // use (race or a cold-start adoption).
        const synced = output?.hyperdriveId
            ? yield* hyperdrive.updateConfig({
                accountId: output.accountId,
                hyperdriveId: output.hyperdriveId,
                name: output.name,
                ...requestBody,
            })
            : yield* hyperdrive
                .createConfig({ accountId, name, ...requestBody })
                .pipe(Effect.catchTag("InvalidHyperdriveConfig", (originalError) => Effect.gen(function* () {
                const match = yield* findByName(name);
                if (!match) {
                    return yield* Effect.fail(originalError);
                }
                return yield* hyperdrive.updateConfig({
                    accountId,
                    hyperdriveId: match.id,
                    name,
                    ...requestBody,
                });
            })));
        return {
            hyperdriveId: synced.id,
            name: synced.name,
            accountId: output?.accountId ?? accountId,
            origin: news.origin,
            mtls: news.mtls ?? {},
            dev: news.dev,
        };
    }),
    delete: Effect.fn(function* ({ output }) {
        yield* hyperdrive
            .deleteConfig({
            accountId: output.accountId,
            hyperdriveId: output.hyperdriveId,
        })
            .pipe(Effect.catchTag("HyperdriveConfigNotFound", () => Effect.void));
    }),
});
/**
 * Local (dev) provider — the config is purely virtual: reconcile mints a
 * `dev:` id and echoes the desired props into attributes, with no cloud API
 * calls. The actual local behavior lives in the Worker binding: the local
 * runtime's Hyperdrive plugin is an origin passthrough driven by the
 * `hyperdrives` record `ConnectBinding` lowers (the `dev` prop when set,
 * otherwise the real `origin`).
 */
export const ProviderLocal = () => Provider.succeed(Connection, {
    stables: ["accountId"],
    diff: Effect.fn(function* ({ news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        if (!output?.hyperdriveId)
            return { action: "update" };
        if (!isResolved(news))
            return undefined;
        if (output.accountId !== accountId) {
            return { action: "replace" };
        }
        // Fall through to the engine's default prop diff (name/origin/dev
        // changes update in place; reconcile re-echoes them).
    }),
    read: Effect.fn(function* ({ output }) {
        // Purely virtual — the persisted state row is the source of truth.
        return output ?? undefined;
    }),
    reconcile: Effect.fn(function* ({ id, news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        return {
            hyperdriveId: output?.hyperdriveId ?? generateLocalId(),
            name: yield* createConfigName(id, news.name),
            accountId: output?.accountId ?? accountId,
            origin: news.origin,
            mtls: news.mtls ?? {},
            dev: news.dev,
        };
    }),
    delete: Effect.fn(function* () {
        // Purely virtual — dropping the state row is enough.
    }),
});
export const ConnectionProvider = () => ProviderLayer.dual(Connection, {
    local: () => ProviderLocal(),
    live: () => ProviderLive(),
});
const createConfigName = (id, name) => Effect.gen(function* () {
    if (name)
        return name;
    return yield* createPhysicalName({ id, lowercase: true });
});
const findByName = (name) => Effect.gen(function* () {
    const { accountId } = yield* yield* CloudflareEnvironment;
    return yield* hyperdrive.listConfigs.items({ accountId }).pipe(Stream.filter((c) => c.name === name), Stream.runHead, Effect.map(Option.getOrUndefined));
});
export const defaultPort = (scheme) => scheme === "mysql" ? 3306 : 5432;
const unwrap = (v) => Redacted.isRedacted(v) ? Redacted.value(v) : v;
/**
 * Build the request body shape that the distilled `createConfig`/`updateConfig`
 * methods accept. Secrets are unwrapped here because the distilled TS types
 * declare `password`/`access_client_secret` as plain strings even though the
 * runtime schema also accepts `Redacted<string>`.
 */
const toRequestOrigin = (origin) => {
    if ("accessClientId" in origin) {
        return {
            accessClientId: unwrap(origin.accessClientId),
            accessClientSecret: unwrap(origin.accessClientSecret),
            database: origin.database,
            host: origin.host,
            password: unwrap(origin.password),
            scheme: origin.scheme,
            user: origin.user,
        };
    }
    return {
        database: origin.database,
        host: origin.host,
        password: unwrap(origin.password),
        port: origin.port ?? defaultPort(origin.scheme),
        scheme: origin.scheme,
        user: origin.user,
    };
};
//# sourceMappingURL=Connection.js.map