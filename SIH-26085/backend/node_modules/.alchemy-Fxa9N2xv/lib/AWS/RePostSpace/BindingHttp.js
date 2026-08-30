import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for the re:Post Private runtime bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, makeRePostSpaceHttpBinding({ … }))` over the
 * builder below. Everything except the operation and the IAM action list is
 * boilerplate: every re:Post Private data-plane operation is scoped to a
 * space, so the runtime callable injects the bound {@link Space}'s `spaceId`
 * and the deploy-time half grants `actions` on the space's ARN (re:Post
 * Private has a single `space` IAM resource type — channel- and
 * admin-scoped actions are all authorized against the space ARN).
 */
export const makeRePostSpaceHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (space) {
        const spaceId = yield* space.spaceId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${space}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [space.spaceArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${space.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                spaceId: yield* spaceId,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map