import * as planetscale from "@distilled.cloud/planetscale";
import { Credentials } from "@distilled.cloud/planetscale/Credentials";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Unowned } from "../AdoptPolicy.js";
import { havePropsChanged, isResolved } from "../Diff.js";
import { createPhysicalName } from "../PhysicalName.js";
import * as Provider from "../Provider.js";
import { hashImports, hashMigrations } from "../SQL/SqlFile.js";
import { recordsEqual } from "../Util/equal.js";
import { ensureMySQLProductionBranchClusterSize } from "./MySQL/MySQLClusterSize.js";
import { ensurePostgresProductionBranchClusterSize, toPostgresClusterSku, waitForPendingPostgresChanges, } from "./Postgres/PostgresClusterSize.js";
import { diffMigrations, migrationsAttrs, migrationsInputOf, stampedOf, } from "../SQL/Migrations/index.js";
import { PlanetscaleConflict, isKnownError, waitForBranchReady, } from "./Util.js";
const resolveDatabase = (database) => {
    const ref = database;
    if (!ref)
        return { name: "" };
    return typeof ref === "string"
        ? { name: ref }
        : { name: ref.name, organization: ref.organization };
};
const resolveParent = (parent) => {
    const ref = parent;
    return !ref ? "main" : typeof ref === "string" ? ref : ref.name;
};
const createBranchName = (id, name) => Effect.gen(function* () {
    return (name ??
        (yield* createPhysicalName({ id, lowercase: true, maxLength: 63 })));
});
const rootDir = Effect.sync(() => process.cwd());
/**
 * Matches the UnprocessableEntity errors PlanetScale returns when a
 * branch promotion/demotion races an in-flight cluster resize, e.g.
 * "Branches with a cluster resize in progress cannot be demoted."
 */
const isResizeInProgress = (error) => typeof error === "object" &&
    error !== null &&
    error._tag === "UnprocessableEntity" &&
    typeof error.message === "string" &&
    error.message.includes("cluster resize in progress");
/**
 * Build a branch provider for a specific PlanetScale engine. The
 * caller supplies the typed `Resource` token and the engine's migration
 * runners; everything else (observe / ensure / sync / delete) is shared.
 */
export const makeBranchProvider = (opts) => Provider.succeed(opts.resource, {
    stables: ["organization", "database"],
    // PARENT FAN-OUT: PlanetScale branches are nested under a database within
    // an organization, so there is no flat per-org branch enumeration API.
    // Enumerate every database in the credentialed org, then list each
    // database's branches concurrently (bounded), exhaustively paginating
    // both levels, and keep only the branches whose engine kind matches this
    // resource. Each item is hydrated into the exact `read` Attributes shape.
    list: Effect.fn(function* () {
        const { organization } = yield* yield* Credentials;
        const databases = yield* planetscale.listDatabases
            .pages({ organization })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.data)));
        const rows = yield* Effect.forEach(databases, (db) => planetscale.listBranches
            .pages({ organization, database: db.name })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.data
            .filter((branch) => branch.kind === opts.expectedKind)
            .map((branch) => ({
            name: branch.name,
            organization,
            database: db.name,
            parentBranch: branch.parent_branch ?? "main",
            production: branch.production,
            createdAt: branch.created_at,
            updatedAt: branch.updated_at,
            htmlUrl: branch.html_url,
            region: { slug: branch.region.slug },
            migrationsDir: undefined,
            migrationsTable: undefined,
            migrationsHashes: {},
            importHashes: {},
            desiredReplicas: undefined,
            hasReplicas: branch.has_replicas,
            hasReadOnlyReplicas: branch.has_read_only_replicas,
        })))), 
        // A database can be deleted between enumeration and the
        // per-database branch list — skip it rather than fail.
        Effect.catchTag("NotFound", () => Effect.succeed([]))), { concurrency: 10 });
        return rows.flat();
    }),
    diff: Effect.fn(function* ({ news, olds, output }) {
        if (!isResolved(news))
            return undefined;
        // Branch names are rename-mutable (reconcile syncs `news.name` in
        // place), so `name` cannot live in the provider-level stables. But
        // almost no update is a rename — for those, advertise `name` as
        // stable on the update so downstream consumers referencing this
        // branch still resolve `branch.name` at plan time. Without it, a
        // metadata-only update (e.g. an embedded database ref whose
        // `migrationsHashes` moved) resolves consumer refs to just
        // `{ organization, database }`, and identity-sensitive consumers
        // (PostgresRole) falsely plan a replacement against `name: undefined`.
        //
        // The name only changes when the `name` prop itself changes: an
        // explicit name renames iff it differs from the observed name, and
        // an omitted name is engine-generated deterministically (stable
        // across updates — the instance id only rotates on replacement).
        const nameIsStable = output?.name !== undefined &&
            (news.name !== undefined
                ? news.name === output.name
                : olds?.name === undefined);
        const stables = nameIsStable
            ? ["organization", "database", "name"]
            : undefined;
        const newDb = resolveDatabase(news.database).name;
        const oldDbRef = output?.database ?? olds.database;
        if (oldDbRef) {
            const oldDb = resolveDatabase(oldDbRef).name;
            if (newDb !== oldDb) {
                return { action: "replace" };
            }
        }
        const newParent = resolveParent(news.parentBranch);
        const oldParent = output?.parentBranch ?? resolveParent(olds.parentBranch);
        if (newParent !== oldParent) {
            return { action: "replace" };
        }
        if (news.region?.slug &&
            output?.region?.slug &&
            news.region.slug !== output.region.slug) {
            return { action: "replace" };
        }
        if (news.replicas !== undefined) {
            if (output?.desiredReplicas !== news.replicas) {
                return { action: "update", stables };
            }
            const desiredHasReplicas = news.replicas > 0;
            if (output?.hasReplicas !== undefined &&
                output.hasReplicas !== desiredHasReplicas) {
                return { action: "update", stables };
            }
        }
        if (yield* diffMigrations({ news, output })) {
            return { action: "update", stables };
        }
        if (news.importFiles?.length) {
            const newHashes = yield* hashImports(news.importFiles, yield* rootDir);
            if (!recordsEqual(newHashes, output?.importHashes ?? {})) {
                return { action: "update", stables };
            }
        }
        // Remaining prop changes (rename, safeMigrations, clusterSize,
        // metadata embedded in resource refs) are all in-place updates.
        // Decide them here instead of falling back to the engine's default
        // deep-compare so the conditional `name` stable above is attached —
        // the default path uses the provider-level stables, which strip
        // `name` from downstream plan resolution.
        if (havePropsChanged(olds, news)) {
            return { action: "update", stables };
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ id, olds, output }) {
        // If we have neither a cached output nor a usable `olds.database`
        // there's no way to identify which branch to refresh — most often
        // this is destroy of a partially-created resource whose props
        // never got fully persisted. Return `undefined` so the engine
        // treats it as already-gone and drops the state entry.
        if (!output && !olds?.database) {
            return undefined;
        }
        const dbInfo = output
            ? { name: output.database, organization: output.organization }
            : resolveDatabase(olds.database);
        const { organization: envOrg } = yield* yield* Credentials;
        const organization = output?.organization ?? dbInfo.organization ?? envOrg;
        const databaseName = output?.database ?? dbInfo.name;
        const branchName = output?.name ?? (yield* createBranchName(id, olds.name));
        return yield* planetscale
            .getBranch({
            organization,
            database: databaseName,
            branch: branchName,
        })
            .pipe(Effect.map((data) => {
            const attrs = {
                name: data.name,
                organization,
                database: databaseName,
                parentBranch: data.parent_branch ?? "main",
                production: data.production,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
                htmlUrl: data.html_url,
                region: { slug: data.region.slug },
                migrationsDir: output?.migrationsDir ?? olds?.migrationsDir,
                migrationsTable: output?.migrationsTable ?? olds?.migrationsTable,
                migrationsHashes: output?.migrationsHashes ?? {},
                importHashes: output?.importHashes ?? {},
                desiredReplicas: output?.desiredReplicas ??
                    olds?.desiredReplicas ??
                    olds?.replicas,
                hasReplicas: data.has_replicas,
                hasReadOnlyReplicas: data.has_read_only_replicas,
            };
            return output ? attrs : Unowned(attrs);
        }), Effect.catchTag("NotFound", () => Effect.succeed(undefined)));
    }),
    reconcile: Effect.fn(function* ({ id, news, output, session }) {
        const { organization: envOrg } = yield* yield* Credentials;
        const dbInfo = resolveDatabase(news.database);
        const organization = output?.organization ?? dbInfo.organization ?? envOrg;
        const databaseName = output?.database ?? dbInfo.name;
        const desiredBranchName = yield* createBranchName(id, news.name);
        const observedBranchName = output?.name ?? desiredBranchName;
        const parentBranchName = resolveParent(news.parentBranch);
        // If parentBranch is a plain string (an unmanaged branch reference),
        // wait for it to be ready before we touch the child branch. When it
        // is a Branch resource, Alchemy's resource graph already guarantees
        // readiness before this resource's inputs are resolved.
        if (news.parentBranch && typeof news.parentBranch === "string") {
            yield* waitForBranchReady(organization, databaseName, parentBranchName, session);
        }
        // Observe — fetch the live branch state.
        let current = yield* planetscale
            .getBranch({
            organization,
            database: databaseName,
            branch: observedBranchName,
        })
            .pipe(Effect.catchTag("NotFound", () => Effect.succeed(undefined)));
        // Ensure — if missing, create. The parent must be ready before
        // the child can fork from it. PostgreSQL short cluster sizes need
        // to be expanded against the parent's region so the API call lands
        // with a valid sku.
        if (!current) {
            const parent = yield* waitForBranchReady(organization, databaseName, parentBranchName, session);
            const parentClusterSize = news.clusterSize
                ? parent.kind === "postgresql"
                    ? toPostgresClusterSku({
                        size: news.clusterSize,
                        region: parent.region.slug,
                    })
                    : news.clusterSize
                : undefined;
            yield* session.note("Creating branch...");
            current = yield* planetscale.createBranch({
                organization,
                database: databaseName,
                name: desiredBranchName,
                parent_branch: parentBranchName,
                backup_id: news.backupId,
                seed_data: news.seedData,
                region: news.region?.slug,
                cluster_size: parentClusterSize,
            });
        }
        if (current.kind !== opts.expectedKind) {
            return yield* Effect.fail(new PlanetscaleConflict({
                message: `Planetscale branch "${current.name}" (database "${databaseName}") has kind ` +
                    `"${current.kind}" but this resource is a ${opts.engineLabel}. ` +
                    `Use the matching ${current.kind === "mysql" ? "MySQLBranch" : "PostgresBranch"} ` +
                    `resource instead.`,
            }));
        }
        yield* waitForBranchReady(organization, databaseName, current.name, session);
        // Sync name — branch names are mutable. Continue subsequent syncs
        // under the name returned by the API.
        if (current.name !== desiredBranchName) {
            current = yield* planetscale.updateBranch({
                organization,
                database: databaseName,
                branch: current.name,
                new_name: desiredBranchName,
            });
        }
        const branchName = current.name;
        // Sync production status before branch settings that depend on it.
        // PlanetScale only supports explicit branch promotion/demotion for MySQL.
        if (opts.expectedKind === "mysql") {
            const desiredProduction = news.isProduction ?? false;
            if (current.production !== desiredProduction) {
                // A keyspace can report `resizing: false` while the resize
                // workflow is still finalizing, during which promote/demote is
                // rejected with an UnprocessableEntity. Retry until it clears.
                const retryWhileResizing = Effect.retry({
                    while: isResizeInProgress,
                    schedule: Schedule.max([
                        Schedule.spaced("5 seconds"),
                        Schedule.recurs(120),
                    ]),
                });
                current = desiredProduction
                    ? yield* planetscale
                        .promoteBranch({
                        organization,
                        database: databaseName,
                        branch: branchName,
                    })
                        .pipe(retryWhileResizing)
                    : yield* planetscale
                        .demoteBranch({
                        organization,
                        database: databaseName,
                        branch: branchName,
                    })
                        .pipe(retryWhileResizing);
            }
        }
        // Sync safeMigrations — observed via `current.safe_migrations`,
        // skip the API call entirely on no-op.
        if (news.safeMigrations !== undefined &&
            current.safe_migrations !== news.safeMigrations) {
            if (news.safeMigrations) {
                yield* planetscale.enableSafeMigrations({
                    organization,
                    database: databaseName,
                    branch: branchName,
                });
            }
            else {
                yield* planetscale.disableSafeMigrations({
                    organization,
                    database: databaseName,
                    branch: branchName,
                });
            }
        }
        if (opts.expectedKind === "postgresql" && news.replicas !== undefined) {
            const desiredReplicas = news.replicas;
            const desiredHasReplicas = desiredReplicas > 0;
            const shouldApplyReplicaChange = current.has_replicas !== desiredHasReplicas ||
                (desiredHasReplicas && output?.desiredReplicas !== desiredReplicas);
            if (shouldApplyReplicaChange) {
                yield* waitForPendingPostgresChanges(organization, databaseName, branchName);
                const change = yield* planetscale.updateBranchChangeRequest({
                    organization,
                    database: databaseName,
                    branch: branchName,
                    replicas: desiredReplicas,
                });
                yield* waitForPendingPostgresChanges(organization, databaseName, branchName, change.id);
                current = yield* planetscale.getBranch({
                    organization,
                    database: databaseName,
                    branch: branchName,
                });
            }
        }
        // Sync clusterSize — only meaningful on production branches.
        if (news.clusterSize) {
            if (current.kind === "postgresql") {
                yield* ensurePostgresProductionBranchClusterSize(organization, databaseName, branchName, news.clusterSize);
            }
            else {
                yield* ensureMySQLProductionBranchClusterSize(organization, databaseName, branchName, news.clusterSize);
            }
        }
        // Re-read so the returned attributes reflect any mutation.
        const updated = yield* planetscale.getBranch({
            organization,
            database: databaseName,
            branch: branchName,
        });
        const migrationTarget = {
            organization,
            database: databaseName,
            branch: updated.name,
        };
        const migrationsInput = migrationsInputOf(news);
        const migrations = migrationsInput
            ? yield* opts.runners.runMigrations(migrationTarget, migrationsInput, stampedOf(output))
            : undefined;
        const importHashes = news.importFiles?.length
            ? yield* opts.runners.runImports(migrationTarget, news.importFiles, yield* rootDir, output?.importHashes ?? {})
            : {};
        return {
            name: updated.name,
            organization,
            database: databaseName,
            parentBranch: updated.parent_branch ?? parentBranchName,
            production: updated.production,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
            htmlUrl: updated.html_url,
            region: { slug: updated.region.slug },
            ...migrationsAttrs({ input: migrationsInput, run: migrations, output }),
            importHashes,
            desiredReplicas: news.replicas ?? output?.desiredReplicas,
            hasReplicas: updated.has_replicas,
            hasReadOnlyReplicas: updated.has_read_only_replicas,
        };
    }),
    delete: Effect.fn(function* ({ output }) {
        // If `read` returned undefined (e.g. destroy of a partially-
        // created branch whose props never finished persisting), there
        // is nothing addressable to delete. Drop the state entry.
        if (!output)
            return;
        yield* planetscale
            .deleteBranch({
            organization: output.organization,
            database: output.database,
            branch: output.name,
        })
            .pipe(Effect.catchTag("NotFound", () => Effect.void), Effect.catchIf(isKnownError("UnprocessableEntity", "The default branch cannot be deleted."), () => Effect.void));
    }),
});
//# sourceMappingURL=Branch.js.map