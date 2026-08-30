import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as Namespace from "../../Namespace.js";
import { BucketEventSource as S3BucketEventSource, } from "../S3/BucketEventSource.js";
import * as Lambda from "./Function.js";
import { Permission as LambdaPermission } from "./Permission.js";
/**
 * Connects an S3 bucket notification stream to the current Lambda function.
 *
 * This layer listens for bucket notifications routed through the Lambda runtime
 * and exposes them as an `Effect.Stream`, while the companion policy configures
 * the invoke permission and bucket notification binding during deployment.
 * ### Wiring Events
 * **Example:** Listen for Object Created Events
 * ```typescript
 * yield* AWS.Lambda.BucketEventSource(
 *   bucket,
 *   { events: ["s3:ObjectCreated:*"] },
 *   (events) => Stream.runForEach(events, (event) => Effect.log(event.key)),
 * );
 * ```
 *
 * @binding
 */
export const BucketEventSource = Layer.effect(S3BucketEventSource, Effect.gen(function* () {
    // this layer can only be used in a Lambda Function
    const func = yield* Lambda.Function;
    const Permission = yield* LambdaPermission;
    return Effect.fn(function* (bucket, props, process) {
        // this adds it to the Lambda Function's environment variables
        const BucketName = yield* bucket.bucketName;
        // Deploy-time: grant the invoke permission and attach the bucket
        // notification config. Skipped once running inside the deployed Function
        // (the global guard), where the only work is registering the runtime
        // handler below. Namespaced under the host so the sub-resources' logical
        // identity matches the previous Binding.Policy.
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            yield* Namespace.push(func.LogicalId, Effect.gen(function* () {
                const { events: Events = ["s3:ObjectCreated:*"], prefix, suffix, } = props ?? {};
                const filterRules = [
                    ...(prefix !== undefined
                        ? [{ Name: "prefix", Value: prefix }]
                        : []),
                    ...(suffix !== undefined
                        ? [{ Name: "suffix", Value: suffix }]
                        : []),
                ];
                yield* Permission(`AWS.Lambda.InvokeFunction(${bucket.LogicalId})`, {
                    action: "lambda:InvokeFunction",
                    functionName: func.functionName,
                    principal: "s3.amazonaws.com",
                    sourceArn: bucket.bucketArn,
                });
                yield* bucket.bind(`AWS.S3.Notifications(${bucket.LogicalId})`, {
                    notificationConfiguration: {
                        LambdaFunctionConfigurations: [
                            {
                                LambdaFunctionArn: func.functionArn,
                                Events,
                                ...(filterRules.length > 0
                                    ? { Filter: { Key: { FilterRules: filterRules } } }
                                    : {}),
                            },
                        ],
                    },
                });
            }));
        }
        yield* func.listen(Effect.gen(function* () {
            // this accesses it
            const bucketName = yield* BucketName;
            return (event) => {
                if (isS3Event(event)) {
                    const events = event.Records.filter((record) => record.s3.bucket.name === bucketName);
                    if (events.length > 0) {
                        return process(Stream.fromArray(events.map((record) => ({
                            type: record.eventName,
                            bucket: record.s3.bucket.name,
                            key: record.s3.object.key,
                            size: record.s3.object.size,
                            eTag: record.s3.object.eTag,
                        })))).pipe(Effect.orDie);
                    }
                }
            };
        }));
    });
}));
const isS3Event = (event) => Array.isArray(event.Records) &&
    event.Records.some((record) => record.s3);
//# sourceMappingURL=BucketEventSource.js.map