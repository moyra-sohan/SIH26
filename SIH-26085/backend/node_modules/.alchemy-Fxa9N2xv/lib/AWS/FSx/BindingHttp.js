import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the FSx runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, makeFSx…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation, the IAM action list, and
 * (for file-system-scoped operations) the injected file system id is
 * boilerplate.
 */
/**
 * Build the impl Effect for a file-system-scoped FSx operation: the runtime
 * callable injects the bound {@link FileSystem}'s id (as `FileSystemId`, or
 * as `FileSystemIds: [id]` for the describe operation) and the deploy-time
 * half grants `actions` on the file system's ARN.
 */
export const makeFSxFileSystemHttpBinding = (options) => Effect.gen(function* () {
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
                            Resource: [
                                Output.interpolate `${fileSystem.fileSystemArn}`,
                                ...(options.extraResourceArns ?? []),
                            ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${fileSystem.LogicalId})`)(function* (request) {
            const id = yield* FileSystemId;
            return yield* op({
                ...request,
                ...(options.requestKey === "FileSystemIds"
                    ? { FileSystemIds: [id] }
                    : { FileSystemId: id }),
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level FSx operation (no file-system
 * argument): the deploy-time half grants `actions` on `*`. Used for
 * operations that authorize against ARNs unknowable at deploy time (e.g.
 * backups, snapshots, and data repository tasks created at runtime) and for
 * account-wide describes.
 */
export const makeFSxAccountHttpBinding = (options) => Effect.gen(function* () {
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