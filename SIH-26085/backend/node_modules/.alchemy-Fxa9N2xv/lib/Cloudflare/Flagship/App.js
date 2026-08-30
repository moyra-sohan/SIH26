import * as flagship from "@distilled.cloud/cloudflare/flagship";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { isResourceOfType, Resource } from "../../Resource.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
const TypeId = "Cloudflare.Flagship.App";
/**
 * A Cloudflare Flagship app — a container for feature flags.
 *
 * Flagship is Cloudflare's feature flag service. Flags are organized into
 * apps that map to your projects or services; the app's `appId` is what a
 * Worker's `Flagship` binding points at and what every evaluation call is
 * scoped to. The name is mutable in place; the app id never changes.
 * ### Creating an App
 * **Example:** App with a generated name
 * ```typescript
 * const app = yield* Cloudflare.Flagship.App("Flags", {});
 * ```
 *
 * **Example:** App with an explicit name
 * ```typescript
 * const app = yield* Cloudflare.Flagship.App("Flags", {
 *   name: "my-service-flags",
 * });
 * ```
 *
 * ### Using the App
 * **Example:** Define flags in the app
 * ```typescript
 * const app = yield* Cloudflare.Flagship.App("Flags", {});
 *
 * const flag = yield* Cloudflare.Flagship.Flag("NewCheckout", {
 *   appId: app.appId,
 *   key: "new-checkout",
 *   defaultVariation: "off",
 *   variations: { off: false, on: true },
 * });
 * ```
 *
 * ### Binding to a Worker
 * **Example:** Effect-style Worker (recommended)
 * `Cloudflare.Flagship.ReadFlags(app)` attaches the binding to the surrounding
 * Worker and returns the runtime client for evaluating flags. Every `Flagship`
 * method is mirrored as an Effect, so no `Effect.tryPromise` wrapping is needed.
 * ```typescript
 * export const App = Cloudflare.Flagship.App("Flags", {});
 *
 * Cloudflare.Worker(
 *   "FlagsWorker",
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     const flags = yield* Cloudflare.Flagship.ReadFlags(App);
 *     return {
 *       fetch: Effect.gen(function* () {
 *         const enabled = yield* flags.getBooleanValue("new-checkout", false, {
 *           userId: "user-42",
 *         });
 *         return HttpServerResponse.text(enabled ? "on" : "off");
 *       }),
 *     };
 *   }).pipe(Effect.provide(Cloudflare.Flagship.ReadFlagsBinding)),
 * );
 * ```
 *
 * **Example:** Declare the binding on `env`
 * Declaring the app on a Worker's `env` maps it to the native `Flagship`
 * runtime binding via `InferEnv`.
 * ```typescript
 * export const App = Cloudflare.Flagship.App("Flags", {});
 *
 * export const Worker = Cloudflare.Worker("Worker", {
 *   main: "./src/worker.ts",
 *   env: { FLAGS: App },
 * });
 *
 * export type WorkerEnv = Cloudflare.InferEnv<typeof Worker>;
 * //   { FLAGS: Flagship }
 * ```
 *
 * **Example:** Async-style worker with the raw runtime binding
 * ```typescript
 * import type { WorkerEnv } from "../alchemy.run.ts";
 *
 * export default {
 *   async fetch(request: Request, env: WorkerEnv) {
 *     const enabled = await env.FLAGS.getBooleanValue("new-checkout", false, {
 *       userId: "user-42",
 *     });
 *     return new Response(enabled ? "on" : "off");
 *   },
 * };
 * ```
 *
 * @see https://developers.cloudflare.com/flagship/
 * @see https://developers.cloudflare.com/api/resources/flagship/
 *
 * @resource
 * @product Flagship
 * @category Developer Platform
 */
export const App = Resource(TypeId);
/**
 * Returns true if the given value is a Flagship App resource.
 */
export const isApp = (value) => isResourceOfType(value, TypeId);
export const AppProvider = () => Provider.succeed(App, {
    stables: ["appId", "accountId", "createdAt"],
    diff: Effect.fn(function* ({ output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        if ((output?.accountId ?? accountId) !== accountId) {
            return { action: "replace" };
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ id, olds, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const acct = output?.accountId ?? accountId;
        if (output?.appId) {
            const observed = yield* getApp(acct, output.appId);
            return observed ? toAttributes(observed, acct) : undefined;
        }
        // Cold read — recover from lost state by matching the deterministic
        // physical name. App names are not unique on Cloudflare's side; an
        // exact match on our generated/explicit name is the best identity we
        // have. Pick the oldest match for determinism.
        const name = yield* createAppName(id, olds?.name);
        const match = yield* findByName(acct, name);
        return match ? toAttributes(match, acct) : undefined;
    }),
    reconcile: Effect.fn(function* ({ id, news, output }) {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const name = yield* createAppName(id, news.name);
        // Observe — the appId cached on `output` is a hint, not a guarantee:
        // a missing app falls through and we recreate.
        const observed = output?.appId
            ? yield* getApp(output.accountId ?? accountId, output.appId)
            : undefined;
        if (!observed) {
            // Ensure — greenfield (or out-of-band delete). App names are not
            // unique so there is no AlreadyExists race to tolerate.
            const created = yield* flagship.createApp({ accountId, name });
            return toAttributes(created, accountId);
        }
        // Sync — the only mutable aspect is the name; skip the API on a no-op.
        if (observed.name === name) {
            return toAttributes(observed, accountId);
        }
        const updated = yield* flagship.updateApp({
            accountId,
            appId: observed.id,
            name,
        });
        return toAttributes(updated, accountId);
    }),
    delete: Effect.fn(function* ({ output }) {
        yield* flagship
            .deleteApp({ accountId: output.accountId, appId: output.appId })
            .pipe(Effect.catchTag("FlagshipAppNotFound", () => Effect.void));
    }),
    // Account-scoped collection (pattern b): enumerate every app in the
    // ambient account via the paginated listApps op. Cloudflare's list
    // index can contain ghost rows — apps that were deleted but survive in
    // the listing while GET/DELETE both return "App not found" — so each
    // row is validated via getApp and ghosts are dropped (otherwise census
    // tooling re-discovers an undeletable app forever).
    list: Effect.fn(function* () {
        const { accountId } = yield* yield* CloudflareEnvironment;
        const listed = yield* flagship.listApps.pages({ accountId }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.result ?? [])));
        const rows = yield* Effect.forEach(listed, (app) => getApp(accountId, app.id).pipe(Effect.map((observed) => observed ? toAttributes(observed, accountId) : undefined)), { concurrency: 10 });
        return rows.filter((row) => row !== undefined);
    }),
});
/**
 * Read an app by id, mapping "gone" (`FlagshipAppNotFound`) to `undefined`.
 */
const getApp = (accountId, appId) => flagship
    .getApp({ accountId, appId })
    .pipe(Effect.catchTag("FlagshipAppNotFound", () => Effect.succeed(undefined)));
/**
 * Find an app by exact name. If several apps carry the same name, pick the
 * oldest for determinism.
 */
const findByName = (accountId, name) => flagship.listApps.items({ accountId }).pipe(Stream.filter((a) => a.name === name), Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .at(0)));
const createAppName = (id, name) => Effect.gen(function* () {
    return name ?? (yield* createPhysicalName({ id, lowercase: true }));
});
const toAttributes = (app, accountId) => ({
    appId: app.id,
    accountId,
    name: app.name,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    updatedBy: app.updatedBy,
});
//# sourceMappingURL=App.js.map