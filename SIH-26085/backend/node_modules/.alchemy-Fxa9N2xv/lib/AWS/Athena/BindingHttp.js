import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Athena HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two builders
 * below. Everything except the operation, the IAM action list, and the
 * injected identifier is boilerplate.
 */
/**
 * Build the impl Effect for a workgroup-scoped query operation. Athena
 * authorizes query-execution actions against the workgroup the query ran in,
 * so the deploy-time half grants `actions` on the bound {@link WorkGroup}'s
 * ARN. When `injectWorkGroup` is set, the runtime callable also injects the
 * workgroup's name as the request's `WorkGroup` field (for operations like
 * `ListQueryExecutions` that scope by workgroup in the request itself).
 */
export const makeWorkGroupScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (workGroup) {
        const WorkGroupName = yield* workGroup.workGroupName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${workGroup}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [workGroup.workGroupArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${workGroup.LogicalId})`)(function* (request) {
            return yield* op((options.injectWorkGroup
                ? { ...request, WorkGroup: yield* WorkGroupName }
                : request));
        });
    });
});
// The datacatalog ARN is `arn:aws:athena:{region}:{account}:datacatalog/{name}`
// — the Glue Data Catalog ARNs share that partition/region/account.
const glueArns = (dataCatalogArn) => {
    const base = dataCatalogArn.pipe(Output.map((arn) => {
        const [, partition, , region, account] = arn.split(":");
        return `arn:${partition}:glue:${region}:${account}`;
    }));
    return [
        base.pipe(Output.map((b) => `${b}:catalog`)),
        base.pipe(Output.map((b) => `${b}:database/*`)),
        base.pipe(Output.map((b) => `${b}:table/*/*`)),
    ];
};
/**
 * Build the impl Effect for a catalog-metadata operation. The runtime callable
 * injects the bound {@link DataCatalog}'s name as `CatalogName`; the
 * deploy-time half grants `actions` on the datacatalog ARN plus the Glue
 * Data Catalog reads Athena performs on the caller's behalf when the catalog
 * resolves through Glue.
 */
export const makeDataCatalogScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (catalog) {
        const CatalogName = yield* catalog.name;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${catalog}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [catalog.dataCatalogArn],
                        },
                        {
                            // Metadata reads through a GLUE-type catalog federate to the
                            // Glue Data Catalog with the caller's credentials.
                            Effect: "Allow",
                            Action: [
                                "glue:GetDatabase",
                                "glue:GetDatabases",
                                "glue:GetTable",
                                "glue:GetTables",
                                "glue:GetPartition",
                                "glue:GetPartitions",
                            ],
                            Resource: glueArns(catalog.dataCatalogArn),
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${catalog.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                CatalogName: yield* CatalogName,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map