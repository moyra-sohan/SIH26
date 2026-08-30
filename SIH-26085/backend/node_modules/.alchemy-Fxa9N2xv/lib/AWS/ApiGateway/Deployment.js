import * as ag from "@distilled.cloud/aws/api-gateway";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { createHash } from "node:crypto";
import { deepEqual, isResolved } from "../../Diff.js";
import * as Output from "../../Output.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { Stack } from "../../Stack.js";
import { retryOnApiStatusUpdating } from "./common.js";
/**
 * A point-in-time snapshot of a REST API, ready to be served through a
 * `Stage`.
 * ### Creating a deployment
 * A Deployment captures whatever methods, integrations, resources, and
 * authorizers currently exist on the REST API and produces an immutable
 * `deploymentId` that a `Stage` can point at. Pass the `RestApi` value on
 * `restApi` and Alchemy handles all the ordering for you — the deployment
 * will run after every method bound to the API.
 *
 * **Example:** Deployment of a REST API
 * ```typescript
 * const api = yield* ApiGateway.RestApi("Api", {
 *   endpointConfiguration: { types: ["REGIONAL"] },
 * });
 *
 * yield* ApiGateway.Method("GetRoot", {
 *   restApi: api,
 *   httpMethod: "GET",
 *   authorizationType: "NONE",
 *   integration: { type: "MOCK" },
 * });
 *
 * const deployment = yield* ApiGateway.Deployment("Release", {
 *   restApi: api,
 *   description: "v1",
 * });
 * ```
 *
 * ### Forcing a redeploy
 * Usually you do not have to: `restApi` already makes the Deployment
 * depend on every method, so any change to a method re-plans a new
 * deployment. Use `triggers` when you want to couple the deployment to a
 * signal Alchemy cannot see — for example, a manual version bump or a
 * hash of configuration computed outside the stack.
 *
 * **Example:** Force redeploy on a version bump
 * ```typescript
 * const deployment = yield* ApiGateway.Deployment("Release", {
 *   restApi: api,
 *   triggers: { version: "2026-05-01" },
 * });
 * ```
 *
 * ### Why no DependsOn?
 * CloudFormation's `AWS::ApiGateway::Deployment` famously requires a
 * hand-written `DependsOn: [Method1, Method2, ...]` listing every method.
 * Alchemy derives that list automatically from the bindings registered on
 * the `RestApi`, so adding a method never requires editing the deployment.
 *
 * @resource
 */
export const DeploymentResource = Resource("AWS.ApiGateway.Deployment");
/**
 * User-facing wrapper that adds a dependency edge from the Deployment to
 * every resource bound to the supplied `restApi`. Implementation detail:
 * each binding's output references get copied into the deployment's
 * `triggers` map so `resolveUpstream` sees them as real upstream dependencies.
 */
export const Deployment = (id, props) => Effect.gen(function* () {
    const { restApi, ...rest } = props;
    const restApiId = rest.restApiId ?? restApi?.restApiId;
    if (!restApiId) {
        return yield* Effect.die("Deployment requires either `restApi` (preferred) or explicit " +
            "`restApiId`.");
    }
    let triggers = rest.triggers;
    if (restApi) {
        const stack = yield* Stack;
        const bindings = stack.bindings[restApi.FQN] ?? [];
        const autoTriggers = {};
        for (const b of bindings) {
            autoTriggers[`@alchemy:binding:${b.sid}`] = bindingDigest(b.data);
        }
        triggers = { ...autoTriggers, ...triggers };
    }
    return yield* DeploymentResource(id, {
        ...rest,
        restApiId,
        triggers,
    });
});
/**
 * Serializes a binding payload down to a deterministic `Input<string>` so
 * it can ride along as a trigger value. The inner `Output.all` is what
 * surfaces the underlying resource FQNs to the dependency resolver.
 */
const bindingDigest = (data) => {
    const entries = Object.entries(data).filter(([k]) => k !== "kind");
    const values = entries.map(([, v]) => Output.asOutput(v));
    return Output.map(Output.all(...values), (parts) => [data.kind, ...parts.map(String)].join("|"));
};
const embedTriggers = (description, triggers) => Effect.gen(function* () {
    if (!triggers || Object.keys(triggers).length === 0) {
        return description;
    }
    const fp = yield* Effect.sync(() => createHash("sha256")
        .update(JSON.stringify(triggers))
        .digest("hex")
        .slice(0, 24));
    const suffix = `@alchemy:triggers:${fp}`;
    return description ? `${description}\n${suffix}` : suffix;
});
export const DeploymentProvider = () => Provider.effect(DeploymentResource, Effect.gen(function* () {
    return {
        stables: ["deploymentId", "restApiId"],
        // Deployments are sub-resources keyed by `restApiId`. Enumerate every
        // RestApi in the account/region, then page every deployment under each
        // one and flatten — yielding the same Attributes shape `read` returns.
        list: () => Effect.gen(function* () {
            const restApiIds = yield* ag.getRestApis.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.items ?? [])
                .map((api) => api.id)
                .filter((id) => id != null))));
            const rows = yield* Effect.forEach(restApiIds, (restApiId) => ag.getDeployments.pages({ restApiId }).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.items ?? [])
                .filter((d) => d.id != null)
                .map((d) => ({
                deploymentId: d.id,
                restApiId,
                description: d.description,
            }))))), { concurrency: 10 });
            return rows.flat();
        }),
        diff: Effect.fn(function* ({ news: newsIn, olds }) {
            if (!isResolved(newsIn))
                return;
            const news = newsIn;
            const oldsP = olds;
            if (news.restApiId !== oldsP.restApiId) {
                return { action: "replace" };
            }
            if (!deepEqual(news.triggers, oldsP.triggers)) {
                return { action: "replace" };
            }
            if (news.stageName !== oldsP.stageName ||
                news.stageDescription !== oldsP.stageDescription ||
                news.cacheClusterEnabled !== oldsP.cacheClusterEnabled ||
                news.cacheClusterSize !== oldsP.cacheClusterSize ||
                !deepEqual(news.variables, oldsP.variables) ||
                !deepEqual(news.canarySettings, oldsP.canarySettings) ||
                news.tracingEnabled !== oldsP.tracingEnabled) {
                return { action: "replace" };
            }
            if (news.description !== oldsP.description) {
                return { action: "update" };
            }
        }),
        read: Effect.fn(function* ({ output }) {
            if (!output?.deploymentId)
                return undefined;
            const d = yield* ag
                .getDeployment({
                restApiId: output.restApiId,
                deploymentId: output.deploymentId,
            })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)));
            if (!d?.id)
                return undefined;
            return {
                deploymentId: d.id,
                restApiId: output.restApiId,
                description: d.description,
            };
        }),
        reconcile: Effect.fn(function* ({ news: newsIn, output, session }) {
            if (!isResolved(newsIn)) {
                return yield* Effect.die("Deployment props were not resolved");
            }
            const news = newsIn;
            const description = yield* embedTriggers(news.description, news.triggers);
            const restApiId = (output?.restApiId ?? news.restApiId);
            // Observe — fetch the live deployment if we have a cached id.
            // A Deployment is immutable apart from `description`, so we never
            // trust a stale `output.description` for diffing.
            let observed = output?.deploymentId
                ? yield* ag
                    .getDeployment({
                    restApiId,
                    deploymentId: output.deploymentId,
                })
                    .pipe(Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)))
                : undefined;
            // Ensure — create a new deployment if there isn't one yet.
            // `createDeployment` always produces a fresh deploymentId, so we
            // only call it when missing; any change that should produce a new
            // deployment is modeled as `replace` in `diff`.
            if (!observed?.id) {
                const created = yield* retryOnApiStatusUpdating(ag.createDeployment({
                    restApiId: news.restApiId,
                    stageName: news.stageName,
                    stageDescription: news.stageDescription,
                    description,
                    cacheClusterEnabled: news.cacheClusterEnabled,
                    cacheClusterSize: news.cacheClusterSize,
                    variables: news.variables,
                    canarySettings: news.canarySettings,
                    tracingEnabled: news.tracingEnabled,
                }));
                if (!created.id)
                    return yield* Effect.die("createDeployment missing id");
                yield* session.note(`Created deployment ${created.id}`);
                observed = yield* ag.getDeployment({
                    restApiId: news.restApiId,
                    deploymentId: created.id,
                });
            }
            const deploymentId = observed.id;
            // Sync description — observed ↔ desired.
            if (description !== observed.description) {
                yield* retryOnApiStatusUpdating(ag.updateDeployment({
                    restApiId,
                    deploymentId,
                    patchOperations: description
                        ? [
                            {
                                op: "replace",
                                path: "/description",
                                value: description,
                            },
                        ]
                        : [{ op: "remove", path: "/description" }],
                }));
            }
            yield* session.note(`Reconciled deployment ${deploymentId}`);
            const final = yield* ag.getDeployment({
                restApiId,
                deploymentId,
            });
            return {
                deploymentId,
                restApiId,
                description: final?.description,
            };
        }),
        delete: Effect.fn(function* ({ output, session }) {
            yield* retryOnApiStatusUpdating(ag
                .deleteDeployment({
                restApiId: output.restApiId,
                deploymentId: output.deploymentId,
            })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.void)));
            yield* session.note(`Deleted deployment ${output.deploymentId}`);
        }),
    };
}));
//# sourceMappingURL=Deployment.js.map