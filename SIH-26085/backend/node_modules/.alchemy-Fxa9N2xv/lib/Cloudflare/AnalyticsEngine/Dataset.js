import * as Effect from "effect/Effect";
const TypeId = "Cloudflare.AnalyticsEngine.Dataset";
export const isDataset = (value) => typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === TypeId;
export const Dataset = Effect.fn(function* (name, props) {
    return {
        kind: TypeId,
        name,
        dataset: props?.dataset ?? name,
    };
});
//# sourceMappingURL=Dataset.js.map