import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
import { Region } from "../Region.js";
/**
 * Shared HTTP scaffolding for the AWS Cost and Usage Report (`cur`) runtime
 * bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below.
 *
 * The CUR control plane is a global service hosted only in `us-east-1`, so
 * every operation is resolved with the distilled Region pinned there —
 * exactly like the {@link ReportDefinition} provider. The distilled Region
 * service value is `Effect<RegionName>`, not a raw string, hence
 * `Effect.succeed`.
 */
const CUR_REGION = "us-east-1";
const pinCur = (effect) => effect.pipe(Effect.provideService(Region, Effect.succeed(CUR_REGION)));
/**
 * Build the impl Effect for an account-level CUR operation.
 * `cur:DescribeReportDefinitions` enumerates every report definition in the
 * account, so the grant is on `Resource: ["*"]`.
 */
export const makeCurHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* pinCur(options.operation);
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const policyStatements = [
                    {
                        Effect: "Allow",
                        Action: [...options.iamActions],
                        Resource: ["*"],
                    },
                ];
                yield* host.bind `Allow(${host}, AWS.CostAndUsageReport.${options.capability}())`({
                    policyStatements,
                });
            }
        }
        return Effect.fn(`AWS.CostAndUsageReport.${options.capability}`)(function* (request) {
            // The region must also be pinned at the call site: the yield-time
            // snapshot is only a fallback — the calling fiber's ambient Region
            // (the host Function's own region) wins over it.
            return yield* pinCur(op((request ?? {})));
        });
    });
});
/**
 * Build the impl Effect for an operation scoped to one
 * {@link ReportDefinition}. The runtime callable injects the bound report's
 * name as the request's `ReportName`; the deploy-time half grants
 * `iamActions` on the report definition's ARN
 * (`arn:aws:cur:us-east-1:{account}:definition/{name}`).
 */
export const makeReportDefinitionHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* pinCur(options.operation);
    return Effect.fn(function* (report) {
        const ReportName = yield* report.reportName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.CostAndUsageReport.${options.capability}(${report}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.iamActions],
                            Resource: [report.reportArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.CostAndUsageReport.${options.capability}(${report.LogicalId})`)(function* (request) {
            // Call-site region pin — see makeCurHttpBinding above.
            return yield* pinCur(op({
                ...request,
                ReportName: yield* ReportName,
            }));
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map