import * as ag from "@distilled.cloud/aws/api-gateway";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { registerApiGatewayBinding } from "./BindingHttp.js";
import { DeleteApiKey } from "./DeleteApiKey.js";
/**
 * HTTP implementation of the {@link DeleteApiKey} binding. Grants
 * `apigateway:DELETE` on `/apikeys/*` and calls the API with the host
 * Function's credentials.
 */
export const DeleteApiKeyHttp = Layer.effect(DeleteApiKey, Effect.gen(function* () {
    const deleteApiKey = yield* ag.deleteApiKey;
    return Effect.fn(function* () {
        yield* registerApiGatewayBinding({
            cap: "AWS.ApiGateway.DeleteApiKey",
            target: "",
            verb: "DELETE",
            paths: (region) => [`arn:aws:apigateway:${region}::/apikeys/*`],
        });
        return Effect.fn("AWS.ApiGateway.DeleteApiKey")(function* (request) {
            return yield* deleteApiKey(request);
        });
    });
}));
//# sourceMappingURL=DeleteApiKeyHttp.js.map