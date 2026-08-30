import * as Data from "effect/Data";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import { PrismaEnvironment } from "./PrismaEnvironment.js";
export class PrismaApiError extends Data.TaggedError("PrismaApiError") {
}
export class PrismaApiDecodeError extends Data.TaggedError("PrismaApiDecodeError") {
}
export class PrismaClient extends Context.Service()("Prisma::PrismaClient") {
}
export const isNotFound = (error) => error instanceof PrismaApiError && error.status === 404;
export const isConflict = (error) => error instanceof PrismaApiError && error.status === 409;
const redactedString = (value) => typeof value === "string" ? Redacted.make(value) : undefined;
const decodeUrlComponent = (value) => {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
};
export const extractConnectionSecrets = (connection) => {
    if (!connection)
        return {};
    const withSecrets = connection;
    const direct = withSecrets.endpoints?.direct?.connectionString;
    const pooled = withSecrets.endpoints?.pooled?.connectionString;
    const accelerate = withSecrets.endpoints?.accelerate?.connectionString;
    const directUrl = (() => {
        if (!direct)
            return undefined;
        try {
            return new URL(direct);
        }
        catch {
            return undefined;
        }
    })();
    return {
        directConnectionString: redactedString(direct),
        pooledConnectionString: redactedString(pooled),
        accelerateConnectionString: redactedString(accelerate),
        host: directUrl?.hostname ?? withSecrets.endpoints?.direct?.host ?? null,
        user: directUrl?.username ? decodeUrlComponent(directUrl.username) : null,
        password: directUrl?.password
            ? redactedString(decodeUrlComponent(directUrl.password))
            : undefined,
    };
};
export const requestBody = (response) => response.data;
const isRetryableStatus = (status) => status === 0 || status === 408 || status === 429 || status >= 500;
const REQUEST_AND_BODY_TIMEOUT = "10 seconds";
const MAX_SUCCESS_BODY_BYTES = 4 * 1024 * 1024;
const MAX_ERROR_BODY_BYTES = 64 * 1024;
const MAX_PAGINATION_PAGES = 1_000;
const MAX_PAGINATION_ITEMS = 100_000;
const MAX_PAGINATION_BODY_BYTES = 64 * 1024 * 1024;
const PAGINATION_TIMEOUT = "2 minutes";
const ROLLBACK_REQUEST_TIMEOUT = "30 seconds";
const PROVISIONING_REQUEST_TIMEOUT = "2 minutes";
const INVALID_PATH_SEGMENT = "__alchemy_invalid_prisma_path_segment__";
const pathSegment = (value) => {
    if (value.length === 0 ||
        value === "." ||
        value === ".." ||
        value === INVALID_PATH_SEGMENT ||
        /[\\/?#%]/.test(value) ||
        value.includes("\0")) {
        return INVALID_PATH_SEGMENT;
    }
    try {
        return encodeURIComponent(value);
    }
    catch {
        return INVALID_PATH_SEGMENT;
    }
};
const isRetryablePost = (path) => path.endsWith("/start") ||
    path.endsWith("/stop") ||
    path.endsWith("/promote") ||
    path.endsWith("/rollback");
const isRetryableRequest = (method, path) => method === "GET" ||
    method === "DELETE" ||
    method === "PATCH" ||
    (method === "POST" && isRetryablePost(path));
const retryTransient = (method, path, effect) => effect.pipe(Effect.retry({
    while: (e) => e instanceof PrismaApiError &&
        isRetryableRequest(method, path) &&
        isRetryableStatus(e.status),
    schedule: Schedule.max([
        Schedule.exponential("100 millis"),
        Schedule.recurs(4),
    ]),
}));
function makePrismaClient() {
    return Effect.gen(function* () {
        const env = yield* PrismaEnvironment;
        const http = yield* HttpClient.HttpClient;
        function isValidApiPath(path) {
            if ((path !== "/v1" && !path.startsWith("/v1/")) ||
                path.startsWith("//") ||
                path.includes("\\") ||
                path.includes("?") ||
                path.includes("#") ||
                path.includes(INVALID_PATH_SEGMENT)) {
                return false;
            }
            try {
                const base = new URL(env.baseUrl);
                const resolved = new URL(path, base);
                return (resolved.origin === base.origin &&
                    (resolved.pathname === "/v1" || resolved.pathname.startsWith("/v1/")));
            }
            catch {
                return false;
            }
        }
        const buildUrl = (path, query) => {
            if (!isValidApiPath(path)) {
                return Effect.fail(new PrismaApiError({
                    method: "GET",
                    path,
                    status: 0,
                    message: "Refused an invalid Prisma Management API path parameter",
                }));
            }
            return Effect.sync(() => {
                const url = new URL(path, env.baseUrl);
                for (const [key, value] of Object.entries(query ?? {})) {
                    if (value === undefined || value === null)
                        continue;
                    if (Array.isArray(value)) {
                        for (const item of value) {
                            url.searchParams.append(key, String(item));
                        }
                    }
                    else {
                        url.searchParams.set(key, String(value));
                    }
                }
                return url.toString();
            });
        };
        const buildWebSocketUrl = (path, query) => buildUrl(path, query).pipe(Effect.map((value) => {
            const url = new URL(value);
            if (url.protocol === "https:")
                url.protocol = "wss:";
            if (url.protocol === "http:")
                url.protocol = "ws:";
            return url.toString();
        }));
        const logsQuery = (query) => {
            if (!query)
                return undefined;
            const { fromStart, ...rest } = query;
            return {
                ...rest,
                from_start: fromStart === undefined ? undefined : String(fromStart),
            };
        };
        const makeRequest = (method, url, options) => {
            const init = method === "GET"
                ? HttpClientRequest.get(url)
                : method === "POST"
                    ? HttpClientRequest.post(url)
                    : method === "PATCH"
                        ? HttpClientRequest.patch(url)
                        : HttpClientRequest.delete(url);
            const request = init.pipe(HttpClientRequest.bearerToken(Redacted.value(env.serviceToken)), HttpClientRequest.setHeaders({
                Accept: "application/json",
                "User-Agent": "alchemy-prisma/1.0",
                ...options?.headers,
            }));
            return options?.body === undefined
                ? request
                : request.pipe(HttpClientRequest.bodyJsonUnsafe(options.body));
        };
        const requestWithStatus = (method, path, options) => {
            if (!isValidApiPath(path)) {
                return Effect.fail(new PrismaApiError({
                    method,
                    path,
                    status: 0,
                    message: "Refused an invalid Prisma Management API path or path parameter outside the configured /v1 origin",
                }));
            }
            return retryTransient(method, path, Effect.gen(function* () {
                const url = yield* buildUrl(path, options?.query);
                const req = makeRequest(method, url, options);
                const response = Effect.gen(function* () {
                    const res = yield* http.execute(req).pipe(Effect.mapError((e) => new PrismaApiError({
                        method,
                        path,
                        status: 0,
                        message: e instanceof Error ? e.message : String(e),
                    })));
                    const maxBodyBytes = res.status >= 200 && res.status < 300
                        ? MAX_SUCCESS_BODY_BYTES
                        : MAX_ERROR_BODY_BYTES;
                    const bodyTooLarge = (bodyLength) => res.status >= 200 && res.status < 300
                        ? new PrismaApiDecodeError({
                            method,
                            path,
                            bodyLength,
                            message: `Prisma Management API response exceeded the ${maxBodyBytes} byte safety limit`,
                        })
                        : new PrismaApiError({
                            method,
                            path,
                            status: res.status,
                            message: `Prisma Management API error response exceeded the ${maxBodyBytes} byte safety limit`,
                        });
                    const declaredLength = Number(res.headers["content-length"]);
                    if (Number.isSafeInteger(declaredLength) &&
                        declaredLength > maxBodyBytes) {
                        return yield* bodyTooLarge(declaredLength);
                    }
                    const collected = yield* Stream.runFoldEffect(res.stream, () => ({ chunks: [], bytes: 0 }), (state, chunk) => {
                        const bytes = state.bytes + chunk.byteLength;
                        if (bytes > maxBodyBytes) {
                            return Effect.fail(bodyTooLarge(bytes));
                        }
                        state.chunks.push(chunk);
                        state.bytes = bytes;
                        return Effect.succeed(state);
                    }).pipe(Effect.catch((error) => {
                        if (error instanceof PrismaApiError ||
                            error instanceof PrismaApiDecodeError) {
                            return Effect.fail(error);
                        }
                        if (HttpClientError.isHttpClientError(error) &&
                            error.reason._tag === "EmptyBodyError") {
                            return Effect.succeed({
                                chunks: [],
                                bytes: 0,
                            });
                        }
                        return Effect.fail(new PrismaApiError({
                            method,
                            path,
                            status: 0,
                            message: `Failed to read Prisma Management API response: ${error instanceof Error ? error.message : String(error)}`,
                        }));
                    }));
                    const bytes = new Uint8Array(collected.bytes);
                    let offset = 0;
                    for (const chunk of collected.chunks) {
                        bytes.set(chunk, offset);
                        offset += chunk.byteLength;
                    }
                    const text = new TextDecoder().decode(bytes);
                    return { status: res.status, text, bodyLength: collected.bytes };
                });
                const { status, text, bodyLength } = yield* response;
                if (status < 200 || status >= 300) {
                    return yield* new PrismaApiError({
                        method,
                        path,
                        status,
                        message: formatErrorMessage(status, text),
                        body: text.length === 0 ? undefined : Redacted.make(text),
                    });
                }
                if (options?.onSuccessfulBodyLength !== undefined) {
                    yield* options.onSuccessfulBodyLength(bodyLength);
                }
                if (status === 204 || text.length === 0) {
                    return { status, body: undefined };
                }
                const body = yield* Effect.try({
                    try: () => JSON.parse(text),
                    catch: () => new PrismaApiDecodeError({
                        method,
                        path,
                        bodyLength: new TextEncoder().encode(text).byteLength,
                        message: "Prisma Management API returned invalid JSON",
                    }),
                });
                return { status, body };
            })).pipe(
            // The deadline covers the complete operation, including transient
            // retries and streaming the response body. A per-attempt timeout would
            // multiply the advertised deadline and can leave a hung peer tying up
            // a deployment for every retry slot.
            Effect.timeoutOrElse({
                duration: options?.timeout ?? REQUEST_AND_BODY_TIMEOUT,
                orElse: () => Effect.fail(new PrismaApiError({
                    method,
                    path,
                    status: 0,
                    message: options?.timeout === undefined
                        ? `Prisma Management API request timed out after ${REQUEST_AND_BODY_TIMEOUT}`
                        : "Prisma Management API request timed out at the operation-specific deadline",
                })),
            }));
        };
        const request = (method, path, options) => requestWithStatus(method, path, options).pipe(Effect.map(({ body }) => body));
        const dataWithStatus = (method, path, options) => requestWithStatus(method, path, options).pipe(Effect.flatMap(({ status, body: response }) => response !== null &&
            typeof response === "object" &&
            Object.hasOwn(response, "data")
            ? Effect.succeed({
                status,
                data: requestBody(response),
            })
            : Effect.fail(new PrismaApiDecodeError({
                method,
                path,
                bodyLength: 0,
                message: "Prisma Management API response did not contain a data envelope",
            }))));
        const data = (method, path, options) => dataWithStatus(method, path, options).pipe(Effect.map(({ data }) => data));
        const list = (path, query, onSuccessfulBodyLength) => request("GET", path, {
            query,
            onSuccessfulBodyLength,
        });
        const paginate = (path, query) => Effect.suspend(() => {
            let observedPages = 0;
            let observedItems = 0;
            let observedBodyBytes = 0;
            let observedCursor = false;
            return Effect.gen(function* () {
                const items = [];
                const queryRecord = query;
                let cursor = typeof queryRecord?.cursor === "string"
                    ? queryRecord.cursor
                    : undefined;
                const seenCursors = new Set();
                if (cursor !== undefined)
                    seenCursors.add(cursor);
                observedCursor = cursor !== undefined;
                const protocolError = (message) => new PrismaApiDecodeError({
                    method: "GET",
                    path,
                    bodyLength: 0,
                    message: `Invalid Prisma Management API pagination response: ${message}`,
                });
                const accountForBody = (bodyLength) => {
                    const aggregateBodyLength = observedBodyBytes + bodyLength;
                    if (aggregateBodyLength > MAX_PAGINATION_BODY_BYTES) {
                        return Effect.fail(new PrismaApiDecodeError({
                            method: "GET",
                            path,
                            bodyLength: aggregateBodyLength,
                            message: `Invalid Prisma Management API pagination response: exceeded the ${MAX_PAGINATION_BODY_BYTES} aggregate response byte safety limit`,
                        }));
                    }
                    observedBodyBytes = aggregateBodyLength;
                    return Effect.void;
                };
                while (true) {
                    if (observedPages >= MAX_PAGINATION_PAGES) {
                        return yield* protocolError(`exceeded the ${MAX_PAGINATION_PAGES} page safety limit`);
                    }
                    const page = yield* list(path, { ...query, cursor }, accountForBody);
                    observedPages += 1;
                    if (page === null ||
                        typeof page !== "object" ||
                        !Array.isArray(page.data) ||
                        page.pagination === null ||
                        typeof page.pagination !== "object" ||
                        typeof page.pagination.hasMore !== "boolean") {
                        return yield* protocolError("expected data[] and pagination.hasMore");
                    }
                    if (page.data.length > MAX_PAGINATION_ITEMS - items.length) {
                        return yield* protocolError(`exceeded the ${MAX_PAGINATION_ITEMS} item safety limit`);
                    }
                    items.push(...page.data);
                    observedItems = items.length;
                    if (!page.pagination.hasMore)
                        return items;
                    const nextCursor = page.pagination.nextCursor;
                    if (typeof nextCursor !== "string" || nextCursor.length === 0) {
                        return yield* protocolError("hasMore was true without a non-empty nextCursor");
                    }
                    if (seenCursors.has(nextCursor)) {
                        return yield* protocolError("nextCursor repeated");
                    }
                    seenCursors.add(nextCursor);
                    cursor = nextCursor;
                    observedCursor = true;
                }
            }).pipe(Effect.timeoutOrElse({
                duration: PAGINATION_TIMEOUT,
                orElse: () => Effect.fail(new PrismaApiError({
                    method: "GET",
                    path,
                    status: 0,
                    message: `Prisma Management API pagination timed out after ${PAGINATION_TIMEOUT} (${observedPages} pages, ${observedItems} items, ${observedBodyBytes} response bytes, cursor ${observedCursor ? "present" : "absent"})`,
                })),
            }));
        });
        const service = {
            listWorkspaces: (query) => paginate("/v1/workspaces", query),
            getWorkspace: (id) => data("GET", `/v1/workspaces/${pathSegment(id)}`),
            getCurrentPrincipal: () => data("GET", "/v1/me"),
            listRegions: (query) => data("GET", "/v1/regions", { query }),
            listPostgresRegions: () => data("GET", "/v1/regions/postgres"),
            listAccelerateRegions: () => data("GET", "/v1/regions/accelerate"),
            listProjects: (query) => paginate("/v1/projects", query),
            getProject: (id) => data("GET", `/v1/projects/${pathSegment(id)}`),
            createProject: (input) => data("POST", "/v1/projects", {
                body: input,
                timeout: PROVISIONING_REQUEST_TIMEOUT,
            }),
            updateProject: (id, input) => data("PATCH", `/v1/projects/${pathSegment(id)}`, {
                body: input,
            }),
            deleteProject: (id) => request("DELETE", `/v1/projects/${pathSegment(id)}`, {
                timeout: PROVISIONING_REQUEST_TIMEOUT,
            }),
            transferProject: (id, input) => request("POST", `/v1/projects/${pathSegment(id)}/transfer`, {
                body: input,
            }),
            listDatabases: (query) => paginate("/v1/databases", query),
            listProjectDatabases: (projectId, query) => paginate(`/v1/projects/${pathSegment(projectId)}/databases`, query),
            getDatabase: (id) => data("GET", `/v1/databases/${pathSegment(id)}`),
            createDatabase: (input) => data("POST", "/v1/databases", {
                body: input,
                timeout: PROVISIONING_REQUEST_TIMEOUT,
            }),
            createProjectDatabase: (projectId, input) => data("POST", `/v1/projects/${pathSegment(projectId)}/databases`, { body: input, timeout: PROVISIONING_REQUEST_TIMEOUT }),
            updateDatabase: (id, input) => data("PATCH", `/v1/databases/${pathSegment(id)}`, {
                body: input,
            }),
            deleteDatabase: (id) => request("DELETE", `/v1/databases/${pathSegment(id)}`, {
                timeout: PROVISIONING_REQUEST_TIMEOUT,
            }),
            listBackups: (databaseId, query) => request("GET", `/v1/databases/${pathSegment(databaseId)}/backups`, { query }),
            restoreDatabase: (targetDatabaseId, input) => data("POST", `/v1/databases/${pathSegment(targetDatabaseId)}/restore`, { body: input, timeout: PROVISIONING_REQUEST_TIMEOUT }),
            getDatabaseUsage: (databaseId, query) => request("GET", `/v1/databases/${pathSegment(databaseId)}/usage`, { query }),
            listConnections: (query) => paginate("/v1/connections", query),
            listDatabaseConnections: (databaseId, query) => paginate(`/v1/databases/${pathSegment(databaseId)}/connections`, query),
            getConnection: (id) => data("GET", `/v1/connections/${pathSegment(id)}`),
            createConnection: (input) => data("POST", "/v1/connections", {
                body: input,
            }),
            createDatabaseConnection: (databaseId, input) => data("POST", `/v1/databases/${pathSegment(databaseId)}/connections`, { body: input }),
            deleteConnection: (id) => request("DELETE", `/v1/connections/${pathSegment(id)}`),
            rotateConnection: (id) => data("POST", `/v1/connections/${pathSegment(id)}/rotate`),
            listBranches: (projectId, query) => paginate(`/v1/projects/${pathSegment(projectId)}/branches`, query),
            getBranch: (id) => data("GET", `/v1/branches/${pathSegment(id)}`),
            createBranch: (projectId, input) => data("POST", `/v1/projects/${pathSegment(projectId)}/branches`, {
                body: input,
            }),
            updateBranch: (id, input) => data("PATCH", `/v1/branches/${pathSegment(id)}`, {
                body: input,
            }),
            deleteBranch: (id) => request("DELETE", `/v1/branches/${pathSegment(id)}`),
            listBuckets: (query) => paginate("/v1/buckets", query),
            getBucket: (id) => data("GET", `/v1/buckets/${pathSegment(id)}`),
            createBucket: (input) => data("POST", "/v1/buckets", { body: input }),
            deleteBucket: (id) => request("DELETE", `/v1/buckets/${pathSegment(id)}`),
            listBucketKeys: (bucketId, query) => paginate(`/v1/buckets/${pathSegment(bucketId)}/keys`, query),
            createBucketKey: (bucketId, input) => data("POST", `/v1/buckets/${pathSegment(bucketId)}/keys`, { body: input }),
            deleteBucketKey: (bucketId, keyId) => request("DELETE", `/v1/buckets/${pathSegment(bucketId)}/keys/${pathSegment(keyId)}`),
            getCustomDomain: (id) => data("GET", `/v1/domains/${pathSegment(id)}`),
            deleteCustomDomain: (id) => request("DELETE", `/v1/domains/${pathSegment(id)}`),
            retryCustomDomain: (id) => data("POST", `/v1/domains/${pathSegment(id)}/retry`),
            listApps: (query) => paginate("/v1/apps", query),
            getApp: (id) => data("GET", `/v1/apps/${pathSegment(id)}`),
            createApp: (input) => data("POST", "/v1/apps", {
                body: input,
                timeout: PROVISIONING_REQUEST_TIMEOUT,
            }),
            updateApp: (id, input) => data("PATCH", `/v1/apps/${pathSegment(id)}`, { body: input }),
            deleteApp: (id) => request("DELETE", `/v1/apps/${pathSegment(id)}`, {
                timeout: PROVISIONING_REQUEST_TIMEOUT,
            }),
            promoteApp: (id, target) => data("POST", `/v1/apps/${pathSegment(id)}/promote`, {
                body: target,
            }),
            rollbackApp: (id, target) => data("POST", `/v1/apps/${pathSegment(id)}/rollback`, {
                body: target,
                timeout: ROLLBACK_REQUEST_TIMEOUT,
            }),
            listAppDomains: (appId) => paginate(`/v1/apps/${pathSegment(appId)}/domains`),
            createAppDomain: (appId, input) => {
                const path = `/v1/apps/${pathSegment(appId)}/domains`;
                return dataWithStatus("POST", path, {
                    body: input,
                }).pipe(Effect.flatMap(({ status, data: domain }) => status === 200 || status === 201
                    ? Effect.succeed({ status, domain })
                    : Effect.fail(new PrismaApiDecodeError({
                        method: "POST",
                        path,
                        bodyLength: 0,
                        message: `Prisma Management API returned unexpected HTTP ${status} for custom-domain creation`,
                    }))));
            },
            listAppDeployments: (appId, query) => paginate(`/v1/apps/${pathSegment(appId)}/deployments`, query),
            createAppDeployment: (appId, input) => data("POST", `/v1/apps/${pathSegment(appId)}/deployments`, input === undefined ? undefined : { body: input }),
            getDeployment: (id) => data("GET", `/v1/deployments/${pathSegment(id)}`),
            deleteDeployment: (id) => request("DELETE", `/v1/deployments/${pathSegment(id)}`),
            startDeployment: (id) => data("POST", `/v1/deployments/${pathSegment(id)}/start`),
            stopDeployment: (id) => request("POST", `/v1/deployments/${pathSegment(id)}/stop`),
            getDeploymentLogsRequest: (id, query) => buildWebSocketUrl(`/v1/deployments/${pathSegment(id)}/logs`, logsQuery(query)).pipe(Effect.map((url) => ({
                url,
                headers: {
                    Authorization: Redacted.make(`Bearer ${Redacted.value(env.serviceToken)}`),
                },
            }))),
            getBuildLogsRequest: (buildId, query) => buildUrl(`/v1/builds/${pathSegment(buildId)}/logs`, query).pipe(Effect.map((url) => ({
                url,
                headers: {
                    Authorization: Redacted.make(`Bearer ${Redacted.value(env.serviceToken)}`),
                    Accept: "application/x-ndjson",
                },
            }))),
            listEnvironmentVariables: (query) => paginate("/v1/environment-variables", query),
            getEnvironmentVariable: (id) => data("GET", `/v1/environment-variables/${pathSegment(id)}`),
            createEnvironmentVariable: (input) => data("POST", "/v1/environment-variables", {
                body: input,
            }),
            updateEnvironmentVariable: (id, input) => data("PATCH", `/v1/environment-variables/${pathSegment(id)}`, { body: input }),
            deleteEnvironmentVariable: (id) => request("DELETE", `/v1/environment-variables/${pathSegment(id)}`),
            listIntegrations: (query) => paginate("/v1/integrations", query),
            listWorkspaceIntegrations: (workspaceId, query) => paginate(`/v1/workspaces/${pathSegment(workspaceId)}/integrations`, query),
            getIntegration: (id) => data("GET", `/v1/integrations/${pathSegment(id)}`),
            deleteIntegration: (id) => request("DELETE", `/v1/integrations/${pathSegment(id)}`),
            revokeWorkspaceIntegration: (workspaceId, clientId) => request("DELETE", `/v1/workspaces/${pathSegment(workspaceId)}/integrations/${pathSegment(clientId)}`),
            listScmInstallations: (query) => paginate("/v1/scm-installations", query),
            createScmInstallIntent: (input) => data("POST", "/v1/scm-installations/install-intents", {
                body: input,
            }),
            listScmInstallationRepositories: (installationId, query) => paginate(`/v1/scm-installations/${pathSegment(installationId)}/repositories`, query),
            listSourceRepositories: (query) => paginate("/v1/source-repositories", query),
            getSourceRepository: (id) => data("GET", `/v1/source-repositories/${pathSegment(id)}`),
            createSourceRepository: (input) => data("POST", "/v1/source-repositories", {
                body: input,
            }),
            deleteSourceRepository: (id) => request("DELETE", `/v1/source-repositories/${pathSegment(id)}`),
        };
        return service;
    });
}
const SAFE_ERROR_CODE = /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$/;
const parseErrorCode = (body) => {
    if (body.length === 0)
        return undefined;
    try {
        const json = JSON.parse(body);
        const nested = json.error !== null && typeof json.error === "object"
            ? json.error.code
            : undefined;
        const code = json.code ?? nested;
        return typeof code === "string" && SAFE_ERROR_CODE.test(code)
            ? code
            : undefined;
    }
    catch {
        return undefined;
    }
};
const formatErrorMessage = (status, body) => {
    const code = parseErrorCode(body);
    return code === undefined
        ? `HTTP ${status}`
        : `Prisma Management API request failed (${code})`;
};
export const PrismaClientLive = Layer.effect(PrismaClient, makePrismaClient());
//# sourceMappingURL=Client.js.map