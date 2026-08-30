import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Bedrock Data Automation HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation and the IAM action list is
 * boilerplate.
 */
/**
 * Build the impl Effect for a project-scoped runtime operation (the sync and
 * async invoke APIs). The runtime callable injects the bound
 * {@link DataAutomationProject}'s ARN + stage as `dataAutomationConfiguration`
 * and the deploy-time half grants `actions` on the project ARN plus the
 * account's data automation profiles in every region — cross-region
 * inference profiles (e.g. `us.data-automation-v1`) fan requests out to
 * sibling regions, so the profile grant cannot be scoped to one region.
 */
export const makeBdaProjectHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (project) {
        const projectArn = yield* project.projectArn;
        const projectStage = yield* project.projectStage;
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
                                // Cross-region inference profiles live in every region of
                                // the geography (us./eu./apac.), so the profile resource
                                // cannot be pinned to the deploy region.
                                "arn:aws:bedrock:*:*:data-automation-profile/*",
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${project.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                dataAutomationConfiguration: {
                    dataAutomationProjectArn: yield* projectArn,
                    stage: yield* projectStage,
                },
            });
        });
    });
});
/**
 * Build the impl Effect for a library-scoped runtime operation (entity reads
 * and ingestion-job APIs). The runtime callable injects the bound
 * {@link DataAutomationLibrary}'s ARN as `libraryArn` and the deploy-time
 * half grants `actions` on the library ARN.
 */
export const makeBdaLibraryHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (library) {
        const libraryArn = yield* library.libraryArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${library}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `${library.libraryArn}`,
                                ...(options.additionalResources ?? []),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${library.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                libraryArn: yield* libraryArn,
            });
        });
    });
});
/**
 * Build the impl Effect for a blueprint-scoped runtime operation (blueprint
 * optimization). The runtime callable injects the bound {@link Blueprint}'s
 * ARN + stage as `blueprint` and the deploy-time half grants `actions` on the
 * blueprint ARN plus the account's data automation profiles in every region
 * (cross-region inference profiles fan out to sibling regions).
 */
export const makeBdaBlueprintOptimizationHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (blueprint) {
        const blueprintArn = yield* blueprint.blueprintArn;
        const blueprintStage = yield* blueprint.blueprintStage;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${blueprint}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `${blueprint.blueprintArn}`,
                                "arn:aws:bedrock:*:*:data-automation-profile/*",
                                // The invoke authorizes against the invocation resource
                                // (minted at runtime), not the blueprint ARN.
                                "arn:aws:bedrock:*:*:blueprint-optimization-invocation/*",
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${blueprint.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                blueprint: {
                    blueprintArn: yield* blueprintArn,
                    stage: yield* blueprintStage,
                },
            });
        });
    });
});
/**
 * Build the impl Effect for a blueprint-scoped management operation (version
 * snapshots and stage copies). The runtime callable injects the bound
 * {@link Blueprint}'s ARN as `blueprintArn` and the deploy-time half grants
 * `actions` on the blueprint ARN.
 */
export const makeBdaBlueprintHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (blueprint) {
        const blueprintArn = yield* blueprint.blueprintArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${blueprint}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${blueprint.blueprintArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${blueprint.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                blueprintArn: yield* blueprintArn,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level runtime operation (job status
 * polling). The deploy-time half grants `actions` on `*` — invocation ARNs
 * (`…:data-automation-invocation/{id}`) are minted at runtime and unknowable
 * at deploy time.
 */
export const makeBdaAccountHttpBinding = (options) => Effect.gen(function* () {
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
            return yield* op(request);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map