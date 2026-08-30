import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { AWSEnvironment } from "../Environment.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Deploy-time half of an ApiGatewayV2 HTTP binding: resolves the host
 * Function, and registers an IAM policy statement for
 * `apigateway:{verb}` over the given API Gateway ARN paths. A no-op at
 * runtime (`__ALCHEMY_RUNTIME__`) and for non-Lambda hosts.
 *
 * @param cap fully-qualified capability name, e.g. `AWS.ApiGatewayV2.ExportApi`
 * @param target the bound resource — used for the binding's identity label
 * @param verb the API Gateway IAM verb the capability requires
 * @param paths builds the ARN path list once the deploy region is known;
 *        entries may be `Output`-derived (e.g. `Output.interpolate`)
 */
export const registerApiGatewayV2Binding = Effect.fn(function* (opts) {
    if (globalThis.__ALCHEMY_RUNTIME__)
        return;
    const host = yield* Binding.Host;
    if (!isBindingHost(host))
        return;
    const { region } = yield* AWSEnvironment.current;
    yield* host.bind `Allow(${host}, ${opts.cap}(${opts.target}))`({
        policyStatements: [
            {
                Effect: "Allow",
                Action: [`apigateway:${opts.verb}`],
                Resource: [...opts.paths(region)],
            },
        ],
    });
});
//# sourceMappingURL=BindingHttp.js.map