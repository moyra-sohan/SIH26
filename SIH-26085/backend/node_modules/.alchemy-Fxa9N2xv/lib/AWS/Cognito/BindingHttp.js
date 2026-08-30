import * as Effect from "effect/Effect";
/**
 * Shared scaffolding for Cognito's grouped HTTP bindings.
 *
 * NOT exported from `index.ts`. Unlike services whose capabilities are one
 * operation per `Binding.Service`, Cognito's runtime bindings are grouped
 * clients (`UserPoolAuth`, `UserPoolAdmin`, `IdentityPoolAuth`,
 * `IdentityPoolAdmin`) — many operations sharing one bound resource. The
 * boilerplate factored here is the per-method wrapper: a traced `Effect.fn`
 * named `{binding}.{method}({logicalId})` that injects the bound resource's
 * resolved identifier (`UserPoolId` / `ClientId` / `IdentityPoolId`) into
 * every request before calling the distilled operation.
 */
export const cognitoMethods = (bindingId, logicalId) => ({
    /**
     * Build a client method that merges the resolved identifier field(s) in
     * `inject` into every request. The exposed request type is the distilled
     * request with the injected keys omitted.
     */
    injecting: (inject) => (name, op) => Effect.fn(`${bindingId}.${name}(${logicalId})`)(function* (request) {
        return yield* op({ ...request, ...(yield* inject) });
    }),
    /** Build a client method that passes the request through unchanged
     * (operations authorized purely by an access token in the request). */
    plain: (name, op) => Effect.fn(`${bindingId}.${name}(${logicalId})`)(function* (request) {
        return yield* op(request);
    }),
});
//# sourceMappingURL=BindingHttp.js.map