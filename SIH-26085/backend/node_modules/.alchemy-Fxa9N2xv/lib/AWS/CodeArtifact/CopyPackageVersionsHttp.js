import * as codeartifact from "@distilled.cloud/aws/codeartifact";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
import { domainWideArns } from "./BindingHttp.js";
import { CopyPackageVersions, } from "./CopyPackageVersions.js";
/**
 * HTTP implementation of {@link CopyPackageVersions} over the CodeArtifact
 * API. Bespoke (not the shared repository scaffolding): the bound repository
 * is injected as `destinationRepository`, and the copy also reads from the
 * caller-chosen source repository, so the grant spans every repository and
 * package in the domain.
 */
export const CopyPackageVersionsHttp = Layer.effect(CopyPackageVersions, Effect.gen(function* () {
    const op = yield* codeartifact.copyPackageVersions;
    return Effect.fn(function* (repository) {
        const DomainName = yield* repository.domainName;
        const DomainOwner = yield* repository.domainOwner;
        const RepositoryName = yield* repository.repositoryName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.CodeArtifact.CopyPackageVersions(${repository}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [
                                "codeartifact:CopyPackageVersions",
                                // The copy reads version metadata and assets from the
                                // source repository on the caller's behalf.
                                "codeartifact:ReadFromRepository",
                                "codeartifact:DescribePackageVersion",
                            ],
                            Resource: domainWideArns(repository),
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.CodeArtifact.CopyPackageVersions(${repository.LogicalId})`)(function* (request) {
            const owner = yield* DomainOwner;
            return yield* op({
                ...request,
                domain: yield* DomainName,
                ...(owner === "" ? {} : { domainOwner: owner }),
                destinationRepository: yield* RepositoryName,
            });
        });
    });
}));
//# sourceMappingURL=CopyPackageVersionsHttp.js.map