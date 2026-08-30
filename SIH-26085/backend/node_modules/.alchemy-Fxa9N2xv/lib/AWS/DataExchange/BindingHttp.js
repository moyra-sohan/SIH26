import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS Data Exchange HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the three
 * builders below. Everything except the operation, the IAM action list, and
 * the granted ARNs is boilerplate: the runtime callable injects `DataSetId`
 * (and `RevisionId` for revision-scoped operations) from the bound resource.
 */
/** The bound data set's own ARN (data-set-level actions). */
export const dataSetArns = (dataSet) => [
    dataSet.dataSetArn,
];
/**
 * ARN matching every asset in the bound data set
 * (`arn:…:data-sets/{id}/revisions/star/assets/star`) — asset-level actions
 * like `dataexchange:SendApiAsset` authorize against the asset resource.
 */
export const dataSetAssetArns = (dataSet) => [
    dataSet.dataSetArn.pipe(Output.map((arn) => `${arn}/revisions/*/assets/*`)),
];
/**
 * The bound data set's ARN plus a wildcard over every sub-resource
 * (`arn:…:data-sets/{id}` and `arn:…:data-sets/{id}/star`) — IAM wildcards
 * match across `/`, so one pattern covers revisions and assets alike. Used
 * by the revision/asset data-plane bindings that receive `RevisionId` and
 * `AssetId` at runtime (e.g. a Lambda that publishes a fresh revision on a
 * schedule needs the grant to cover revisions that do not exist yet).
 */
export const dataSetAndSubresourceArns = (dataSet) => [
    dataSet.dataSetArn,
    Output.interpolate `${dataSet.dataSetArn}/*`,
];
/** The bound revision's own ARN (revision-level actions). */
export const revisionArns = (revision) => [
    revision.revisionArn,
];
/**
 * ARN matching every asset in the bound revision
 * (`arn:…:data-sets/{ds}/revisions/{rev}/assets/star`) — asset-level
 * actions like `dataexchange:GetAsset` authorize against the asset resource.
 */
export const revisionAssetArns = (revision) => [
    revision.revisionArn.pipe(Output.map((arn) => `${arn}/assets/*`)),
];
/**
 * Build the impl Effect for a Data Exchange operation scoped to a
 * {@link DataSet}: the deploy-time half grants `actions` on `resources`
 * (default: the data set's ARN), and the runtime half injects the data set's
 * `DataSetId` into every request.
 */
export const makeDataSetHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (dataSet) {
        const DataSetId = yield* dataSet.dataSetId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${dataSet}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: (options.resources ?? dataSetArns)(dataSet),
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${dataSet.LogicalId})`)(function* (request) {
            const dataSetId = yield* DataSetId;
            return yield* op({ ...request, DataSetId: dataSetId });
        });
    });
});
/**
 * Build the impl Effect for a Data Exchange operation scoped to a
 * {@link Revision}: the deploy-time half grants `actions` on `resources`
 * (default: the revision's ARN), and the runtime half injects the revision's
 * `DataSetId` and `RevisionId` into every request.
 */
export const makeRevisionHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (revision) {
        const DataSetId = yield* revision.dataSetId;
        const RevisionId = yield* revision.revisionId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${revision}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: (options.resources ?? revisionArns)(revision),
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${revision.LogicalId})`)(function* (request) {
            const dataSetId = yield* DataSetId;
            const revisionId = yield* RevisionId;
            return yield* op({
                ...request,
                DataSetId: dataSetId,
                RevisionId: revisionId,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level Data Exchange operation (jobs,
 * data grants, enumerations). The deploy-time half grants `actions` on `*`
 * — jobs and data grants are account-scoped resources whose ids only exist
 * at runtime, so there is no resource ARN to scope down to.
 */
export const makeDataExchangeAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(options.tag)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map