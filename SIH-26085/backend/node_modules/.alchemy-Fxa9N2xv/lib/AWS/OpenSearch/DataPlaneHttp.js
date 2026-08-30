/**
 * Shared scaffolding for the OpenSearch domain data-plane bindings.
 *
 * An OpenSearch domain serves its search/index REST API under the domain's
 * `endpoint`, authorized by the IAM method actions (`es:ESHttpGet`,
 * `es:ESHttpPut`, …). There is no distilled operation for these — every
 * request is a SigV4-signed HTTP call (service `"es"`) made with the host
 * Function's own credentials.
 *
 * NOT exported from `index.ts` — only the per-capability contracts
 * (`DomainRead` / `DomainWrite` / `DomainReadWrite`) and their `*Http`
 * layers are public.
 */
import * as Credentials from "@distilled.cloud/aws/Credentials";
import * as Region from "@distilled.cloud/aws/Region";
import { AwsV4Signer } from "aws4fetch";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
import { OpenSearchApiError } from "./DataPlaneTypes.js";
const refreshParam = (refresh) => refresh === undefined ? {} : { refresh: String(refresh) };
/**
 * Build the shared body of an OpenSearch data-plane `*Http` binding layer:
 * resolve the ambient distilled `Credentials`/`Region` context once at layer
 * construction, register the least-privilege IAM statement on the host
 * Function at deploy time (`iamActions` on the domain and `domain/*`), and
 * hand a signed-request `send` function to the capability-specific
 * `makeClient`.
 */
export const makeOpenSearchDataPlaneBinding = (options) => Effect.gen(function* () {
    const services = yield* Effect.context();
    return Effect.fn(function* (domain) {
        const Endpoint = yield* domain.endpoint;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.OpenSearch.${options.name}(${domain}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: options.iamActions,
                            Resource: [
                                domain.domainArn,
                                Output.interpolate `${domain.domainArn}/*`,
                            ],
                        },
                    ],
                });
            }
        }
        const send = Effect.fn(`AWS.OpenSearch.${options.name}(${domain.LogicalId})`)(function* (request) {
            const endpoint = yield* Endpoint;
            if (endpoint === undefined) {
                return yield* Effect.fail(new OpenSearchApiError({
                    method: request.method,
                    path: request.path,
                    status: 0,
                    body: "domain has no endpoint (still provisioning, or VPC-only)",
                }));
            }
            const url = new URL(request.path.replace(/^\//, ""), `https://${endpoint.replace(/^https?:\/\//, "")}/`);
            for (const [key, value] of Object.entries(request.query ?? {})) {
                if (value !== undefined)
                    url.searchParams.set(key, value);
            }
            const headers = {};
            let body;
            if (request.json !== undefined) {
                body = JSON.stringify(request.json);
                headers["content-type"] = "application/json";
            }
            else if (request.ndjson !== undefined) {
                body = request.ndjson;
                headers["content-type"] = "application/x-ndjson";
            }
            // Resolve credentials fresh per request (SSO/STS sessions rotate) and
            // sign for the domain's own region, parsed from its endpoint.
            const { credentials, region } = yield* Effect.gen(function* () {
                const credentials = yield* yield* Credentials.Credentials;
                const region = /\.([a-z0-9-]+)\.(?:es|aos)\.amazonaws\.com$/.exec(url.hostname)?.[1] ?? (yield* yield* Region.Region);
                return { credentials, region };
            }).pipe(Effect.provideContext(services));
            const signer = new AwsV4Signer({
                method: request.method,
                url: url.toString(),
                headers,
                body,
                accessKeyId: Redacted.value(credentials.accessKeyId),
                secretAccessKey: Redacted.value(credentials.secretAccessKey),
                sessionToken: credentials.sessionToken
                    ? Redacted.value(credentials.sessionToken)
                    : undefined,
                service: "es",
                region,
                allHeaders: true,
            });
            const signed = yield* Effect.promise(() => signer.sign());
            const toError = (status) => (cause) => new OpenSearchApiError({
                method: request.method,
                path: request.path,
                status,
                body: cause instanceof Error ? cause.message : String(cause),
            });
            const response = yield* Effect.tryPromise({
                try: () => fetch(signed.url.toString(), {
                    method: signed.method,
                    headers: signed.headers,
                    body: signed.body,
                }),
                catch: toError(0),
            });
            const text = yield* Effect.tryPromise({
                try: () => response.text(),
                catch: toError(response.status),
            });
            const ok = (response.status >= 200 && response.status < 300) ||
                (request.allowStatuses?.includes(response.status) ?? false);
            if (!ok) {
                return yield* Effect.fail(new OpenSearchApiError({
                    method: request.method,
                    path: request.path,
                    status: response.status,
                    body: text,
                }));
            }
            if (text.trim() === "") {
                return { status: response.status, body: undefined };
            }
            const parsed = yield* Effect.try({
                try: () => JSON.parse(text),
                catch: toError(response.status),
            });
            return { status: response.status, body: parsed };
        });
        return options.makeClient(send);
    });
});
const encodePath = (...segments) => segments.map((segment) => encodeURIComponent(segment)).join("/");
/** Build the read half of the domain data-plane client. */
export const makeReadDomainClient = (send) => ({
    search: (request) => send({
        method: "GET",
        path: request?.index !== undefined
            ? `${encodeURIComponent(request.index)}/_search`
            : "_search",
        query: {
            ...request?.query,
            // The Query-DSL body travels in the `source` parameter so searches
            // stay on es:ESHttpGet (POST would require the write IAM action).
            ...(request?.body !== undefined
                ? {
                    source: JSON.stringify(request.body),
                    source_content_type: "application/json",
                }
                : {}),
        },
    }).pipe(Effect.map(({ body }) => body)),
    count: (request) => send({
        method: "GET",
        path: request?.index !== undefined
            ? `${encodeURIComponent(request.index)}/_count`
            : "_count",
        query: request?.body !== undefined
            ? {
                source: JSON.stringify(request.body),
                source_content_type: "application/json",
            }
            : undefined,
    }).pipe(Effect.map(({ body }) => body)),
    getDocument: (index, id) => send({
        method: "GET",
        path: encodePath(index, "_doc", id),
        allowStatuses: [404],
    }).pipe(Effect.map(({ body }) => body)),
    existsDocument: (index, id) => send({
        method: "HEAD",
        path: encodePath(index, "_doc", id),
        allowStatuses: [404],
    }).pipe(Effect.map(({ status }) => status === 200)),
    get: (path, query) => send({ method: "GET", path, query }).pipe(Effect.map(({ body }) => body)),
});
/** Build the write half of the domain data-plane client. */
export const makeWriteDomainClient = (send) => ({
    indexDocument: (index, document, options) => send(options?.id !== undefined
        ? {
            method: "PUT",
            path: encodePath(index, "_doc", options.id),
            json: document,
            query: refreshParam(options.refresh),
        }
        : {
            method: "POST",
            path: encodePath(index, "_doc"),
            json: document,
            query: refreshParam(options?.refresh),
        }).pipe(Effect.map(({ body }) => body)),
    updateDocument: (index, id, body, options) => send({
        method: "POST",
        path: encodePath(index, "_update", id),
        json: body,
        query: refreshParam(options?.refresh),
    }).pipe(Effect.map(({ body }) => body)),
    deleteDocument: (index, id, options) => send({
        method: "DELETE",
        path: encodePath(index, "_doc", id),
        query: refreshParam(options?.refresh),
        allowStatuses: [404],
    }).pipe(Effect.map(({ body }) => body)),
    bulk: (operations, options) => send({
        method: "POST",
        path: "_bulk",
        ndjson: `${operations.map((line) => JSON.stringify(line)).join("\n")}\n`,
        query: refreshParam(options?.refresh),
    }).pipe(Effect.map(({ body }) => body)),
});
//# sourceMappingURL=DataPlaneHttp.js.map