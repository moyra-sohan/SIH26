import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS QBusiness HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the four
 * builders below. Everything except the operation and the IAM action list
 * is boilerplate: every Amazon Q Business operation is scoped to one
 * application (whose id is injected as `applicationId`), and the
 * index/data-source/web-experience operations additionally inject their
 * sub-resource ids and receive grants on the sub-resource ARN plus its
 * parents (Q Business authorizes most actions against both the application
 * and the sub-resource).
 */
/**
 * Build the impl Effect for an application-scoped Q Business operation
 * (chat, conversations, users, subscriptions, chat controls, policy): the
 * runtime callable injects the bound {@link Application}'s id as
 * `applicationId` and the deploy-time half grants `actions` on the
 * application ARN (plus any `subResources` suffix patterns, e.g.
 * `retriever/*` for `SearchRelevantContent`, which Q Business additionally
 * authorizes against the retriever it searches).
 */
export const makeQBusinessApplicationHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (application) {
        const applicationId = yield* application.applicationId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${application}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                application.applicationArn,
                                ...(options.subResources ?? []).map((suffix) => Output.interpolate `${application.applicationArn}/${suffix}`),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${application.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                applicationId: yield* applicationId,
            });
        });
    });
});
/**
 * Build the impl Effect for an index-scoped Q Business operation (document
 * batches, groups, document reads): the runtime callable injects the bound
 * {@link Index}'s `applicationId` + `indexId` and the deploy-time half
 * grants `actions` on the index ARN **and** its parent application ARN —
 * Q Business authorizes index actions against both.
 */
export const makeQBusinessIndexHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (index) {
        const applicationId = yield* index.applicationId;
        const indexId = yield* index.indexId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${index}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                index.indexArn,
                                // The index ARN is `…:application/{appId}/index/{indexId}`
                                // — the parent application ARN is its prefix.
                                index.indexArn.pipe(Output.map((arn) => arn.split("/index/")[0])),
                                ...(options.subResources ?? []).map((suffix) => Output.interpolate `${index.indexArn}/${suffix}`),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${index.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                applicationId: yield* applicationId,
                indexId: yield* indexId,
            });
        });
    });
});
/**
 * Build the impl Effect for a data-source-scoped Q Business operation (the
 * sync job start/stop/list trio): the runtime callable injects the bound
 * {@link DataSource}'s `applicationId` + `indexId` + `dataSourceId`; the
 * deploy-time half grants `actions` on the data source ARN **and** its
 * parent index + application ARNs.
 */
export const makeQBusinessDataSourceHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (dataSource) {
        const applicationId = yield* dataSource.applicationId;
        const indexId = yield* dataSource.indexId;
        const dataSourceId = yield* dataSource.dataSourceId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${dataSource}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                dataSource.dataSourceArn,
                                // The data source ARN is
                                // `…:application/{appId}/index/{indexId}/data-source/{dsId}`
                                // — the parent index and application ARNs are prefixes.
                                dataSource.dataSourceArn.pipe(Output.map((arn) => arn.split("/data-source/")[0])),
                                dataSource.dataSourceArn.pipe(Output.map((arn) => arn.split("/index/")[0])),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${dataSource.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                applicationId: yield* applicationId,
                indexId: yield* indexId,
                dataSourceId: yield* dataSourceId,
            });
        });
    });
});
/**
 * Build the impl Effect for a web-experience-scoped Q Business operation
 * (anonymous URL minting): the runtime callable injects the bound
 * {@link WebExperience}'s `applicationId` + `webExperienceId`; the
 * deploy-time half grants `actions` on the web experience ARN **and** its
 * parent application ARN.
 */
export const makeQBusinessWebExperienceHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (webExperience) {
        const applicationId = yield* webExperience.applicationId;
        const webExperienceId = yield* webExperience.webExperienceId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${webExperience}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                webExperience.webExperienceArn,
                                // The web experience ARN is
                                // `…:application/{appId}/web-experience/{weId}` — the
                                // parent application ARN is its prefix.
                                webExperience.webExperienceArn.pipe(Output.map((arn) => arn.split("/web-experience/")[0])),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${webExperience.LogicalId})`)(function* (request) {
            const wire = options.prepare
                ? options.prepare(request)
                : request;
            return yield* op({
                ...wire,
                applicationId: yield* applicationId,
                webExperienceId: yield* webExperienceId,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map