import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS S3 HTTP bindings.
 *
 * NOT exported from `index.ts` — every single-operation `{Op}Http.ts` in this
 * service is a thin `Layer.effect(Cap, makeBucketHttpBinding({ … }))` over
 * this builder. Everything except the operation, the IAM action(s), and the
 * IAM resource shape is boilerplate:
 *
 * - the deploy-time half registers `Allow(host, tag(bucket))` with the
 *   requested actions on the bound bucket (object-level `${arn}/*` or the
 *   bucket ARN itself, per `iamResources`);
 * - the runtime callable injects the resolved bucket name as `Bucket`.
 *
 * Genuinely-different bindings stay bespoke: `PresignGetObject` /
 * `PresignPutObject` (SigV4 presigners, not API operations).
 */
export const makeBucketHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (bucket) {
        const BucketName = yield* bucket.bucketName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${bucket}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.iamResources === "bucket"
                                ? [bucket.bucketArn]
                                : [Output.interpolate `${bucket.bucketArn}/*`],
                        },
                        ...(options.listBucket
                            ? [
                                {
                                    Effect: "Allow",
                                    Action: ["s3:ListBucket"],
                                    Resource: [bucket.bucketArn],
                                },
                            ]
                            : []),
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${bucket.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                Bucket: yield* BucketName,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map