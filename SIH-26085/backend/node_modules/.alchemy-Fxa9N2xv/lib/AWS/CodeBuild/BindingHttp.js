import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS CodeBuild HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the IAM action, and (for
 * name-injecting operations) the injected `projectName`/`reportGroupArn` is
 * boilerplate.
 *
 * CodeBuild authorizes builds, batch builds, sandboxes, and cache operations
 * against the *project* ARN, and report operations against the
 * *report-group* ARN — even when the request addresses a build/report id —
 * so every builder grants on the bound resource's ARN.
 */
/**
 * Build the impl Effect for an operation whose input carries a
 * `projectName` field: the runtime callable injects the bound
 * {@link Project}'s name and the deploy-time half grants `actions` on the
 * project ARN.
 */
export const makeCodeBuildProjectNameHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (project) {
        // Outputs yield a DEFERRED effect — resolve again per invocation below.
        const ProjectName = yield* project.projectName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${project}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${project.projectArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${project.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                projectName: yield* ProjectName,
            });
        });
    });
});
/**
 * Build the impl Effect for a project-anchored operation whose input
 * addresses builds/batches/sandboxes by id: the request passes through
 * as-is and the deploy-time half grants `actions` on the project ARN
 * (CodeBuild authorizes build-/batch-addressed operations against the
 * project the id belongs to). Sandbox-addressed actions authorize against
 * the *sandbox* ARN (`…:sandbox/{project-name}:{uuid}`) — set
 * `sandboxScoped` to additionally grant on the project's sandbox pattern.
 */
export const makeCodeBuildProjectHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (project) {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${project}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `${project.projectArn}`,
                                ...(options.sandboxScoped
                                    ? [
                                        Output.map(project.projectArn, (arn) => `${arn.replace(":project/", ":sandbox/")}:*`),
                                    ]
                                    : []),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${project.LogicalId})`)(function* (request) {
            return yield* op(request);
        });
    });
});
/**
 * Build the impl Effect for an operation whose input carries a
 * `reportGroupArn` field: the runtime callable injects the bound
 * {@link ReportGroup}'s ARN and the deploy-time half grants `actions` on
 * the report-group ARN.
 */
export const makeCodeBuildReportGroupArnHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (reportGroup) {
        const ReportGroupArn = yield* reportGroup.reportGroupArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${reportGroup}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${reportGroup.reportGroupArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${reportGroup.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                reportGroupArn: yield* ReportGroupArn,
            });
        });
    });
});
/**
 * Build the impl Effect for a report-group-anchored operation whose input
 * addresses reports by ARN: the request passes through as-is and the
 * deploy-time half grants `actions` on the report-group ARN (CodeBuild
 * authorizes report operations against the report group the report belongs
 * to).
 */
export const makeCodeBuildReportGroupHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (reportGroup) {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${reportGroup}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${reportGroup.reportGroupArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${reportGroup.LogicalId})`)(function* (request) {
            return yield* op(request);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map