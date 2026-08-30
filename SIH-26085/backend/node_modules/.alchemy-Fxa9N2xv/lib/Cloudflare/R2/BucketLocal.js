import * as Effect from "effect/Effect";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
import { dispatchByMode } from "../LocalGateway.js";
import { makeProxyBucketHelpers } from "./LocalR2Gateway.js";
/**
 * Shared scaffolding for the R2 `*Local` binding layers.
 *
 * Resolves the account + captures the ambient current-credentials context at
 * layer construction, then returns the deferred binding callable. The
 * callable reads the bucket name/jurisdiction as deferred accessors
 * (resolved at apply time) and builds the client per resolved name:
 *
 * - a REAL name gets the HTTP client (same builders as the `*Http` variant,
 *   authorized with the current CLI credentials — no minted token);
 * - a `dev:` name (local emulation under `alchemy dev`) gets the native
 *   binding client (same builders as the `*Binding` variant) over a scoped
 *   platform-proxy gateway (see `LocalR2Gateway.ts`).
 *
 * NOT exported from `index.ts`.
 */
export const makeLocalBucketBinding = (options) => Effect.gen(function* () {
    // Account + credentials are ambient during stack-eval (the stack's
    // providers layer). Capture the full context so each op can be run with the
    // current credentials.
    const { accountId } = yield* yield* CloudflareEnvironment;
    const context = yield* Effect.context();
    // The FULL ambient context, for the dev-mode gateway: booting an
    // ephemeral workerd needs the platform services and the Cloudflare
    // environment, all present during stack-eval but not statically
    // enumerable here.
    const ambient = yield* Effect.context();
    const auth = {
        authorize: (eff) => eff.pipe(Effect.provideContext(context)),
        accountId: Effect.succeed(accountId),
    };
    return Effect.fn(function* (bucket) {
        // Deferred accessors — resolved against the tracker at apply time. No
        // `host.bind`: the local variant registers no binding.
        const bucketName = yield* bucket.bucketName;
        const jurisdiction = yield* bucket.jurisdiction;
        const httpClient = options.makeHttpClient(auth, bucketName, jurisdiction);
        return dispatchByMode(bucketName, httpClient, (name) => options.makeNativeClient(makeProxyBucketHelpers(name, ambient)));
    });
});
//# sourceMappingURL=BucketLocal.js.map