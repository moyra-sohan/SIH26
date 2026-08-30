import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared HTTP scaffolding for the AWS IoT SiteWise runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the IAM action, and the request
 * shaping is boilerplate.
 */
/**
 * Build the impl Effect for an IoT SiteWise operation scoped to one
 * {@link Asset}: the deploy-time half grants `iamActions` on the bound
 * asset's ARN, and the runtime half injects the asset's service-assigned id
 * into every request via `prepare`.
 *
 * Note: requests that identify the target data stream by `propertyAlias`
 * instead of `assetId`/`propertyId` authorize against the time-series
 * resource, which this asset-scoped grant does not cover.
 */
export const makeSiteWiseAssetHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (asset) {
        // Output yields a DEFERRED effect — resolve again per invocation below.
        const AssetId = yield* asset.assetId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.IoTSiteWise.${options.capability}(${asset}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.iamActions],
                            Resource: [asset.assetArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.IoTSiteWise.${options.capability}(${asset.LogicalId})`)(function* (request) {
            const assetId = yield* AssetId;
            return yield* op(options.prepare(request, assetId));
        });
    });
});
/**
 * Build the impl Effect for an account-level IoT SiteWise operation (e.g.
 * `ExecuteQuery`, which queries across all asset models and assets and is
 * not scoped to a single resource). Grants `iamActions` on
 * `Resource: ["*"]`.
 */
export const makeSiteWiseAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.IoTSiteWise.${options.capability}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.iamActions],
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.IoTSiteWise.${options.capability}`)(function* (request) {
            return yield* op(request);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map