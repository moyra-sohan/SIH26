import * as ag from "@distilled.cloud/aws/api-gateway";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Output from "../../Output.js";
import { registerApiGatewayBinding } from "./BindingHttp.js";
import { DeleteUsagePlanKey, } from "./DeleteUsagePlanKey.js";
/**
 * HTTP implementation of the {@link DeleteUsagePlanKey} binding. Grants
 * `apigateway:DELETE` on the plan's per-key paths and calls the API with
 * the host Function's credentials.
 */
export const DeleteUsagePlanKeyHttp = Layer.effect(DeleteUsagePlanKey, Effect.gen(function* () {
    const deleteUsagePlanKey = yield* ag.deleteUsagePlanKey;
    return Effect.fn(function* (usagePlan) {
        const UsagePlanId = yield* usagePlan.id;
        yield* registerApiGatewayBinding({
            cap: "AWS.ApiGateway.DeleteUsagePlanKey",
            target: usagePlan,
            verb: "DELETE",
            paths: (region) => [
                Output.interpolate `arn:aws:apigateway:${region}::/usageplans/${usagePlan.id}/keys/*`,
            ],
        });
        return Effect.fn(`AWS.ApiGateway.DeleteUsagePlanKey(${usagePlan.LogicalId})`)(function* (request) {
            return yield* deleteUsagePlanKey({
                ...request,
                usagePlanId: yield* UsagePlanId,
            });
        });
    });
}));
//# sourceMappingURL=DeleteUsagePlanKeyHttp.js.map