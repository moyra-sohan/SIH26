import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { SQLite } from "./SQLite.js";
import { parseError } from "./SQLiteError.js";
/**
 * Layer that provides the SQLite service using Bun's native SQLite.
 */
export const BunSQLite = Layer.sync(SQLite, () => ({
    open: (path) => Effect.gen(function* () {
        const { Database } = yield* Effect.promise(() => import("bun:sqlite"));
        const db = new Database(path);
        // Enable WAL mode for better concurrent read performance
        db.run("PRAGMA journal_mode = WAL;");
        // Wait up to 30 seconds when database is locked before returning SQLITE_BUSY
        db.run("PRAGMA busy_timeout = 30000;");
        return fromDatabase(db);
    }),
}));
/**
 * Create a SQLiteConnection from a Bun SQLite Database.
 */
export const fromDatabase = (db) => ({
    prepare: (sql) => Effect.try({
        try: () => wrapStatement(db.prepare(sql)),
        catch: (e) => parseError(extractErrorCode(e), `Failed to prepare statement: ${e}`, e),
    }),
    exec: (sql) => Effect.try({
        try: () => {
            db.exec(sql);
        },
        catch: (e) => parseError(extractErrorCode(e), `Failed to execute SQL: ${e}`, e),
    }),
    transaction: (fn) => {
        // For Bun's synchronous SQLite, we can use the same connection
        // since everything runs synchronously within the transaction
        const conn = fromDatabase(db);
        return Effect.flatMap(Effect.try({
            try: () => db.transaction(() => Effect.runSync(fn(conn))),
            catch: (e) => parseError(extractErrorCode(e), `Failed to create transaction: ${e}`, e),
        }), (txFn) => Effect.try({
            try: () => txFn(),
            catch: (e) => parseError(extractErrorCode(e), `Transaction failed:`, e),
        }));
    },
    batch: (statements) => Effect.try({
        try: () => {
            // Use Bun's transaction for atomic batch execution
            db.transaction(() => {
                for (const stmt of statements) {
                    const prepared = db.prepare(stmt.sql);
                    prepared.run(...(stmt.params ?? []));
                }
            })();
        },
        catch: (e) => parseError(extractErrorCode(e), `Batch execution failed: ${e}`, e),
    }),
});
/**
 * Wrap a Bun SQLite Statement in the SqlStatement interface.
 */
const wrapStatement = (stmt) => ({
    all: (...params) => Effect.try({
        try: () => stmt.all(...params),
        catch: (e) => parseError(extractErrorCode(e), `Failed to execute statement.all: ${e}`, e),
    }),
    get: (...params) => Effect.try({
        try: () => stmt.get(...params),
        catch: (e) => parseError(extractErrorCode(e), `Failed to execute statement.get: ${e}`, e),
    }),
    run: (...params) => Effect.try({
        try: () => {
            stmt.run(...params);
        },
        catch: (e) => parseError(extractErrorCode(e), `Failed to execute statement.run: ${e}`, e),
    }),
});
/**
 * Extract error code from Bun's SQLiteError.
 */
const extractErrorCode = (e) => {
    const bunError = e;
    return bunError?.code;
};
//# sourceMappingURL=BunSQLite.js.map