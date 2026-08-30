import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Output from "../Output.js";
import { sha256 } from "../Util/sha256.js";
const toRedacted = (value) => typeof value === "string" ? Redacted.make(value) : value;
/**
 * Resolve a {@link ConnectionSource} to its runtime accessor effect.
 *
 * Outputs are yielded NOW (binding into the host environment during a
 * host init, or recording an Action capture during an Action init) and
 * the returned accessor reads the resolved value back later; Effects pass
 * through untouched; literals wrap.
 */
export const resolveConnectionSource = (source) => Effect.gen(function* () {
    if (Output.isOutput(source)) {
        const accessor = yield* source;
        return Effect.map(accessor, toRedacted);
    }
    if (Effect.isEffect(source)) {
        return source;
    }
    return Effect.succeed(toRedacted(source));
});
/**
 * Pick the deploy-resolvable source for deploy-time work (migrations,
 * seeds): an explicit override wins, `false` disables, and the primary
 * source is a valid default only when it is itself deploy-resolvable.
 */
export const staticConnectionSource = (source, override) => {
    if (override === false) {
        return undefined;
    }
    if (override !== undefined) {
        return override;
    }
    return Effect.isEffect(source) && !Output.isOutput(source)
        ? undefined
        : source;
};
/**
 * Non-secret digest of a connection source — a sha256 Output suitable for
 * persisted identity inputs (e.g. a migration Action's diff key) where the
 * connection string itself must never be stored.
 */
export const connectionSourceDigest = (source) => {
    const digest = (value) => sha256(typeof value === "string" ? value : Redacted.value(value));
    return Output.isOutput(source)
        ? Output.mapEffect(digest)(source)
        : Output.fromEffect(digest(source));
};
//# sourceMappingURL=ConnectionSource.js.map