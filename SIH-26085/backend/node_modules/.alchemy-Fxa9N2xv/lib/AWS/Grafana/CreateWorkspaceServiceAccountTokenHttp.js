import * as grafana from "@distilled.cloud/aws/grafana";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { toWireSeconds } from "../../Util/Duration.js";
import { isBindingHost } from "../Lambda/Function.js";
import { CreateWorkspaceServiceAccountToken, } from "./CreateWorkspaceServiceAccountToken.js";
/**
 * Bespoke (not scaffold-built): the runtime request carries a
 * `timeToLive: Duration.Input` that is converted to the wire's
 * `secondsToLive` via the central Duration util.
 */
export const CreateWorkspaceServiceAccountTokenHttp = Layer.effect(CreateWorkspaceServiceAccountToken, Effect.gen(function* () {
    const op = yield* grafana.createWorkspaceServiceAccountToken;
    return Effect.fn(function* (workspace) {
        const workspaceId = yield* workspace.workspaceId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.Grafana.CreateWorkspaceServiceAccountToken(${workspace}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: ["grafana:CreateWorkspaceServiceAccountToken"],
                            Resource: [Output.interpolate `${workspace.workspaceArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.Grafana.CreateWorkspaceServiceAccountToken(${workspace.LogicalId})`)(function* (request) {
            return yield* op({
                name: request.name,
                serviceAccountId: request.serviceAccountId,
                secondsToLive: toWireSeconds(request.timeToLive),
                workspaceId: yield* workspaceId,
            });
        });
    });
}));
//# sourceMappingURL=CreateWorkspaceServiceAccountTokenHttp.js.map