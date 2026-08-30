import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for BackupSearch HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, makeSearchJobScopedHttpBinding({ … }))` over the
 * builder below. Everything except the operation and the IAM action list is
 * boilerplate.
 *
 * BackupSearch IAM actions live under the `backup-search:` service prefix.
 */
/**
 * Build the impl Effect for a search-job-scoped operation: the runtime
 * callable injects the bound {@link SearchJob}'s identifier as
 * `SearchJobIdentifier` and the deploy-time half grants `actions` on the
 * search job ARN.
 */
export const makeSearchJobScopedHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (searchJob) {
        const SearchJobIdentifier = yield* searchJob.searchJobIdentifier;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${searchJob}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${searchJob.searchJobArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${searchJob.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                SearchJobIdentifier: yield* SearchJobIdentifier,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map