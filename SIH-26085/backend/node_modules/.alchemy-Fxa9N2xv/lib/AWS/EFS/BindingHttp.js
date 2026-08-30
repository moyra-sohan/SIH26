import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the EFS runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, makeEfs…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation, the IAM action list, and
 * (for file-system-scoped operations) the injected `FileSystemId` is
 * boilerplate.
 */
/**
 * Build the impl Effect for a file-system-scoped EFS operation: the runtime
 * callable injects the bound {@link FileSystem}'s ID as `FileSystemId` and
 * the deploy-time half grants `actions` on the file system's ARN.
 */
export const makeEfsFileSystemHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (fileSystem) {
        const FileSystemId = yield* fileSystem.fileSystemId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${fileSystem}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${fileSystem.fileSystemArn}`],
                        },
                        ...(options.wildcardActions !== undefined &&
                            options.wildcardActions.length > 0
                            ? [
                                {
                                    Effect: "Allow",
                                    Action: [...options.wildcardActions],
                                    Resource: ["*"],
                                },
                            ]
                            : []),
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${fileSystem.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                FileSystemId: yield* FileSystemId,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level EFS operation (no file-system
 * argument): the deploy-time half grants `actions` on `*`. Used for
 * operations that authorize against ARNs unknowable at deploy time (e.g.
 * `DeleteAccessPoint` authorizes on the access point's own ARN, and access
 * points deleted at runtime are typically created at runtime too).
 */
export const makeEfsAccountHttpBinding = (options) => Effect.gen(function* () {
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
//# sourceMappingURL=BindingHttp.js.map