import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
/**
 * Creates a memoized version of a function that returns an Effect.
 *
 * The key feature is deduplication of concurrent calls with the same inputs -
 * only one execution happens while other callers wait for and receive the same result.
 *
 * @example
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { cachedFunction } from "~/lib/cached-function";
 *
 * const fetchUser = (id: string) =>
 *   Effect.promise(() => fetch(`/users/${id}`).then(r => r.json()));
 *
 * const program = Effect.gen(function* () {
 *   const cachedFetchUser = yield* cachedFunction(fetchUser);
 *
 *   // These concurrent calls will only trigger one fetch
 *   const [user1, user2] = yield* Effect.all([
 *     cachedFetchUser("123"),
 *     cachedFetchUser("123"),
 *   ]);
 * });
 * ```
 */
export const cachedFunction = (fn, options) => Effect.sync(() => {
    const keyFn = options?.key ?? JSON.stringify;
    const cache = new Map();
    return (...args) => Effect.suspend(() => {
        const cacheKey = keyFn(args);
        const existing = cache.get(cacheKey);
        // If there's already a deferred for this key, wait on it
        if (existing) {
            return Deferred.await(existing);
        }
        // Create a new deferred and store it
        return Effect.gen(function* () {
            const deferred = yield* Deferred.make();
            cache.set(cacheKey, deferred);
            // Execute the effect and complete the deferred
            const exit = yield* Effect.exit(fn(...args));
            yield* Deferred.done(deferred, exit);
            if (exit._tag === "Failure") {
                cache.delete(cacheKey);
            }
            // Return the result
            return yield* exit;
        });
    });
});
//# sourceMappingURL=cached-function.js.map