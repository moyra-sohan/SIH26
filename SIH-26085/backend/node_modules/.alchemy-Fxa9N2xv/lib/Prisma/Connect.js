import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Binding from "../Binding.js";
import * as Output from "../Output.js";
import { RuntimeContext } from "../RuntimeContext.js";
import { envName } from "./Internal/EnvName.js";
export const Connect = Binding.Service("Prisma.Connect");
/**
 * Derive the env var names {@link Connect} uses to carry a Connection's
 * outputs into the host runtime.
 */
export const connectEnvKeys = (connection) => {
    const name = connection.FQN === connection.LogicalId
        ? connection.LogicalId
        : connection.FQN;
    const prefix = `PRISMA_${envName(name)}`;
    return {
        connectionId: `${prefix}_CONNECTION_ID`,
        databaseId: `${prefix}_DATABASE_ID`,
        directConnectionString: `${prefix}_DIRECT_CONNECTION_STRING`,
        pooledConnectionString: `${prefix}_POOLED_CONNECTION_STRING`,
        accelerateConnectionString: `${prefix}_ACCELERATE_CONNECTION_STRING`,
        host: `${prefix}_HOST`,
        user: `${prefix}_USER`,
        password: `${prefix}_PASSWORD`,
    };
};
/**
 * Hosts whose runtime configuration travels as plain environment variables:
 * Prisma Compute, an AWS Lambda Function, and a Cloudflare Container. A
 * container is a real process with no workerd bindings, so `env` is the only
 * channel it has — the same contract the other two expose.
 */
const supportsConnectEnvBinding = (host) => host?.Type === "Prisma.Compute" ||
    host?.Type === "AWS.Lambda.Function" ||
    host?.Type === "Cloudflare.Container";
const supportsConnectWorkerBinding = (host) => host?.Type === "Cloudflare.Worker";
// Compute env sync omits undefined and treats null as deletion. Connection
// bindings need both values to round-trip into the typed runtime client.
const ENCODED_CONNECTION_PREFIX = "__ALCHEMY_PRISMA_CONNECTION_VALUE__:";
const encodeConnectionValue = (value) => `${ENCODED_CONNECTION_PREFIX}${JSON.stringify(value)}`;
const escapePrefixedValue = (value) => {
    const raw = typeof value === "string" ? value : String(Redacted.value(value));
    if (!raw.startsWith(ENCODED_CONNECTION_PREFIX))
        return value;
    const encoded = encodeConnectionValue({ kind: "value", value: raw });
    return Redacted.isRedacted(value) ? Redacted.make(encoded) : encoded;
};
const encodeOptionalValue = (output) => output.pipe(Output.map((value) => value === undefined
    ? encodeConnectionValue({ kind: "undefined" })
    : value === null
        ? encodeConnectionValue({ kind: "null" })
        : escapePrefixedValue(value)));
const encodedConnectEnv = (connection) => ({
    connectionId: connection.connectionId,
    databaseId: connection.databaseId,
    directConnectionString: encodeOptionalValue(connection.directConnectionString),
    pooledConnectionString: encodeOptionalValue(connection.pooledConnectionString),
    accelerateConnectionString: encodeOptionalValue(connection.accelerateConnectionString),
    host: encodeOptionalValue(connection.host),
    user: encodeOptionalValue(connection.user),
    password: encodeOptionalValue(connection.password),
});
const connectEnv = (connection) => {
    const keys = connectEnvKeys(connection);
    const env = encodedConnectEnv(connection);
    return {
        [keys.connectionId]: env.connectionId,
        [keys.databaseId]: env.databaseId,
        [keys.directConnectionString]: env.directConnectionString,
        [keys.pooledConnectionString]: env.pooledConnectionString,
        [keys.accelerateConnectionString]: env.accelerateConnectionString,
        [keys.host]: env.host,
        [keys.user]: env.user,
        [keys.password]: env.password,
    };
};
const workerBindingValue = (name, value) => value.pipe(Output.map((resolved) => {
    if (Redacted.isRedacted(resolved)) {
        return {
            type: "secret_text",
            name,
            text: Redacted.value(resolved),
        };
    }
    return {
        type: "plain_text",
        name,
        text: resolved ?? encodeConnectionValue({ kind: "undefined" }),
    };
}));
const connectWorkerBindings = (connection) => {
    const keys = connectEnvKeys(connection);
    const env = encodedConnectEnv(connection);
    return [
        workerBindingValue(keys.connectionId, env.connectionId),
        workerBindingValue(keys.databaseId, env.databaseId),
        workerBindingValue(keys.directConnectionString, env.directConnectionString),
        workerBindingValue(keys.pooledConnectionString, env.pooledConnectionString),
        workerBindingValue(keys.accelerateConnectionString, env.accelerateConnectionString),
        workerBindingValue(keys.host, env.host),
        workerBindingValue(keys.user, env.user),
        workerBindingValue(keys.password, env.password),
    ];
};
const redactedToString = (value) => Redacted.isRedacted(value) ? Redacted.value(value) : value;
const runtimeOutput = (key, output) => output.bind(key).pipe(Effect.flatMap((effect) => effect));
const decodeConnectionValue = (value) => {
    const raw = redactedToString(value);
    if (raw === undefined || !raw.startsWith(ENCODED_CONNECTION_PREFIX)) {
        return raw;
    }
    try {
        const parsed = JSON.parse(raw.slice(ENCODED_CONNECTION_PREFIX.length));
        if (typeof parsed !== "object" || parsed === null || !("kind" in parsed)) {
            return raw;
        }
        if (parsed.kind === "undefined")
            return undefined;
        if (parsed.kind === "null")
            return null;
        if (parsed.kind === "value" && typeof parsed.value === "string") {
            return parsed.value;
        }
        return raw;
    }
    catch {
        return raw;
    }
};
const optionalString = (value) => decodeConnectionValue(value) ?? undefined;
const optionalRedacted = (value) => {
    const decoded = optionalString(value);
    return decoded === undefined ? undefined : Redacted.make(decoded);
};
const nullableString = (value) => decodeConnectionValue(value);
/**
 * Implementation layer for {@link Connect}. Provide it on the host
 * Function/Worker Effect:
 *
 * ```typescript
 * Effect.gen(function* () {
 *   const db = yield* Prisma.Connect(connection);
 *   // ...
 * }).pipe(Effect.provide(Prisma.ConnectBinding))
 * ```
 */
export const ConnectBinding = Layer.effect(Connect, Effect.gen(function* () {
    return Effect.fn(function* (connection) {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (supportsConnectEnvBinding(host)) {
                yield* host.bind `${connection}`({
                    env: connectEnv(connection),
                });
            }
            else if (supportsConnectWorkerBinding(host)) {
                yield* host.bind `${connection}`({
                    bindings: connectWorkerBindings(connection),
                });
            }
            else {
                return yield* Effect.die(new Error(`Prisma.Connect supports Prisma.Compute, AWS.Lambda.Function, Cloudflare.Worker, and Cloudflare.Container runtimes, got '${host?.Type ?? "no host"}'`));
            }
        }
        const keys = connectEnvKeys(connection);
        const env = encodedConnectEnv(connection);
        const directConnectionString = runtimeOutput(keys.directConnectionString, env.directConnectionString).pipe(Effect.map(optionalRedacted));
        const pooledConnectionString = runtimeOutput(keys.pooledConnectionString, env.pooledConnectionString).pipe(Effect.map(optionalRedacted));
        const accelerateConnectionString = runtimeOutput(keys.accelerateConnectionString, env.accelerateConnectionString).pipe(Effect.map(optionalRedacted));
        const databaseUrl = Effect.all([
            pooledConnectionString,
            directConnectionString,
            accelerateConnectionString,
        ]).pipe(Effect.flatMap(([pooled, direct, accelerate]) => {
            const url = pooled ?? direct ?? accelerate;
            return url === undefined
                ? Effect.die(new Error("Prisma connection carries no connection URL (no pooled, direct, or Accelerate endpoint was bound)"))
                : Effect.succeed(url);
        }));
        return {
            databaseUrl,
            connectionId: runtimeOutput(keys.connectionId, env.connectionId),
            databaseId: runtimeOutput(keys.databaseId, env.databaseId),
            directConnectionString,
            pooledConnectionString,
            accelerateConnectionString,
            host: runtimeOutput(keys.host, env.host).pipe(Effect.map(nullableString)),
            user: runtimeOutput(keys.user, env.user).pipe(Effect.map(nullableString)),
            password: runtimeOutput(keys.password, env.password).pipe(Effect.map(optionalRedacted)),
        };
    });
}));
//# sourceMappingURL=Connect.js.map