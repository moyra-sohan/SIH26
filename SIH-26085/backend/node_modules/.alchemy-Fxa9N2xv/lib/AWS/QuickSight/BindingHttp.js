import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Amazon QuickSight HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the scoping resource, and the IAM
 * action list is boilerplate.
 *
 * Every QuickSight API call requires the `AwsAccountId`. The runtime half of
 * each binding derives it from the bound resource's ARN
 * (`arn:aws:quicksight:{region}:{account}:{type}/{id}`), so no extra
 * environment plumbing is needed inside the Lambda.
 */
/** Extract the AWS account id from a QuickSight resource ARN. */
export const accountIdFromArn = (arn) => arn.split(":")[4];
/**
 * Build the impl Effect for a QuickSight operation scoped to a
 * {@link Dashboard}: the deploy-time half grants `actions` on the bound
 * dashboard's ARN, and the runtime half injects `AwsAccountId` (parsed from
 * the dashboard ARN) and `DashboardId` into every request.
 */
export const makeQuickSightDashboardHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (dashboard) {
        const DashboardId = yield* dashboard.dashboardId;
        const Arn = yield* dashboard.arn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${dashboard}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [dashboard.arn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${dashboard.LogicalId})`)(function* (request) {
            const arn = yield* Arn;
            return yield* op({
                ...request,
                AwsAccountId: accountIdFromArn(arn),
                DashboardId: yield* DashboardId,
            });
        });
    });
});
/**
 * Build the impl Effect for a QuickSight operation scoped to a
 * {@link DataSet}: the deploy-time half grants `actions` on the bound
 * dataset's ARN and its `…/ingestion/*` sub-resources, and the runtime half
 * injects `AwsAccountId` (parsed from the dataset ARN) and `DataSetId` into
 * every request.
 */
export const makeQuickSightDataSetHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (dataSet) {
        const DataSetId = yield* dataSet.dataSetId;
        const Arn = yield* dataSet.arn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${dataSet}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                dataSet.arn,
                                Output.interpolate `${dataSet.arn}/ingestion/*`,
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${dataSet.LogicalId})`)(function* (request) {
            const arn = yield* Arn;
            return yield* op({
                ...request,
                AwsAccountId: accountIdFromArn(arn),
                DataSetId: yield* DataSetId,
            });
        });
    });
});
/**
 * Build the impl Effect for a QuickSight embed-URL operation scoped to a
 * {@link Dashboard}: the deploy-time half grants `actions` on `*` (embed-URL
 * actions authorize against user/namespace ARNs that are unknown at deploy
 * time), and the runtime half injects `AwsAccountId` and defaults the
 * experience configuration to the bound dashboard via `applyDefaults`.
 */
export const makeQuickSightEmbedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (dashboard) {
        const DashboardId = yield* dashboard.dashboardId;
        const Arn = yield* dashboard.arn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${dashboard}))`({
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
        return Effect.fn(`${options.tag}(${dashboard.LogicalId})`)(function* (request) {
            const arn = yield* Arn;
            const dashboardId = yield* DashboardId;
            return yield* op({
                ...options.applyDefaults(request, { dashboardId, arn }),
                AwsAccountId: accountIdFromArn(arn),
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map