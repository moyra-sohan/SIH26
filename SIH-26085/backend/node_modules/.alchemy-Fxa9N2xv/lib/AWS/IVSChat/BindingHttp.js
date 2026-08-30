import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for Amazon IVS Chat HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, makeIvsChatRoomHttpBinding({ … }))` over the builder
 * below. Everything except the operation, the IAM action list, and an
 * optional request-shape mapper is boilerplate.
 */
/**
 * Build the impl Effect for an IVS Chat data-plane operation scoped to a
 * {@link Room}: the deploy-time half grants `actions` on the bound room's
 * ARN, and the runtime half injects the room's ARN as the `roomIdentifier`
 * of every request.
 *
 * `prepare` (optional) maps a friendlier public request shape onto the wire
 * request — e.g. `CreateChatToken` converts a `Duration.Input` into the wire
 * `sessionDurationInMinutes`. It defaults to identity.
 */
export const makeIvsChatRoomHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (room) {
        // Output yields a DEFERRED effect — resolve again per invocation below.
        const RoomArn = yield* room.roomArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${room}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [room.roomArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${room.LogicalId})`)(function* (request) {
            const roomIdentifier = yield* RoomArn;
            const wire = options.prepare
                ? options.prepare(request)
                : request;
            return yield* op({ ...wire, roomIdentifier });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map