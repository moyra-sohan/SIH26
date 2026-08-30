import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for SES Mail Manager HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the injected identifier, and the
 * IAM action list is boilerplate.
 */
const registerHostPolicy = Effect.fn(function* (tag, resource, arn, actions) {
    if (!globalThis.__ALCHEMY_RUNTIME__) {
        const host = yield* Binding.Host;
        if (isBindingHost(host)) {
            yield* host.bind `Allow(${host}, ${tag}(${resource}))`({
                policyStatements: [
                    {
                        Effect: "Allow",
                        Action: [...actions],
                        Resource: [arn],
                    },
                ],
            });
        }
    }
});
/**
 * Build the impl Effect for a Mail Manager operation scoped to an
 * {@link AddressList} whose request carries `AddressListId`: the deploy-time
 * half grants `actions` on the bound list's ARN, and the runtime half
 * injects the list's id into every request.
 */
export const makeAddressListHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (list) {
        const AddressListId = yield* list.addressListId;
        yield* registerHostPolicy(options.tag, list, list.addressListArn, options.actions);
        return Effect.fn(`${options.tag}(${list.LogicalId})`)(function* (request) {
            const addressListId = yield* AddressListId;
            return yield* op({ ...request, AddressListId: addressListId });
        });
    });
});
/**
 * Build the impl Effect for a Mail Manager import-job operation scoped to an
 * {@link AddressList} but keyed by `JobId` (the id of a job created against
 * that list): the deploy-time half grants `actions` on the bound list's ARN;
 * the runtime half passes the caller's request through unchanged.
 */
export const makeAddressListJobHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (list) {
        yield* registerHostPolicy(options.tag, list, list.addressListArn, options.actions);
        return Effect.fn(`${options.tag}(${list.LogicalId})`)(function* (request) {
            return yield* op(request);
        });
    });
});
/**
 * Build the impl Effect for a Mail Manager operation scoped to an
 * {@link Archive} whose request carries `ArchiveId`: the deploy-time half
 * grants `actions` on the bound archive's ARN, and the runtime half injects
 * the archive's id into every request.
 */
export const makeArchiveHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (archive) {
        const ArchiveId = yield* archive.archiveId;
        yield* registerHostPolicy(options.tag, archive, archive.archiveArn, options.actions);
        return Effect.fn(`${options.tag}(${archive.LogicalId})`)(function* (request) {
            const archiveId = yield* ArchiveId;
            return yield* op({ ...request, ArchiveId: archiveId });
        });
    });
});
/**
 * Build the impl Effect for a Mail Manager operation scoped to an
 * {@link Archive} but keyed by a task id (`SearchId`, `ExportId`,
 * `ArchivedMessageId`): the deploy-time half grants `actions` on the bound
 * archive's ARN; the runtime half passes the caller's request through
 * unchanged.
 */
export const makeArchiveTaskHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (archive) {
        yield* registerHostPolicy(options.tag, archive, archive.archiveArn, options.actions);
        return Effect.fn(`${options.tag}(${archive.LogicalId})`)(function* (request) {
            return yield* op(request);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map