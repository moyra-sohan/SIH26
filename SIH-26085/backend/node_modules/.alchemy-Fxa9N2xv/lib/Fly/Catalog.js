import * as machines from "@distilled.cloud/fly-io/machines";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { resolveOrgSlug } from "./Environment.js";
export class CatalogNotFound extends Data.TaggedError("Fly.CatalogNotFound") {
}
const notFound = (kind, ref) => new CatalogNotFound({ kind, ref });
/**
 * Current token organization slug (`getCurrentToken` → `tokens[0].org_slug`).
 * Feeds `listApps({ org_slug })`. Not a resource.
 */
export const currentOrgSlug = resolveOrgSlug;
/**
 * List Fly platform regions via `getRegions`.
 */
export const listRegions = Effect.fn(function* () {
    const { regions } = yield* machines.getRegions({});
    return regions ?? [];
});
/**
 * Resolve a Fly region by code (`iad`, `ord`, `sjc`, …).
 */
export const findRegion = (code) => Effect.gen(function* () {
    const regions = yield* listRegions();
    const found = regions.find((item) => item.code === code);
    if (found === undefined) {
        return yield* notFound("region", code);
    }
    return found;
});
//# sourceMappingURL=Catalog.js.map