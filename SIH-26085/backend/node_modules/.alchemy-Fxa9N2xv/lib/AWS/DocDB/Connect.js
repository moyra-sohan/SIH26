import * as Redacted from "effect/Redacted";
import * as Binding from "../../Binding.js";
import { connectEnvPrefix as makeConnectEnvPrefix } from "../Connection/internal.js";
/**
 * Environment variable prefix under which the connect binding publishes the
 * cluster endpoint on the host Function, derived from the cluster's logical
 * ID. A cluster with logical ID `Docs` yields `DOCDB_DOCS` and the variables
 * `DOCDB_DOCS_HOST` and `DOCDB_DOCS_PORT`.
 */
export const connectEnvPrefix = (logicalId) => makeConnectEnvPrefix("DOCDB", logicalId);
export const Connect = Binding.Service("AWS.DocDB.Connect");
/**
 * Format a `mongodb://` connection URL with the DocumentDB-recommended
 * options (`replicaSet=rs0`, `readPreference=secondaryPreferred`,
 * `retryWrites=false`). Username and password are percent-encoded; the
 * result is `Redacted` because it embeds the password.
 */
export const formatMongoConnectionUrl = (options) => {
    const password = options.password === undefined
        ? undefined
        : typeof options.password === "string"
            ? options.password
            : Redacted.value(options.password);
    const auth = options.username !== undefined
        ? password !== undefined
            ? `${encodeURIComponent(options.username)}:${encodeURIComponent(password)}@`
            : `${encodeURIComponent(options.username)}@`
        : "";
    const port = options.port !== undefined ? `:${options.port}` : "";
    const database = options.database !== undefined
        ? `/${encodeURIComponent(options.database)}`
        : "/";
    const query = new URLSearchParams({
        replicaSet: "rs0",
        readPreference: "secondaryPreferred",
        retryWrites: "false",
        ...options.params,
    });
    if (options.tls === true) {
        query.set("tls", "true");
        // DocumentDB certs chain to the private Amazon RDS CA — keep TLS on with
        // identity verification off unless the caller supplies the CA bundle
        // (see `mongo`'s `ca` option, which restores full verification).
        if (!query.has("tlsCAFile")) {
            query.set("tlsAllowInvalidCertificates", "true");
        }
    }
    return Redacted.make(`mongodb://${auth}${options.host}${port}${database}?${query.toString()}`);
};
//# sourceMappingURL=Connect.js.map