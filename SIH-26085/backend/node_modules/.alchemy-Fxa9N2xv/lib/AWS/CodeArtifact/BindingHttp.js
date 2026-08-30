import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/** The bound repository's own ARN (repository-level actions). */
export const repositoryArns = (repository) => [repository.repositoryArn];
/**
 * ARN matching every package in the bound repository
 * (`arn:…:package/{domain}/{repository}/*`) — package-level actions like
 * `codeartifact:DescribePackage` authorize against the package resource,
 * not the repository.
 */
export const packageArns = (repository) => [
    repository.repositoryArn.pipe(Output.map((arn) => `${arn.replace(":repository/", ":package/")}/*`)),
];
/**
 * ARNs matching every repository and every package in the bound repository's
 * domain — for operations like `codeartifact:CopyPackageVersions` that read
 * from a sibling repository in the same domain.
 */
export const domainWideArns = (repository) => ["repository", "package"].map((kind) => repository.repositoryArn.pipe(Output.map((arn) => {
    const [prefix, rest] = arn.split(":repository/");
    return `${prefix}:${kind}/${rest.split("/")[0]}/*`;
})));
/**
 * Build the impl Effect for a repository-scoped CodeArtifact operation. The
 * deploy-time half grants `actions` on `resources` (default: the repository
 * ARN); the runtime callable injects the bound repository's `domain`,
 * `domainOwner`, and `repository` into every request.
 *
 * Operations that scope by a differently-named field (e.g.
 * `CopyPackageVersions`' `destinationRepository`) stay bespoke in their own
 * `{Op}Http.ts` and reuse just the ARN helpers above.
 */
export const makeRepositoryHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (repository) {
        const DomainName = yield* repository.domainName;
        const DomainOwner = yield* repository.domainOwner;
        const RepositoryName = yield* repository.repositoryName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${repository}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: (options.resources ?? repositoryArns)(repository),
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${repository.LogicalId})`)(function* (request) {
            const owner = yield* DomainOwner;
            return yield* op({
                ...request,
                domain: yield* DomainName,
                ...(owner === "" ? {} : { domainOwner: owner }),
                repository: yield* RepositoryName,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map