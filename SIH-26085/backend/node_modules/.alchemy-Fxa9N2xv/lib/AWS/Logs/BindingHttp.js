import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for CloudWatch Logs HTTP bindings.
 *
 * NOT exported from `index.ts` — every single-operation `{Op}Http.ts` in this
 * service is a thin `Layer.effect(Cap, makeLogGroupHttpBinding({ … }))` over
 * this builder. Everything except the operation, the IAM action(s), and the
 * IAM resource shape is boilerplate:
 *
 * - the deploy-time half registers `Allow(host, tag(logGroup))` with the
 *   requested actions on the bound group's ARN (and/or its `:*` log-stream
 *   wildcard, per `iamResources`);
 * - the runtime callable injects the resolved `logGroupName` into the request
 *   (unless `injectLogGroupName: false` — for query-id / record-pointer
 *   scoped operations like `GetQueryResults`, `StopQuery`, `GetLogRecord`).
 *
 * Genuinely-different bindings stay bespoke: `LogEventSink` (a batching sink
 * over the `PutLogEvents` capability).
 */
export const makeLogGroupHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    const inject = options.injectLogGroupName ?? true;
    return Effect.fn(function* (logGroup) {
        const LogGroupName = yield* logGroup.logGroupName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${logGroup}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.iamResources === "all"
                                ? ["*"]
                                : options.iamResources === "streams"
                                    ? [Output.interpolate `${logGroup.logGroupArn}:*`]
                                    : [
                                        logGroup.logGroupArn,
                                        Output.interpolate `${logGroup.logGroupArn}:*`,
                                    ],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${logGroup.LogicalId})`)(function* (request) {
            const input = { ...request };
            if (inject) {
                input.logGroupName = yield* LogGroupName;
            }
            return yield* op(input);
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map