import { createProjectBranch, deleteProjectBranch, getConnectionURI, getProjectBranch, listProjectBranchDatabases, listProjectBranches, listProjects, updateProjectBranch, } from "@distilled.cloud/neon";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { isResolved } from "../Diff.js";
import { createPhysicalName } from "../PhysicalName.js";
import * as Provider from "../Provider.js";
import { Resource } from "../Resource.js";
import { diffMigrations, migrationsAttrs, migrationsInputOf, stampedOf, } from "../SQL/Migrations/index.js";
import { hashImports, hashMigrations, readSqlFile } from "../SQL/SqlFile.js";
import { recordsEqual } from "../Util/equal.js";
import { runPgMigrations, runSql } from "./Migrations.js";
import { parsePostgresOrigin } from "./PostgresOrigin.js";
import { waitForOperations } from "./Project.js";
/**
 * A branch of a Neon project.
 *
 * Branches are first-class, copy-on-write copies of a parent branch — they
 * share storage with the parent until the new branch starts diverging.
 * ### Branching from a project's default branch
 * **Example:** Basic branch
 * ```typescript
 * const project = yield* Neon.Project("my-project");
 * const dev = yield* Neon.Branch("dev-branch", { project });
 * ```
 *
 * ### Branching from another branch
 * **Example:** Branch off another branch
 * ```typescript
 * const dev = yield* Neon.Branch("dev", { project });
 * const featureBranch = yield* Neon.Branch("feature", {
 *   project,
 *   parentBranch: dev,
 * });
 * ```
 *
 * ### Point-in-time branches
 * **Example:** Branch from a parent at a specific LSN
 * ```typescript
 * const branch = yield* Neon.Branch("at-lsn", {
 *   project,
 *   parentLsn: "0/3FA01B0",
 * });
 * ```
 *
 * ### Migrations on a branch
 * **Example:** Apply migrations on the branch only
 * ```typescript
 * const featureBranch = yield* Neon.Branch("feature", {
 *   project,
 *   migrations: "./migrations",
 * });
 * ```
 *
 * @see https://neon.tech/docs/manage/branches/
 *
 * @resource
 */
export const Branch = Resource("Neon.Branch");
export const BranchProvider = () => Provider.succeed(Branch, {
    stables: ["branchId", "projectId"],
    diff: Effect.fn(function* ({ id, olds, news, output }) {
        // Normally we short-circuit on `isResolved(news)` at the beginning.
        // However, this wouldn't detect an upstream project change, causing an update when what we really want is a replace.
        // So, we check the project first before short-circuiting. `projectId` is a stable attribute of `Project`, so the
        // planning engine resolves `news.project` to a plain object carrying that stable id (even when the project is being
        // updated in place). An unchanged project therefore resolves to the same string; a changed/replaced project resolves
        // to either a different string or an unresolved output, so `oldProjectId !== newProjectId` evaluates correctly.
        // An Output-valued `project` doesn't survive a `creating`-state
        // round-trip (it deserializes as `undefined`) — when the old project is
        // unknown, fall through to the create/update recovery path rather than
        // force a replacement.
        const oldProjectId = output?.projectId ??
            (olds.project !== undefined
                ? maybeResolveProjectId(olds.project)
                : undefined);
        const newProjectId = "project" in news
            ? maybeResolveProjectId(news.project)
            : undefined;
        if (oldProjectId !== undefined && oldProjectId !== newProjectId) {
            return { action: "replace" };
        }
        if (!isResolved(news))
            return undefined;
        if (news.parentLsn !== undefined &&
            output?.parentLsn !== news.parentLsn) {
            return { action: "replace" };
        }
        if (news.parentTimestamp !== undefined &&
            output?.parentTimestamp !== news.parentTimestamp) {
            return { action: "replace" };
        }
        if (output?.initSource !== undefined &&
            output.initSource !== (news.initSource ?? "parent-data")) {
            return { action: "replace" };
        }
        const oldName = output?.branchName ?? (yield* createBranchName(id, olds.name));
        // Auto-generated names are engine-owned: the deployed name stays
        // authoritative even if the generator would name this id differently
        // today. Only an explicit user-provided name can force a rename.
        const newName = news.name ?? oldName;
        if (newName !== oldName ||
            (news.protected ?? false) !== (output?.protected ?? false) ||
            (news.expiresAt ?? undefined) !== (output?.expiresAt ?? undefined)) {
            return { action: "update" };
        }
        if (yield* diffMigrations({ news, output })) {
            return { action: "update" };
        }
        if (news.importFiles?.length) {
            const newHashes = yield* hashImports(news.importFiles, yield* rootDir);
            if (!recordsEqual(newHashes, output?.importHashes ?? {})) {
                return { action: "update" };
            }
        }
        return undefined;
    }),
    read: Effect.fn(function* ({ id, output, olds }) {
        if (output?.branchId) {
            return yield* getProjectBranch({
                project_id: output.projectId,
                branch_id: output.branchId,
            }).pipe(Effect.map(({ branch }) => ({
                ...output,
                branchName: branch.name,
                protected: branch.protected,
                default: branch.default,
                expiresAt: branch.expires_at,
                pooledOrigin: output.pooledOrigin ??
                    parsePostgresOrigin(output.pooledConnectionUri),
            })), Effect.catchTag("NotFound", () => Effect.succeed(undefined)));
        }
        if (!olds?.project)
            return undefined;
        const projectId = maybeResolveProjectId(olds.project);
        if (projectId === undefined) {
            // The project reference survived as an object but its Output-valued
            // `projectId` did not — there is nothing to look the branch up in.
            return undefined;
        }
        const name = yield* createBranchName(id, olds.name);
        const matches = yield* findBranchByName(projectId, name);
        const match = matches[0];
        if (!match)
            return undefined;
        const dbs = yield* listProjectBranchDatabases({
            project_id: projectId,
            branch_id: match.id,
        });
        const db = dbs.databases[0];
        if (!db)
            return undefined;
        const conn = yield* fetchConnection(projectId, match.id, db.name, db.owner_name);
        return {
            branchId: match.id,
            branchName: match.name,
            projectId,
            parentBranchId: match.parent_id,
            parentLsn: match.parent_lsn,
            parentTimestamp: match.parent_timestamp,
            initSource: match.init_source,
            protected: match.protected,
            default: match.default,
            expiresAt: match.expires_at,
            databaseName: db.name,
            roleName: db.owner_name,
            connectionUri: conn.uri,
            pooledConnectionUri: conn.pooled,
            origin: parsePostgresOrigin(conn.uri),
            pooledOrigin: parsePostgresOrigin(conn.pooled),
            migrationsDir: (olds && migrationsInputOf(olds))?.dir,
            migrationsTable: (olds && migrationsInputOf(olds))?.table,
            migrationsHashes: {},
            importHashes: {},
        };
    }),
    reconcile: Effect.fn(function* ({ id, news, output }) {
        // Prefer the deployed name: regenerating would target a different
        // resource if the generator's output for this id ever drifts. An
        // explicit `news.name` still renames the branch in place.
        const newName = news.name ??
            output?.branchName ??
            (yield* createBranchName(id, news.name));
        // Ensure — when no prior output exists we create the branch;
        // otherwise sync the mutable scalar fields on the existing
        // branch via updateProjectBranch.
        const branchInfo = output
            ? yield* updateProjectBranch({
                project_id: output.projectId,
                branch_id: output.branchId,
                branch: {
                    name: newName !== output.branchName ? newName : undefined,
                    protected: news.protected,
                    expires_at: news.expiresAt ?? null,
                },
            }).pipe(Effect.map((r) => ({
                branchId: output.branchId,
                branchName: r.branch.name,
                projectId: output.projectId,
                parentBranchId: output.parentBranchId,
                parentLsn: output.parentLsn,
                parentTimestamp: output.parentTimestamp,
                initSource: output.initSource,
                protected: r.branch.protected,
                default: output.default,
                expiresAt: r.branch.expires_at,
                databaseName: output.databaseName,
                roleName: output.roleName,
                connectionUri: output.connectionUri,
                pooledConnectionUri: output.pooledConnectionUri,
                origin: output.origin,
                pooledOrigin: output.pooledOrigin ??
                    parsePostgresOrigin(output.pooledConnectionUri),
            })))
            : yield* Effect.gen(function* () {
                const projectId = resolveProjectId(news.project);
                const parentBranchId = yield* resolveParentBranchId(news.parentBranch, projectId);
                const created = yield* createProjectBranch({
                    project_id: projectId,
                    branch: {
                        name: newName,
                        parent_id: parentBranchId,
                        parent_lsn: news.parentLsn,
                        parent_timestamp: news.parentTimestamp,
                        init_source: news.initSource,
                        protected: news.protected,
                        expires_at: news.expiresAt,
                    },
                    endpoints: buildEndpoints(news.endpoints),
                });
                yield* waitForOperations(created.operations);
                const db = created.databases[0];
                if (!db) {
                    return yield* Effect.die(`Neon branch ${created.branch.id} created with no databases`);
                }
                const conn = yield* fetchConnection(projectId, created.branch.id, db.name, db.owner_name);
                return {
                    branchId: created.branch.id,
                    branchName: created.branch.name,
                    projectId: created.branch.project_id,
                    parentBranchId: created.branch.parent_id,
                    parentLsn: created.branch.parent_lsn,
                    parentTimestamp: created.branch.parent_timestamp,
                    initSource: created.branch.init_source,
                    protected: created.branch.protected,
                    default: created.branch.default,
                    expiresAt: created.branch.expires_at,
                    databaseName: db.name,
                    roleName: db.owner_name,
                    connectionUri: conn.uri,
                    pooledConnectionUri: conn.pooled,
                    origin: parsePostgresOrigin(conn.uri),
                    pooledOrigin: parsePostgresOrigin(conn.pooled),
                };
            });
        const connectionUri = Redacted.make(branchInfo.connectionUri);
        const migrationsInput = migrationsInputOf(news);
        const migrations = migrationsInput
            ? yield* runPgMigrations({
                connectionUri,
                input: migrationsInput,
                stamped: stampedOf(output),
            })
            : undefined;
        const importHashes = news.importFiles?.length
            ? yield* runImports(connectionUri, news.importFiles, yield* rootDir, output?.importHashes ?? {})
            : {};
        return {
            ...branchInfo,
            ...migrationsAttrs({ input: migrationsInput, run: migrations, output }),
            importHashes,
        };
    }),
    delete: Effect.fn(function* ({ output }) {
        yield* deleteProjectBranch({
            project_id: output.projectId,
            branch_id: output.branchId,
        }).pipe(Effect.catchTag("NotFound", () => Effect.void));
    }),
    // Parent fan-out: branches are scoped to a project, and there is no
    // account-wide branch enumeration API. Enumerate every project, then
    // list+hydrate the branches of each (bounded concurrency), producing
    // the exact `read` Attributes shape for each branch.
    list: Effect.fn(function* () {
        const projects = yield* listAllProjects;
        const perProject = yield* Effect.forEach(projects, (project) => Effect.gen(function* () {
            const branches = yield* listAllBranches(project.id);
            return yield* Effect.forEach(branches, (branch) => hydrateBranch(project.id, branch), { concurrency: 10 });
        }).pipe(
        // The project may be deleted between enumeration and listing.
        Effect.catchTag("NotFound", () => Effect.succeed([]))), { concurrency: 10 });
        return perProject
            .flat()
            .filter((row) => row !== undefined);
    }),
});
const listAllProjects = Effect.gen(function* () {
    const projects = [];
    let cursor;
    while (true) {
        const page = yield* listProjects(cursor !== undefined ? { cursor } : {});
        projects.push(...page.projects);
        const nextCursor = page.pagination?.cursor;
        // Neon returns a `pagination.cursor` on every response (the `created_at`
        // of the last row), not a "has next page" flag — stop once a page comes
        // back empty or the cursor stops advancing to avoid an infinite loop.
        if (page.projects.length === 0 ||
            nextCursor === undefined ||
            nextCursor === cursor) {
            break;
        }
        cursor = nextCursor;
    }
    return projects;
});
const listAllBranches = (projectId) => Effect.gen(function* () {
    const branches = [];
    let cursor;
    do {
        const page = yield* listProjectBranches({
            project_id: projectId,
            ...(cursor !== undefined ? { cursor } : {}),
        });
        branches.push(...page.branches);
        cursor = page.pagination?.next;
    } while (cursor);
    return branches;
});
const hydrateBranch = (projectId, branch) => Effect.gen(function* () {
    const dbs = yield* listProjectBranchDatabases({
        project_id: projectId,
        branch_id: branch.id,
    });
    const db = dbs.databases[0];
    if (!db)
        return undefined;
    const conn = yield* fetchConnection(projectId, branch.id, db.name, db.owner_name);
    const attributes = {
        branchId: branch.id,
        branchName: branch.name,
        projectId,
        parentBranchId: branch.parent_id,
        parentLsn: branch.parent_lsn,
        parentTimestamp: branch.parent_timestamp,
        initSource: branch.init_source,
        protected: branch.protected,
        default: branch.default,
        expiresAt: branch.expires_at,
        databaseName: db.name,
        roleName: db.owner_name,
        connectionUri: conn.uri,
        pooledConnectionUri: conn.pooled,
        origin: parsePostgresOrigin(conn.uri),
        pooledOrigin: parsePostgresOrigin(conn.pooled),
        migrationsDir: undefined,
        migrationsTable: undefined,
        migrationsHashes: {},
        importHashes: {},
    };
    return attributes;
}).pipe(
// A branch/database/endpoint can disappear mid-enumeration — skip it.
Effect.catchTag("NotFound", () => Effect.succeed(undefined)));
const rootDir = Effect.sync(() => process.cwd());
const createBranchName = (id, name) => Effect.gen(function* () {
    return name ?? (yield* createPhysicalName({ id }));
});
const findBranchByName = (projectId, name) => Effect.gen(function* () {
    const matches = [];
    let cursor;
    do {
        const page = yield* listProjectBranches({
            project_id: projectId,
            search: name,
            ...(cursor !== undefined ? { cursor } : {}),
        });
        for (const b of page.branches) {
            if (b.name === name)
                matches.push(b);
        }
        cursor = page.pagination?.next;
    } while (cursor);
    return matches;
});
const maybeResolveProjectId = (source) => {
    if (source && "projectId" in source && source.projectId) {
        return source.projectId;
    }
    return undefined;
};
const resolveProjectId = (source) => {
    const projectId = maybeResolveProjectId(source);
    if (projectId)
        return projectId;
    throw new Error("Invalid Neon project source: must be a Project or { projectId }");
};
const resolveParentBranchId = (source, projectId) => Effect.gen(function* () {
    if (!source)
        return undefined;
    if ("branchId" in source && source.branchId) {
        return source.branchId;
    }
    if ("name" in source && source.name) {
        const matches = yield* findBranchByName(projectId, source.name);
        if (matches.length === 0) {
            return yield* Effect.die(`Parent branch "${source.name}" not found in project ${projectId}`);
        }
        if (matches.length > 1) {
            return yield* Effect.die(`Multiple branches with name "${source.name}" in project ${projectId}`);
        }
        return matches[0].id;
    }
    return undefined;
});
const buildEndpoints = (endpoints) => {
    const list = endpoints ?? [{ type: "read_write" }];
    return list.map((e) => ({
        type: e.type,
        autoscaling_limit_min_cu: e.autoscalingLimitMinCu,
        autoscaling_limit_max_cu: e.autoscalingLimitMaxCu,
        suspend_timeout_seconds: e.suspendTimeoutSeconds,
    }));
};
const fetchConnection = (projectId, branchId, databaseName, roleName) => Effect.gen(function* () {
    const direct = yield* getConnectionURI({
        project_id: projectId,
        branch_id: branchId,
        database_name: databaseName,
        role_name: roleName,
        pooled: false,
    });
    const pooled = yield* getConnectionURI({
        project_id: projectId,
        branch_id: branchId,
        database_name: databaseName,
        role_name: roleName,
        pooled: true,
    });
    return { uri: direct.uri, pooled: pooled.uri };
});
const runImports = (connectionUri, importFiles, rootDir, previous) => Effect.gen(function* () {
    const hashes = { ...previous };
    for (const filePath of importFiles) {
        const file = yield* readSqlFile(rootDir, filePath);
        if (previous[filePath] === file.hash) {
            hashes[filePath] = file.hash;
            continue;
        }
        yield* runSql(connectionUri, file.sql);
        hashes[filePath] = file.hash;
    }
    const tracked = new Set(importFiles);
    for (const key of Object.keys(hashes)) {
        if (!tracked.has(key))
            delete hashes[key];
    }
    return hashes;
});
//# sourceMappingURL=Branch.js.map