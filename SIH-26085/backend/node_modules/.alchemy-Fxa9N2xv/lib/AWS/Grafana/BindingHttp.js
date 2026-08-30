import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS Managed Grafana HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation and the IAM action list is
 * boilerplate.
 */
/**
 * Build the impl Effect for an account-level operation (e.g. listing the
 * available Grafana versions). The deploy-time half grants `actions` on `*`.
 */
export const makeGrafanaAccountHttpBinding = (options) => Effect.gen(function* () {
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
            return yield* op((request ?? {}));
        });
    });
});
/**
 * Build the impl Effect for a workspace-scoped operation: the runtime
 * callable injects the bound {@link Workspace}'s id as `workspaceId` and the
 * deploy-time half grants `actions` on the workspace ARN.
 */
export const makeGrafanaWorkspaceHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (workspace) {
        const workspaceId = yield* workspace.workspaceId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${workspace}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${workspace.workspaceArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${workspace.LogicalId})`)(function* (request) {
            return yield* op({
                ...(request ?? {}),
                workspaceId: yield* workspaceId,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map