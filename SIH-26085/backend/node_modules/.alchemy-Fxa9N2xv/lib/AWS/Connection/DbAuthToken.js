import * as Presign from "@distilled.cloud/aws/Presign";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
/**
 * Generate a short-lived IAM database authentication token.
 *
 * This is a pure client-side SigV4 *presign* — no AWS API call is made
 * (there is no distilled operation for it). The token is the presigned URL
 * with the `https://` scheme stripped, exactly what the `rds-db` and `dsql`
 * data planes expect as the connection password. It inherits the IAM
 * permissions of the identity resolved from the ambient distilled
 * `Credentials` service (`rds-db:connect` on the DB user resource for RDS,
 * `dsql:DbConnect`/`dsql:DbConnectAdmin` on the cluster for DSQL).
 *
 * Because per-execution pools re-run their build on the first query of each
 * execution (see `Runtime/ExecutionMemo.ts`), minting inside a pool build
 * means a token can never outlive its pool on workerd or Lambda.
 */
export const generateDbAuthToken = Effect.fn(function* (options) {
    const hostAndPort = options.port !== undefined
        ? `${options.hostname}:${options.port}`
        : options.hostname;
    const url = new URL(`https://${hostAndPort}/`);
    if (options.service === "rds-db") {
        url.searchParams.set("Action", "connect");
        if (options.username !== undefined) {
            url.searchParams.set("DBUser", options.username);
        }
    }
    else {
        url.searchParams.set("Action", options.action ?? "DbConnect");
    }
    const signed = yield* Presign.presignUrl({
        method: "GET",
        url: url.toString(),
        service: options.service,
        region: options.region,
        expiresIn: options.expiresIn !== undefined
            ? Math.floor(Duration.toSeconds(options.expiresIn))
            : 900,
    });
    return Redacted.make(signed.slice("https://".length));
});
//# sourceMappingURL=DbAuthToken.js.map