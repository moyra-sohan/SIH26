/**
 * Shared scaffolding for Amazon OpenSearch Ingestion (OSIS) HTTP bindings.
 *
 * NOT exported from `index.ts` — every thin `{Op}Http.ts` in this service is
 * a `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation, the injected identifier, and the
 * IAM action list is boilerplate:
 *
 * - Pipeline-scoped operations (`osis:GetPipeline`, `osis:StartPipeline`,
 *   `osis:StopPipeline`, …) inject the bound {@link Pipeline}'s name or ARN
 *   into the request and are granted on the pipeline ARN.
 * - Account-level operations (`osis:ValidatePipeline`,
 *   `osis:ListPipelineBlueprints`, …) take the caller's request as-is and
 *   are granted on `*` — they are not scoped to a single pipeline resource.
 * - The `osis:Ingest` data plane has no distilled operation — it is a
 *   SigV4-signed HTTP POST (service `"osis"`) against the pipeline's ingest
 *   endpoint, made with the host Function's own credentials.
 */
import * as Credentials from "@distilled.cloud/aws/Credentials";
import * as Region from "@distilled.cloud/aws/Region";
import { AwsV4Signer } from "aws4fetch";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the impl Effect for an OSIS operation scoped to a {@link Pipeline}:
 * the deploy-time half grants `actions` on the bound pipeline's ARN, and the
 * runtime half injects the pipeline's identifier (name or ARN) as
 * `requestKey` into every request.
 */
export const makeOsisPipelineHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (pipeline) {
        const Identifier = yield* options.identifier(pipeline);
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${pipeline}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [pipeline.pipelineArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${pipeline.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                [options.requestKey]: yield* Identifier,
            });
        });
    });
});
/**
 * Build the impl Effect for an account-level OSIS operation (config
 * validation, blueprint catalog reads, endpoint-connection listing). The
 * deploy-time half grants `actions` on `*` — these operations are not scoped
 * to a single pipeline resource.
 */
export const makeOsisAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(options.tag)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
/**
 * A failed `osis:Ingest` request against a pipeline's ingest endpoint —
 * carries the HTTP status and response body returned by Data Prepper.
 */
export class PipelineIngestError extends Data.TaggedError("OsisPipelineIngestError") {
}
/**
 * Build the impl Effect for the `osis:Ingest` data plane: the deploy-time
 * half grants `osis:Ingest` on the bound pipeline's ARN, and the runtime half
 * signs (SigV4, service `"osis"`) and POSTs each batch of events to the
 * pipeline's ingest endpoint with the host Function's own credentials.
 */
export const makeOsisIngestBinding = Effect.gen(function* () {
    const services = yield* Effect.context();
    return Effect.fn(function* (pipeline) {
        const PipelineName = yield* pipeline.pipelineName;
        const IngestEndpointUrls = yield* pipeline.ingestEndpointUrls;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.OSIS.Ingest(${pipeline}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: ["osis:Ingest"],
                            Resource: [pipeline.pipelineArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.OSIS.Ingest(${pipeline.LogicalId})`)(function* (request) {
            const pipelineName = yield* PipelineName;
            const endpoints = yield* IngestEndpointUrls;
            const endpoint = endpoints?.[0];
            const fail = (status, body) => Effect.fail(new PipelineIngestError({
                pipelineName,
                path: request.path,
                status,
                body,
            }));
            if (endpoint === undefined) {
                return yield* fail(0, "pipeline has no ingestEndpointUrls");
            }
            // Ingest endpoint URLs are bare hostnames
            // (`{name}-{id}.{region}.osis.amazonaws.com`); sign for the endpoint's
            // own region, parsed from the hostname.
            const base = endpoint.startsWith("https://")
                ? endpoint
                : `https://${endpoint}`;
            const url = new URL(request.path.startsWith("/") ? request.path : `/${request.path}`, base);
            // Resolve credentials fresh per request (STS sessions rotate).
            const { credentials, region } = yield* Effect.gen(function* () {
                const credentials = yield* yield* Credentials.Credentials;
                const region = /\.([a-z0-9-]+)\.osis\.amazonaws\.com$/.exec(url.hostname)?.[1] ??
                    (yield* yield* Region.Region);
                return { credentials, region };
            }).pipe(Effect.provideContext(services));
            const signer = new AwsV4Signer({
                method: "POST",
                url: url.toString(),
                headers: { "content-type": "application/json" },
                body: JSON.stringify(request.events),
                accessKeyId: Redacted.value(credentials.accessKeyId),
                secretAccessKey: Redacted.value(credentials.secretAccessKey),
                sessionToken: credentials.sessionToken
                    ? Redacted.value(credentials.sessionToken)
                    : undefined,
                service: "osis",
                region,
                allHeaders: true,
            });
            const signed = yield* Effect.promise(() => signer.sign());
            const response = yield* Effect.tryPromise({
                try: () => fetch(signed.url.toString(), {
                    method: signed.method,
                    headers: signed.headers,
                    body: signed.body,
                }),
                catch: (cause) => new PipelineIngestError({
                    pipelineName,
                    path: request.path,
                    status: 0,
                    body: cause instanceof Error ? cause.message : String(cause),
                }),
            });
            const text = yield* Effect.tryPromise({
                try: () => response.text(),
                catch: (cause) => new PipelineIngestError({
                    pipelineName,
                    path: request.path,
                    status: response.status,
                    body: cause instanceof Error ? cause.message : String(cause),
                }),
            });
            if (response.status < 200 || response.status >= 300) {
                return yield* fail(response.status, text);
            }
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map