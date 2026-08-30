import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Binding from "../../Binding.js";
import { generateDbAuthToken } from "../Connection/DbAuthToken.js";
import { formatSqlConnectionUrl } from "../Connection/internal.js";
import { isBindingHost } from "../Lambda/Function.js";
import { Connect, connectEnvPrefix } from "./Connect.js";
const DSQL_PORT = 5432;
/**
 * IAM-token implementation of {@link Connect}. At deploy time it grants
 * `dsql:DbConnect` (or `dsql:DbConnectAdmin`) on the cluster to the host
 * Function and publishes the endpoint as `DSQL_{LOGICAL_ID}_HOST`; at runtime
 * it presigns a fresh auth token (client-side SigV4 — no API call) with the
 * Function's own credentials and formats the full connection descriptor.
 */
export const ConnectHttp = Layer.effect(Connect, Effect.gen(function* () {
    // Captured at layer build so the runtime callable only requires
    // RuntimeContext — the presign resolves credentials lazily from the
    // service on every mint, so refreshed execution-role creds are honored.
    const services = yield* Effect.context();
    return Effect.fn(function* (cluster, options) {
        const Host = yield* cluster.endpoint;
        const admin = options?.admin ?? false;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const prefix = connectEnvPrefix(cluster.LogicalId);
                yield* host.bind `Allow(${host}, AWS.DSQL.Connect(${cluster}))`({
                    env: {
                        [`${prefix}_HOST`]: cluster.endpoint,
                    },
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [admin ? "dsql:DbConnectAdmin" : "dsql:DbConnect"],
                            Resource: [cluster.clusterArn],
                        },
                    ],
                });
            }
        }
        const username = admin ? "admin" : options?.username;
        const database = options?.database ?? "postgres";
        return Effect.gen(function* () {
            const host = yield* Host;
            if (!host) {
                return yield* Effect.die(`DSQL endpoint for '${cluster.LogicalId}' is not available yet`);
            }
            const password = yield* generateDbAuthToken({
                service: "dsql",
                hostname: host,
                action: admin ? "DbConnectAdmin" : "DbConnect",
            }).pipe(Effect.provideContext(services));
            return {
                host,
                port: DSQL_PORT,
                database,
                username,
                password,
                ssl: true,
                url: formatSqlConnectionUrl({
                    host,
                    port: DSQL_PORT,
                    database,
                    username,
                    password,
                    ssl: true,
                }),
            };
        });
    });
}));
//# sourceMappingURL=ConnectHttp.js.map