import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the impl Effect for a repository-scoped ECR operation. The
 * deploy-time half grants `iamActions` on the bound repository's ARN; the
 * runtime callable injects the repository's `repositoryName` into every
 * request (the registry defaults to the caller's own account).
 *
 * Registry-level operations (`ecr:GetAuthorizationToken`, which authorizes
 * only on `Resource: ["*"]`) stay bespoke in their own `{Op}Http.ts`.
 */
export const makeEcrRepositoryHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (repository) {
        const RepositoryName = yield* repository.repositoryName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.ECR.${options.capability}(${repository}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.iamActions],
                            Resource: [repository.repositoryArn],
                        },
                    ],
                });
            }
        }
        // The request is optional at the impl level so contracts whose
        // remaining fields are all optional (DescribeImages, ListImages, …) can
        // declare `(request?: …)`; contracts with required fields keep the
        // parameter required and narrow this signature.
        return Effect.fn(`AWS.ECR.${options.capability}(${repository.LogicalId})`)(function* (request) {
            return yield* op({
                ...(request ?? {}),
                repositoryName: yield* RepositoryName,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map