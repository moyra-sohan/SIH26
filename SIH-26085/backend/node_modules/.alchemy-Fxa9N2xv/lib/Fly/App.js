import * as machines from "@distilled.cloud/fly-io/machines";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { Unowned } from "../AdoptPolicy.js";
import { isResolved } from "../Diff.js";
import * as Provider from "../Provider.js";
import { Resource } from "../Resource.js";
import { resolveOrgSlug } from "./Environment.js";
import { createFlyAppName, isAlchemyOwnedMetadata, matchesAlchemyPhysicalName, sanitizeFlyAppName, } from "./Metadata.js";
/**
 * A Fly.App is a global namespace in your account. It contains Machines,
 * Services, Secrets, IPs, and certificates.
 *
 * @see https://fly.io/docs/machines/api/apps-resource/
 *
 * ### Create an App
 * Alchemy generates a unique name unless you pass one. `url` is
 * `https://{appName}.fly.dev`. Nothing answers there until a
 * {@link Service} or {@link Machine} publishes a proxy service and the App
 * has an {@link IpAssignment}.
 *
 * **Example:** Generated name
 * ```typescript
 * const site = yield* Fly.App("Site");
 * ```
 *
 * :::note
 * Prefer omitting `name` in tests and CI so names stay unique and
 * reclaimable.
 * :::
 *
 * ### A stable hostname
 * Pass `name` when you need a stable `fly.dev` hostname.
 *
 * **Example:** Explicit name
 * ```typescript
 * const site = yield* Fly.App("Site", {
 *   name: "my-site",
 * });
 * ```
 *
 * :::caution[Changing `name` replaces the App]
 * Fly cannot have two Apps with the same name. Alchemy deletes the
 * old App first, then creates the new one.
 * :::
 *
 * ### Organization
 * Org defaults to the current token. Pass `orgSlug` to pin it.
 *
 * **Example:** Pin an org
 * ```typescript
 * const site = yield* Fly.App("Site", {
 *   name: "my-site",
 *   orgSlug: "my-org",
 * });
 * ```
 *
 * :::caution[Changing `orgSlug` replaces the App]
 * The App is created in the new org. The old App is deleted.
 * :::
 *
 * ### Subdomains
 * `enableSubdomains: true` turns on `*.{appName}.fly.dev`.
 *
 * **Example:** Enable subdomains
 * ```typescript
 * const site = yield* Fly.App("Site", {
 *   name: "my-site",
 *   enableSubdomains: true,
 * });
 * ```
 *
 * :::note[Create-only]
 * Flipping `enableSubdomains` later is ignored.
 * :::
 *
 * ### Isolated network
 * `network` is an optional 6PN name.
 *
 * **Example:** Custom network
 * ```typescript
 * const site = yield* Fly.App("Site", {
 *   name: "my-site",
 *   network: "private",
 * });
 * ```
 *
 * :::caution[Changing `network` replaces the App]
 * The App is recreated on the new network.
 * :::
 *
 * ### Module-scope declarations
 * Declare the App once. Pass it into every child. Resource-valued props
 * accept the resource or an Effect producing it. Do not unwrap it just
 * to pass it along.
 *
 * **Example:** Module-scope App
 * ```typescript
 * // src/app.ts
 * import * as Fly from "alchemy/Fly";
 *
 * export const Site = Fly.App("Site");
 * ```
 *
 * @resource
 */
export const App = Resource("Fly.App");
export class AppNotCreated extends Data.TaggedError("Fly.AppNotCreated") {
}
const toAttrs = (app, fallbackName) => {
    const appName = app.name ?? fallbackName ?? "";
    return {
        appId: app.id ?? appName,
        appName,
        internalNumericId: app.internal_numeric_id,
        network: app.network,
        status: app.status,
        orgSlug: app.organization?.slug,
        machineCount: app.machine_count,
        volumeCount: app.volume_count,
        url: `https://${appName}.fly.dev`,
    };
};
const resolveAppName = (id, name, existing) => Effect.gen(function* () {
    if (name !== undefined)
        return sanitizeFlyAppName(name);
    if (existing !== undefined)
        return existing;
    return yield* createFlyAppName(id);
});
const getByName = (appName) => machines
    .getApp({ app_name: appName })
    .pipe(Effect.catchTag("NotFound", () => Effect.succeed(undefined)));
const hasAlchemyMachines = (appName) => machines.listMachines({ app_name: appName }).pipe(Effect.map((machines) => machines.some((machine) => isAlchemyOwnedMetadata(machine.config?.metadata))), Effect.catchTag(["NotFound", "Forbidden"], () => Effect.succeed(false)));
const hasAlchemyNamed = (names) => names.some((name) => matchesAlchemyPhysicalName(name));
const hasAlchemyVolumes = (appName) => machines.listVolumes({ app_name: appName }).pipe(Effect.map((volumes) => hasAlchemyNamed(volumes.map((volume) => volume.name))), Effect.catchTag(["NotFound", "Forbidden"], () => Effect.succeed(false)));
const hasAlchemySecrets = (appName) => machines.listSecrets({ app_name: appName }).pipe(Effect.map((res) => hasAlchemyNamed((res.secrets ?? []).map((secret) => secret.name))), Effect.catchTag(["NotFound", "Forbidden"], () => Effect.succeed(false)));
const hasAlchemySecretKeys = (appName) => machines.listSecretKeys({ app_name: appName }).pipe(Effect.map((res) => hasAlchemyNamed((res.secret_keys ?? []).map((key) => key.name))), Effect.catchTag(["NotFound", "Forbidden"], () => Effect.succeed(false)));
const isOwnedApp = (app) => Effect.gen(function* () {
    if (matchesAlchemyPhysicalName(app.name))
        return true;
    const appName = app.name;
    if (appName === undefined || appName.length === 0)
        return false;
    const flags = yield* Effect.all([
        hasAlchemyMachines(appName),
        hasAlchemyVolumes(appName),
        hasAlchemySecrets(appName),
        hasAlchemySecretKeys(appName),
    ], { concurrency: 4 });
    return flags.some(Boolean);
});
/**
 * Apps in the current token's org that Alchemy owns. Used by {@link App}
 * `list()` and by child resources (Machine / Volume / Secret) so nuke
 * never enumerates the whole org unfiltered.
 */
export const listOwnedApps = Effect.fn(function* () {
    const orgSlug = yield* resolveOrgSlug();
    const { apps } = yield* machines.listApps({
        org_slug: orgSlug,
    });
    const flagged = yield* Effect.forEach(apps ?? [], (app) => isOwnedApp(app).pipe(Effect.map((owned) => (owned ? toAttrs(app) : undefined))), { concurrency: 8 });
    return flagged.filter((attrs) => attrs !== undefined);
});
export const AppProvider = () => Provider.succeed(App, {
    stables: ["appId", "appName", "orgSlug", "network", "internalNumericId"],
    diff: Effect.fn(function* ({ news, output }) {
        if (news === undefined || !isResolved(news))
            return undefined;
        if (output === undefined)
            return undefined;
        const desiredName = news.name !== undefined
            ? sanitizeFlyAppName(news.name)
            : output.appName;
        const nameChanged = desiredName !== output.appName;
        const orgChanged = news.orgSlug !== undefined && news.orgSlug !== output.orgSlug;
        const networkChanged = news.network !== undefined && news.network !== output.network;
        if (nameChanged || orgChanged || networkChanged) {
            return {
                action: "replace",
                // Same physical name cannot exist twice — delete the old App first.
                deleteFirst: !nameChanged,
            };
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ id, olds, output }) {
        const name = yield* resolveAppName(id, olds?.name, output?.appName);
        const found = (output?.appName !== undefined
            ? yield* getByName(output.appName)
            : undefined) ?? (yield* getByName(name));
        if (found === undefined)
            return undefined;
        const attrs = toAttrs(found, name);
        if (output !== undefined)
            return attrs;
        return (yield* isOwnedApp(found)) ? attrs : Unowned(attrs);
    }),
    list: listOwnedApps,
    reconcile: Effect.fn(function* ({ id, news, output }) {
        const props = news ?? {};
        const name = yield* resolveAppName(id, props.name, output?.appName);
        const orgSlug = props.orgSlug ?? (yield* resolveOrgSlug());
        // Observe by the cached name, then the desired name.
        let current = output?.appName !== undefined
            ? yield* getByName(output.appName)
            : undefined;
        if (current === undefined && output?.appName !== name) {
            current = yield* getByName(name);
        }
        if (current === undefined) {
            yield* machines
                .createApp({
                name,
                org_slug: orgSlug,
                network: props.network,
                enable_subdomains: props.enableSubdomains,
            })
                .pipe(Effect.catchTag(["Conflict", "UnprocessableEntity"], () => Effect.void));
            current = yield* getByName(name);
        }
        if (current === undefined) {
            return yield* new AppNotCreated({ name });
        }
        // No update API. enableSubdomains is create-only.
        return toAttrs(current, name);
    }),
    delete: Effect.fn(function* ({ output }) {
        const appName = output.appName;
        if (appName.length === 0)
            return;
        const volumes = yield* machines
            .listVolumes({ app_name: appName })
            .pipe(Effect.catchTag(["NotFound", "Forbidden"], () => Effect.succeed([])));
        yield* Effect.forEach(volumes, (volume) => {
            const volumeId = volume.id;
            if (volumeId === undefined ||
                volumeId.length === 0 ||
                !matchesAlchemyPhysicalName(volume.name)) {
                return Effect.void;
            }
            return machines
                .deleteVolume({ app_name: appName, volume_id: volumeId })
                .pipe(Effect.asVoid, Effect.catchTag(["NotFound", "Conflict"], () => Effect.void));
        }, { concurrency: 4 });
        yield* machines
            .deleteApp({ app_name: appName })
            .pipe(Effect.catchTag("NotFound", () => Effect.void));
        yield* getByName(appName).pipe(Effect.map((app) => app === undefined), Effect.repeat({
            schedule: Schedule.spaced("1 second"),
            until: (gone) => gone,
            times: 8,
        }));
    }),
});
//# sourceMappingURL=App.js.map