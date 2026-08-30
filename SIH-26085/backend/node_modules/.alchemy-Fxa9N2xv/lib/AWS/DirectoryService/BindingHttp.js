import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { AWSEnvironment } from "../Environment.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS Directory Service HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two builders
 * below. Everything except the operation and the IAM action list is
 * boilerplate.
 */
/**
 * Build the impl Effect for an account-level Directory Service operation
 * (enumerating directories, reading account limits). The deploy-time half
 * grants `actions` on `*` — these actions do not support resource-level
 * permissions.
 */
export const makeDirectoryServiceAccountHttpBinding = (options) => Effect.gen(function* () {
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
 * Build the impl Effect for a Directory Service operation scoped to one
 * {@link Directory}: the deploy-time half grants `actions` on the bound
 * directory's ARN (`arn:aws:ds:{region}:{account}:directory/{id}`), and the
 * runtime half injects the directory's `DirectoryId` into every request.
 */
export const makeDirectoryHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (directory) {
        const DirectoryId = yield* directory.directoryId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const { accountId, region } = yield* AWSEnvironment.current;
                yield* host.bind `Allow(${host}, ${options.tag}(${directory}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [
                                Output.interpolate `arn:aws:ds:${region}:${accountId}:directory/${directory.directoryId}`,
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${directory.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                DirectoryId: yield* DirectoryId,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map