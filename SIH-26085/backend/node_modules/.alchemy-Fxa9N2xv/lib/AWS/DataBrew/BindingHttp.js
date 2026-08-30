import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS Glue DataBrew HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Every DataBrew data-plane operation addresses its resource by a
 * `Name` path parameter and authorizes against that resource's ARN, so each
 * builder injects the bound resource's name and grants `actions` on its ARN;
 * everything except the operation and the IAM action is boilerplate.
 */
/**
 * Build the impl Effect for a job-anchored operation: the runtime callable
 * injects the bound {@link Job}'s name as `Name` and the deploy-time half
 * grants `actions` on the job ARN.
 */
export const makeDataBrewJobHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (job) {
        // Outputs yield a DEFERRED effect — resolve again per invocation below.
        const JobName = yield* job.jobName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${job}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${job.jobArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${job.LogicalId})`)(function* (request) {
            return yield* op({ ...request, Name: yield* JobName });
        });
    });
});
/**
 * Build the impl Effect for a project-anchored operation: the runtime
 * callable injects the bound {@link Project}'s name as `Name` and the
 * deploy-time half grants `actions` on the project ARN.
 */
export const makeDataBrewProjectHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (project) {
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
            return yield* op({ ...request, Name: yield* ProjectName });
        });
    });
});
/**
 * Build the impl Effect for a recipe-anchored operation: the runtime
 * callable injects the bound {@link Recipe}'s name as `Name` and the
 * deploy-time half grants `actions` on the recipe ARN.
 */
export const makeDataBrewRecipeHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (recipe) {
        const RecipeName = yield* recipe.recipeName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${recipe}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${recipe.recipeArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${recipe.LogicalId})`)(function* (request) {
            return yield* op({ ...request, Name: yield* RecipeName });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map