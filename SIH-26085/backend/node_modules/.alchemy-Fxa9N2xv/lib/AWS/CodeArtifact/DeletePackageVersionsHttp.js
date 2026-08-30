import * as codeartifact from "@distilled.cloud/aws/codeartifact";
import * as Layer from "effect/Layer";
import { makeRepositoryHttpBinding, packageArns } from "./BindingHttp.js";
import { DeletePackageVersions } from "./DeletePackageVersions.js";
/** HTTP implementation of {@link DeletePackageVersions} over the CodeArtifact API. */
export const DeletePackageVersionsHttp = Layer.effect(DeletePackageVersions, makeRepositoryHttpBinding({
    tag: "AWS.CodeArtifact.DeletePackageVersions",
    operation: codeartifact.deletePackageVersions,
    actions: ["codeartifact:DeletePackageVersions"],
    resources: packageArns,
}));
//# sourceMappingURL=DeletePackageVersionsHttp.js.map