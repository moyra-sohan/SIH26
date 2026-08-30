import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { deepEqual, isResolved } from "../Diff.js";
import * as Redacted from "effect/Redacted";
import { Unowned } from "../AdoptPolicy.js";
import { createPhysicalName } from "../PhysicalName.js";
import * as Provider from "../Provider.js";
import { closePrismaDevDatabase, ensurePrismaDevDatabase, } from "./PrismaDevDatabase.js";
import { DEV_TIMESTAMP, attrOrString, devId } from "./Internal/DevStub.js";
import * as ProviderLayer from "../Local/ProviderLayer.js";
import { Resource } from "../Resource.js";
import { PrismaClient, extractConnectionSecrets, isConflict, isNotFound, } from "./Client.js";
import { hasCanonicalConnectionSecrets, mergeConnectionSecrets, recoverDatabaseConnectionSecrets, } from "./Internal/DatabaseSecrets.js";
import { concreteIdsChanged, isInputObject, isPrismaDevId, resolveProjectId, unresolvedProjectIdOf, } from "./Refs.js";
/**
 * A Prisma Postgres database inside a Prisma project.
 *
 * Standalone `Prisma.Database` resources cannot be the project's default
 * database. Use `Prisma.Project` when the project should own a default
 * database. Project, region, and source changes require replacement; display
 * name and branch attachment can converge in place. Destroying this resource
 * deletes its database and data.
 *
 * ### Creating a Database
 * **Example:** Database in a project
 * ```typescript
 * const project = yield* Prisma.Project("app", { createDatabase: false });
 * const database = yield* Prisma.Database("db", {
 *   project,
 *   region: "us-east-1",
 * });
 * ```
 *
 * **Example:** Database attached to a preview branch
 * ```typescript
 * const database = yield* Prisma.Database("preview-db", {
 *   project,
 *   branchId: preview.branchId,
 * });
 * ```
 *
 * @resource
 */
export const Database = Resource("Prisma.Database");
const createName = (id, name) => name === undefined ? createPhysicalName({ id }) : Effect.succeed(name);
const findDatabaseByName = (client, projectId, name) => client.listProjectDatabases(projectId, { limit: 100 }).pipe(Effect.flatMap((databases) => {
    const matches = databases.filter((database) => database.name === name);
    return matches.length > 1
        ? Effect.fail(new Error(`Prisma project '${projectId}' has multiple databases named '${name}'; refusing to select one arbitrarily.`))
        : Effect.succeed(matches[0]);
}));
class GeneratedDatabaseNotVisible extends Error {
}
const generatedDatabaseRecoverySchedule = Schedule.max([
    Schedule.exponential("250 millis"),
    Schedule.recurs(6),
]);
const recoverGeneratedDatabaseAfterConflict = (client, projectId, name) => findDatabaseByName(client, projectId, name).pipe(Effect.flatMap((database) => database
    ? Effect.succeed(database)
    : Effect.fail(new GeneratedDatabaseNotVisible(`Generated Prisma database '${name}' already exists but is not visible yet.`))), Effect.retry({
    while: (error) => error instanceof GeneratedDatabaseNotVisible,
    schedule: generatedDatabaseRecoverySchedule,
}));
const findDefaultDatabase = (client, projectId) => client.listProjectDatabases(projectId, { limit: 100 }).pipe(Effect.flatMap((databases) => {
    const matches = databases.filter((database) => database.isDefault);
    return matches.length > 1
        ? Effect.fail(new Error(`Prisma project '${projectId}' has multiple default databases; refusing to select one arbitrarily.`))
        : Effect.succeed(matches[0]);
}));
const resolveDatabaseRegion = Effect.fn(function* (client, projectId, region) {
    if (region !== "inherit") {
        return (region ?? "us-east-1");
    }
    const database = yield* findDefaultDatabase(client, projectId);
    const inherited = database?.region?.id;
    if (inherited === undefined) {
        return yield* Effect.fail(new Error(`Cannot resolve Prisma database region 'inherit' because project '${projectId}' has no default database region. Create or promote a default database first, or specify an explicit region.`));
    }
    return inherited;
});
const stripDatabaseIdPrefix = (databaseId) => databaseId.startsWith("db_") ? databaseId.slice(3) : databaseId;
const normalizeDatabaseSource = (source) => {
    if (source === undefined || source === null || source.type === "empty") {
        return { type: "empty" };
    }
    return source.type === "database"
        ? {
            type: "database",
            databaseId: stripDatabaseIdPrefix(source.databaseId),
        }
        : {
            type: "backup",
            databaseId: stripDatabaseIdPrefix(source.databaseId),
            backupId: source.backupId,
        };
};
const sourceMatches = (observed, desired) => deepEqual(normalizeDatabaseSource(observed), normalizeDatabaseSource(desired));
const desiredSourcesMatch = (left, right) => deepEqual(normalizeDatabaseSource(left), normalizeDatabaseSource(right));
const branchIdForGitName = (client, projectId, gitName) => client
    .listBranches(projectId, { gitName, limit: 2 })
    .pipe(Effect.flatMap((branches) => branches.length > 1
    ? Effect.fail(new Error(`Prisma project '${projectId}' has multiple branches named '${gitName}'; refusing to select one arbitrarily.`))
    : Effect.succeed(branches[0]?.id)));
const attrsFrom = (database, secrets) => ({
    databaseId: database.id,
    databaseName: database.name,
    projectId: database.project.id,
    status: database.status,
    region: database.region?.id ?? null,
    isDefault: database.isDefault,
    branchId: database.branchId,
    defaultConnectionId: database.defaultConnectionId,
    createdAt: database.createdAt,
    directConnectionString: secrets.directConnectionString,
    pooledConnectionString: secrets.pooledConnectionString,
    accelerateConnectionString: secrets.accelerateConnectionString,
    host: secrets.host,
    user: secrets.user,
    password: secrets.password,
});
const branchNeedsSync = Effect.fn(function* (client, projectId, database, props) {
    if (props.branchId !== undefined && !isPrismaDevId(props.branchId)) {
        return database.branchId !== props.branchId;
    }
    if (props.branchGitName === undefined) {
        return database.branchId !== null;
    }
    if (props.branchGitName === null) {
        return database.branchId !== null;
    }
    const branchId = yield* branchIdForGitName(client, projectId, props.branchGitName);
    return branchId === undefined || branchId !== database.branchId;
});
const branchAttachment = (props) => props.branchId !== undefined && !isPrismaDevId(props.branchId)
    ? {
        branchId: props.branchId,
        branchGitName: undefined,
    }
    : props.branchGitName !== undefined
        ? {
            branchId: undefined,
            branchGitName: props.branchGitName,
        }
        : {
            branchId: undefined,
            branchGitName: undefined,
        };
const validateDatabaseProps = (props) => Effect.gen(function* () {
    if (props.isDefault === true) {
        return yield* Effect.fail(new Error("Prisma.Database cannot manage a default database because the Management API has no safe demotion or promote-existing operation, so the resource could never be destroyed. Use Prisma.Project for the project-owned default database."));
    }
    if (props.branchId !== undefined && props.branchGitName !== undefined) {
        return yield* Effect.fail(new Error("branchId and branchGitName are mutually exclusive."));
    }
});
const ProviderLive = () => Provider.effect(Database, Effect.gen(function* () {
    const client = yield* PrismaClient;
    return {
        stables: ["databaseId"],
        list: () => client.listDatabases().pipe(Effect.map((databases) => 
        // Default databases are project-owned and the API rejects
        // direct deletion. Project.list/delete owns their teardown;
        // exposing them here would make unsafe nuke retry forever.
        databases
            .filter((database) => !database.isDefault)
            .map((database) => attrsFrom(database, {})))),
        diff: Effect.fn(function* ({ id, olds, news, output }) {
            if (!isInputObject(news))
                return undefined;
            if (isResolved(news.rotateCredentialsOnAdopt) &&
                news.rotateCredentialsOnAdopt === true &&
                olds.rotateCredentialsOnAdopt !== true) {
                return { action: "update" };
            }
            if (news.isDefault === true) {
                return yield* Effect.fail(new Error("Prisma.Database cannot manage a default database because the Management API has no safe demotion or promote-existing operation. Use Prisma.Project for the project-owned default database."));
            }
            if (isPrismaDevId(output?.databaseId)) {
                return { action: "update" };
            }
            const oldProjectId = output?.projectId ?? unresolvedProjectIdOf(olds.project);
            const newProjectId = isResolved(news.project)
                ? unresolvedProjectIdOf(news.project)
                : undefined;
            const desiredRegionInput = isResolved(news.region)
                ? (news.region ?? "us-east-1")
                : undefined;
            const regionProjectId = newProjectId ?? oldProjectId;
            const desiredRegion = desiredRegionInput === "inherit"
                ? regionProjectId
                    ? yield* resolveDatabaseRegion(client, regionProjectId, desiredRegionInput)
                    : undefined
                : desiredRegionInput;
            const observedRegion = output
                ? output.region
                : (olds.region ?? "us-east-1");
            const desiredIsDefault = isResolved(news.isDefault)
                ? (news.isDefault ?? false)
                : undefined;
            const observedIsDefault = output?.isDefault ?? olds.isDefault ?? false;
            // A default database cannot be deleted from its old project after a
            // cross-project replacement. Block before creating anything until
            // another database has been promoted in the original project.
            if (observedIsDefault &&
                concreteIdsChanged(oldProjectId, newProjectId)) {
                return { action: "update" };
            }
            // Prisma has no API operation that directly demotes the current
            // default database. Do not schedule a doomed create-first
            // replacement: reconcile will fail before mutation until another
            // database has been promoted and this one is observed as nondefault.
            if (desiredIsDefault === false && observedIsDefault) {
                return { action: "update" };
            }
            if (concreteIdsChanged(oldProjectId, newProjectId) ||
                (desiredRegion !== undefined && desiredRegion !== observedRegion) ||
                (desiredIsDefault !== undefined &&
                    desiredIsDefault !== observedIsDefault) ||
                (isResolved(news.source) &&
                    !desiredSourcesMatch(news.source, olds.source))) {
                return { action: "replace" };
            }
            if (!isResolved(news.name))
                return undefined;
            const desiredName = yield* createName(id, news.name);
            const observedName = output?.databaseName ?? (yield* createName(id, olds.name));
            let branchMismatch = false;
            if (isResolved(news.branchId) && news.branchId !== undefined) {
                branchMismatch =
                    !isPrismaDevId(news.branchId) &&
                        (output?.branchId ?? olds.branchId ?? null) !== news.branchId;
            }
            else if (isResolved(news.branchGitName) &&
                news.branchGitName !== undefined) {
                if (news.branchGitName === null) {
                    branchMismatch =
                        (output?.branchId ?? olds.branchId ?? null) !== null;
                }
                else if (output && newProjectId !== undefined) {
                    const desiredBranchId = yield* branchIdForGitName(client, newProjectId, news.branchGitName);
                    branchMismatch =
                        desiredBranchId === undefined ||
                            desiredBranchId !== output.branchId;
                }
                else {
                    branchMismatch = news.branchGitName !== olds.branchGitName;
                }
            }
            else if (isResolved(news.branchId) &&
                isResolved(news.branchGitName)) {
                branchMismatch =
                    (output?.branchId ?? olds.branchId ?? null) !== null;
            }
            if (desiredName !== observedName || branchMismatch) {
                return { action: "update" };
            }
            return undefined;
        }),
        read: Effect.fn(function* ({ id, output, olds }) {
            const databaseId = isPrismaDevId(output?.databaseId)
                ? undefined
                : output?.databaseId;
            let generatedIdentityMatch = false;
            let database = databaseId
                ? yield* client
                    .getDatabase(databaseId)
                    .pipe(Effect.catchIf(isNotFound, () => Effect.succeed(undefined)))
                : undefined;
            if (!database && databaseId === undefined) {
                const projectId = unresolvedProjectIdOf(olds.project);
                if (projectId) {
                    const name = yield* createName(id, olds.name);
                    database = yield* findDatabaseByName(client, projectId, name);
                    generatedIdentityMatch =
                        database !== undefined && olds.name === undefined;
                    if (!database &&
                        olds.name === undefined &&
                        (olds.isDefault ?? false)) {
                        database = yield* findDefaultDatabase(client, projectId);
                    }
                }
            }
            if (!database)
                return undefined;
            if (databaseId === undefined &&
                !sourceMatches(database.source, olds.source)) {
                return yield* Effect.fail(new Error(`Prisma database '${database.name}' has immutable source ${JSON.stringify(database.source)} but ${JSON.stringify(olds.source ?? { type: "empty" })} was requested; refusing to adopt a database that cannot converge.`));
            }
            const cachedSecrets = output?.databaseId === database.id ? output : undefined;
            const attrs = attrsFrom(database, {
                directConnectionString: cachedSecrets?.directConnectionString,
                pooledConnectionString: cachedSecrets?.pooledConnectionString,
                accelerateConnectionString: cachedSecrets?.accelerateConnectionString,
                host: cachedSecrets?.host,
                user: cachedSecrets?.user,
                password: cachedSecrets?.password,
            });
            return databaseId === undefined && !generatedIdentityMatch
                ? Unowned(attrs)
                : attrs;
        }),
        reconcile: Effect.fn(function* ({ id, news, olds, output }) {
            yield* validateDatabaseProps(news);
            const projectId = yield* resolveProjectId(news.project);
            const region = yield* resolveDatabaseRegion(client, projectId, news.region);
            const name = yield* createName(id, news.name);
            const databaseId = isPrismaDevId(output?.databaseId)
                ? undefined
                : output?.databaseId;
            let database = databaseId
                ? yield* client
                    .getDatabase(databaseId)
                    .pipe(Effect.catchIf(isNotFound, () => Effect.succeed(undefined)))
                : undefined;
            if (!database && news.name === undefined) {
                database = yield* findDatabaseByName(client, projectId, name);
            }
            let secrets = {};
            let recoverCreateSecrets = false;
            const attach = branchAttachment(news);
            if (!database) {
                if (news.name !== undefined &&
                    (news.branchId !== undefined || news.branchGitName !== undefined)) {
                    return yield* Effect.fail(new Error(`Cannot safely create explicitly named Prisma database '${name}' with a branch attachment. The Management API creates the database before attaching the branch and exposes no idempotency key, so a failed response cannot be distinguished from a foreign database. Omit name to use Alchemy's recoverable physical identity, or wait for an atomic Management API operation.`));
                }
                const result = yield* client
                    .createDatabase({
                    projectId,
                    name,
                    region,
                    isDefault: news.isDefault ?? false,
                    source: news.source,
                    branchId: attach.branchId,
                    branchGitName: attach.branchGitName,
                })
                    .pipe(Effect.map((database) => ({
                    database,
                    secrets: extractConnectionSecrets(database.connections[0]),
                    recoverSecrets: true,
                })), Effect.catchIf(isConflict, () => news.name === undefined
                    ? recoverGeneratedDatabaseAfterConflict(client, projectId, name).pipe(Effect.map((database) => ({
                        database,
                        secrets: {},
                        // The generated physical name is owned by this
                        // resource instance. A conflict after the POST can
                        // be a lost successful response, so recover the
                        // write-only default credentials below.
                        recoverSecrets: true,
                    })))
                    : Effect.fail(new Error(`A Prisma database named '${name}' appeared after the adoption check. Refusing to take it over; rerun with adoption enabled if it is the intended database.`))));
                database = result.database;
                secrets = result.secrets;
                recoverCreateSecrets = result.recoverSecrets;
            }
            if (database.project.id !== projectId) {
                return yield* Effect.fail(new Error(database.isDefault
                    ? `Cannot move default Prisma database '${database.name}' from project '${database.project.id}' to '${projectId}' because the old default cannot be deleted. Promote another database in the original project first, then retry the move.`
                    : `Prisma database '${database.name}' belongs to project '${database.project.id}', not requested project '${projectId}'. Refusing to claim convergence; replace the database.`));
            }
            if (database.region?.id !== region) {
                return yield* Effect.fail(new Error(`Prisma database '${database.name}' is in immutable region '${database.region?.id ?? "unknown"}', not requested region '${region}'. Refusing to claim convergence; replace the database.`));
            }
            if (!sourceMatches(database.source, news.source)) {
                return yield* Effect.fail(new Error(`Prisma database '${database.name}' has immutable source ${JSON.stringify(database.source)}, not requested source ${JSON.stringify(news.source ?? { type: "empty" })}. Refusing to claim convergence; replace the database.`));
            }
            if (database.isDefault === true &&
                (news.isDefault ?? false) === false) {
                return yield* Effect.fail(new Error(`Cannot demote default Prisma database '${database.name}' directly because the Management API has no demotion operation. Promote another database in project '${projectId}' first, then retry this deployment.`));
            }
            const ownedGeneratedIdentity = news.name === undefined && database.name === name;
            const desired = { ...news, name };
            const needsPatch = database.name !== name ||
                (yield* branchNeedsSync(client, projectId, database, desired));
            if (needsPatch) {
                const updateAttachment = attach.branchId === undefined &&
                    attach.branchGitName === undefined
                    ? { branchId: null, branchGitName: undefined }
                    : attach;
                database = yield* client.updateDatabase(database.id, {
                    name,
                    branchId: updateAttachment.branchId,
                    branchGitName: updateAttachment.branchGitName,
                });
            }
            const persistedSecrets = output?.databaseId === database.id ? output : undefined;
            const knownSecrets = mergeConnectionSecrets(secrets, {
                directConnectionString: persistedSecrets?.directConnectionString,
                pooledConnectionString: persistedSecrets?.pooledConnectionString,
                accelerateConnectionString: persistedSecrets?.accelerateConnectionString,
                host: persistedSecrets?.host,
                user: persistedSecrets?.user,
                password: persistedSecrets?.password,
            });
            if (recoverCreateSecrets ||
                (ownedGeneratedIdentity &&
                    !hasCanonicalConnectionSecrets(knownSecrets)) ||
                olds !== undefined ||
                news.rotateCredentialsOnAdopt === true) {
                const recovered = yield* recoverDatabaseConnectionSecrets(client, database, knownSecrets);
                database = recovered.database;
                return attrsFrom(database, recovered.secrets);
            }
            return attrsFrom(database, knownSecrets);
        }),
        delete: Effect.fn(function* ({ output }) {
            if (isPrismaDevId(output.databaseId))
                return;
            const database = yield* client
                .getDatabase(output.databaseId)
                .pipe(Effect.catchIf(isNotFound, () => Effect.succeed(undefined)));
            if (!database)
                return;
            if (database.isDefault) {
                return yield* Effect.fail(new Error(`Cannot delete default Prisma database '${database.name ?? output.databaseId}' directly. Promote another database first, or delete the owning Prisma.Project so the API can remove its project-owned default database.`));
            }
            yield* client
                .deleteDatabase(output.databaseId)
                .pipe(Effect.catchIf(isNotFound, () => Effect.void));
        }),
    };
}));
const ProviderLocal = () => Provider.succeed(Database, {
    stables: ["databaseId"],
    list: () => Effect.succeed([]),
    diff: Effect.fn(function* () {
        return { action: "update" };
    }),
    read: Effect.fn(function* ({ output }) {
        return output;
    }),
    reconcile: Effect.fn(function* ({ id, news, output }) {
        const databaseId = output?.databaseId ?? devId("database", id);
        const local = yield* ensurePrismaDevDatabase(databaseId, news.dev);
        return {
            databaseId,
            databaseName: news.name ?? id,
            projectId: attrOrString(news.project, "projectId") ?? devId("project", id),
            status: "ready",
            region: news.region ?? "us-east-1",
            isDefault: news.isDefault ?? false,
            branchId: news.branchId ?? null,
            defaultConnectionId: devId("connection", id),
            createdAt: output?.createdAt ?? DEV_TIMESTAMP,
            directConnectionString: local?.directConnectionString,
            pooledConnectionString: local?.pooledConnectionString,
            accelerateConnectionString: local?.accelerateConnectionString,
            host: local?.host,
            user: local?.user,
            password: local?.password,
        };
    }),
    delete: Effect.fn(function* ({ output }) {
        yield* closePrismaDevDatabase(output.databaseId);
    }),
});
export const DatabaseProvider = () => ProviderLayer.dual(Database, {
    local: () => ProviderLocal(),
    live: () => ProviderLive(),
});
//# sourceMappingURL=Database.js.map