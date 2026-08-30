import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the implementation effect for a bot-alias-scoped Lex V2 runtime
 * capability: `Layer.effect(Cap, makeLexAliasHttpBinding({ ... }))`.
 *
 * The runtime callable injects the bound alias's `botId` and `botAliasId`,
 * so `Req` is the operation's request type without those fields.
 */
export const makeLexAliasHttpBinding = (config) => Effect.gen(function* () {
    const op = yield* config.operation;
    return Effect.fn(function* (alias) {
        const BotId = yield* alias.botId;
        const BotAliasId = yield* alias.botAliasId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.LexV2.${config.capability}(${alias}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...config.iamActions],
                            Resource: [alias.botAliasArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.LexV2.${config.capability}(${alias.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                botId: yield* BotId,
                botAliasId: yield* BotAliasId,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map