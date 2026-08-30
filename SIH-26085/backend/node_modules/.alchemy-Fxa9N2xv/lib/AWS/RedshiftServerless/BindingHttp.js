import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Amazon Redshift Serverless HTTP bindings.
 *
 * NOT exported from `index.ts` — every snapshot/recovery-point/restore
 * `{Op}Http.ts` in this service is a thin
 * `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the identifier resolver, and the
 * IAM action list is boilerplate. (`ConnectHttp` stays bespoke — it also
 * publishes endpoint environment variables and formats connection URLs.)
 */
/**
 * Build the impl Effect for an account-level operation (snapshot
 * administration, recovery-point reads, table-restore status). The
 * deploy-time half grants `actions` on `*` — these operations span every
 * namespace in the account and the identifiers they filter on are runtime
 * data.
 */
export const makeServerlessAccountHttpBinding = (options) => Effect.gen(function* () {
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
 * Build the impl Effect for a namespace-scoped operation: the runtime
 * callable injects the bound {@link Namespace}'s name as `namespaceName`
 * and the deploy-time half grants `actions` on the namespace ARN (plus any
 * `extraResources`, e.g. the `snapshot/*` or `recoverypoint/*` ARN patterns
 * that snapshot creation and restores also authorize against).
 */
export const makeServerlessNamespaceHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (namespace) {
        const Identifier = yield* namespace.namespaceName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const resources = options.extraResources;
                yield* host.bind `Allow(${host}, ${options.tag}(${namespace}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: resources
                                ? Output.map(namespace.namespaceArn, (arn) => [
                                    arn,
                                    ...resources(arn),
                                ])
                                : [Output.interpolate `${namespace.namespaceArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${namespace.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                namespaceName: yield* Identifier,
            });
        });
    });
});
/**
 * The `arn:…:{account}` prefix of a Redshift Serverless resource ARN —
 * used to widen a namespace grant to sibling resource types (`snapshot/*`,
 * `recoverypoint/*`, `workgroup/*`) that snapshot and restore operations
 * also authorize against.
 */
export const serverlessArnPrefix = (arn) => arn.split(":").slice(0, 5).join(":");
//# sourceMappingURL=BindingHttp.js.map