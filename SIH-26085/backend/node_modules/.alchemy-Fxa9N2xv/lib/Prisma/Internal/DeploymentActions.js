import * as Effect from "effect/Effect";
import { isConflict, isNotFound, } from "../Client.js";
import { observeDeployment } from "./DeploymentObserve.js";
const startConflictIsIdempotent = (client, deploymentId, error) => observeDeployment(client, deploymentId).pipe(Effect.flatMap((deployment) => deployment.status === "running" || deployment.status === "provisioning"
    ? Effect.succeed(undefined)
    : Effect.fail(error)), Effect.catchIf(isNotFound, () => Effect.fail(error)));
const stopConflictIsIdempotent = (client, deploymentId, error) => observeDeployment(client, deploymentId).pipe(Effect.flatMap((deployment) => deployment.status === "stopped" || deployment.status === "stopping"
    ? Effect.void
    : Effect.fail(error)), Effect.catchIf(isNotFound, () => Effect.fail(error)));
export const startDeploymentIdempotent = (client, deploymentId) => client
    .startDeployment(deploymentId)
    .pipe(Effect.catchIf(isConflict, (error) => startConflictIsIdempotent(client, deploymentId, error)));
export const stopDeploymentIdempotent = (client, deploymentId) => client
    .stopDeployment(deploymentId)
    .pipe(Effect.catchIf(isConflict, (error) => stopConflictIsIdempotent(client, deploymentId, error)));
//# sourceMappingURL=DeploymentActions.js.map