import * as Effect from "effect/Effect";
/** Prove that a deployment belongs to an App before mutating or deleting it. */
export const ensureDeploymentMembership = Effect.fn(function* (client, appId, deployment, knownLatestDeploymentId) {
    if (knownLatestDeploymentId === deployment.id)
        return;
    const matches = (yield* client.listAppDeployments(appId)).filter((candidate) => candidate.id === deployment.id);
    if (matches.length !== 1 ||
        matches[0]?.foundryVersionId !== deployment.foundryVersionId) {
        return yield* Effect.fail(new Error(`Prisma deployment '${deployment.id}' with Foundry version '${deployment.foundryVersionId}' is not uniquely owned by App '${appId}'. Refusing to start, promote, or delete a mismatched deployment.`));
    }
});
//# sourceMappingURL=DeploymentIdentity.js.map