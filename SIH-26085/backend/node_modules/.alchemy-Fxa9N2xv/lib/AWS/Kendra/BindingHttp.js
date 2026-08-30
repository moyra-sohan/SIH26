import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS Kendra HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation and the IAM action list is
 * boilerplate: every Kendra data-plane operation is scoped to one index
 * (whose id is injected as `IndexId` and whose ARN receives the grant), and
 * the sync-job operations are additionally scoped to one data source (whose
 * id is injected as `Id` and whose ARN receives the grant alongside its
 * parent index's).
 */
/**
 * Build the impl Effect for an index-scoped Kendra operation (query,
 * retrieve, document batches, principal mapping, suggestions config, …): the
 * runtime callable injects the bound {@link Index}'s id as `IndexId` and the
 * deploy-time half grants `actions` on the index ARN (plus any
 * `subResources` suffix patterns, e.g. `data-source/*` for the
 * principal-mapping operations that also act on data-source-scoped groups).
 *
 * `prepare` (optional) maps a friendlier public request shape onto the wire
 * request — e.g. `UpdateQuerySuggestionsConfig` converts a `Duration.Input`
 * into the wire `QueryLogLookBackWindowInDays`. It defaults to identity.
 */
export const makeKendraIndexHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (index) {
        const IndexId = yield* index.id;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${index}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                index.arn,
                                ...(options.subResources ?? []).map((suffix) => Output.interpolate `${index.arn}/${suffix}`),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${index.LogicalId})`)(function* (request) {
            const wire = options.prepare
                ? options.prepare(request)
                : request;
            return yield* op({
                ...wire,
                IndexId: yield* IndexId,
            });
        });
    });
});
/**
 * Build the impl Effect for a data-source-scoped Kendra operation (the sync
 * job start/stop/list trio): the runtime callable injects the bound
 * {@link DataSource}'s id as `Id` and its parent index's id as `IndexId`;
 * the deploy-time half grants `actions` on the data source ARN **and** the
 * parent index ARN — Kendra authorizes sync-job actions against both.
 */
export const makeKendraDataSourceHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (dataSource) {
        const IndexId = yield* dataSource.indexId;
        const Id = yield* dataSource.id;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${dataSource}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                dataSource.arn,
                                // The data source ARN is
                                // `…:index/{indexId}/data-source/{id}` — the parent index
                                // ARN is its prefix.
                                dataSource.arn.pipe(Output.map((arn) => arn.split("/data-source/")[0])),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${dataSource.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                IndexId: yield* IndexId,
                Id: yield* Id,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map