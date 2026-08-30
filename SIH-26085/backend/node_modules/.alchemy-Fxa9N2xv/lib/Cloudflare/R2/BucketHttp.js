import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Self } from "../../Self.js";
import { AccountApiToken } from "../ApiToken/AccountApiToken.js";
import { CloudflareEnvironment } from "../CloudflareEnvironment.js";
import { R2Error } from "./BucketTypes.js";
export const makeHttpBucketBinding = (options) => Effect.gen(function* () {
    const Token = yield* AccountApiToken;
    const self = yield* Self;
    const env = yield* CloudflareEnvironment;
    return Effect.fn(function* (bucket) {
        const { accountId } = yield* env;
        const token = yield* Token(`${self.LogicalId}Token`);
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            yield* token.bind `${bucket.LogicalId}`({
                policies: [
                    {
                        effect: "allow",
                        permissionGroups: options.permissionGroups,
                        resources: {
                            [`com.cloudflare.api.account.${accountId}`]: "*",
                        },
                    },
                ],
            });
        }
        const bound = {
            value: yield* token.value,
            accountId: yield* token.accountId,
        };
        const bucketName = yield* bucket.bucketName;
        const jurisdiction = yield* bucket.jurisdiction;
        return options.makeClient(bound, bucketName, jurisdiction);
    });
});
const R2_HTTP_PERMISSION_GROUPS = [
    "Workers R2 Storage Read",
    "Workers R2 Storage Write",
];
/** Resolve the account, bucket, and jurisdiction once per operation. */
export const makeR2HttpScope = (accountId, bucketName, jurisdiction) => Effect.gen(function* () {
    const accountId_ = yield* accountId;
    const bucket = yield* bucketName;
    const j = yield* jurisdiction;
    return {
        accountId: accountId_,
        bucketName: bucket,
        cfR2Jurisdiction: j === "default" ? undefined : j,
    };
});
/**
 * Bind the token's `value` (as `secret_text`) and `accountId` (as `plain_text`)
 * into the Worker so they can be read at runtime.
 */
export const toR2Error = (error) => new R2Error({
    message: typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "Unknown R2 error",
    cause: error instanceof Error ? error : new Error(String(error)),
});
const stripQuotes = (etag) => etag === undefined ? undefined : etag.replace(/^"|"$/g, "");
/** Normalize the caller's `httpMetadata` option (object or `Headers`). */
export const readHttpMetadata = (options) => {
    const meta = options?.httpMetadata;
    if (!meta)
        return undefined;
    if (meta instanceof Headers) {
        return {
            contentType: meta.get("content-type") ?? undefined,
            contentEncoding: meta.get("content-encoding") ?? undefined,
            contentDisposition: meta.get("content-disposition") ?? undefined,
            contentLanguage: meta.get("content-language") ?? undefined,
            cacheControl: meta.get("cache-control") ?? undefined,
        };
    }
    return meta;
};
/** Write an object's HTTP metadata onto a `Headers` instance. */
const applyHttpMetadata = (headers, meta) => {
    if (meta.contentType)
        headers.set("content-type", meta.contentType);
    if (meta.contentEncoding)
        headers.set("content-encoding", meta.contentEncoding);
    if (meta.contentDisposition)
        headers.set("content-disposition", meta.contentDisposition);
    if (meta.contentLanguage)
        headers.set("content-language", meta.contentLanguage);
    if (meta.cacheControl)
        headers.set("cache-control", meta.cacheControl);
};
export const baseObject = (key, meta, attrs) => ({
    key,
    version: "",
    size: attrs.size ?? 0,
    etag: stripQuotes(attrs.etag) ?? "",
    httpEtag: attrs.etag ?? "",
    checksums: {},
    uploaded: attrs.uploaded ?? new Date(0),
    httpMetadata: meta,
    customMetadata: attrs.customMetadata ?? {},
    range: undefined,
    storageClass: attrs.storageClass ?? "Standard",
    writeHttpMetadata: (headers) => Effect.sync(() => applyHttpMetadata(headers, meta)),
});
/** Collect a put `value` into a body accepted by the R2 HTTP API. */
export const toBody = (value) => Effect.gen(function* () {
    if (value === null)
        return { body: new Uint8Array(0), contentLength: 0 };
    if (typeof value === "string")
        return { body: value };
    if (value instanceof Blob)
        return { body: value, contentLength: value.size };
    if (value instanceof ArrayBuffer)
        return { body: value, contentLength: value.byteLength };
    if (Stream.isStream(value) || value instanceof ReadableStream) {
        const readable = Stream.isStream(value)
            ? Stream.toReadableStream(value)
            : value;
        const buffer = yield* Effect.tryPromise({
            try: () => new Response(readable).arrayBuffer(),
            catch: toR2Error,
        });
        return { body: new Uint8Array(buffer), contentLength: buffer.byteLength };
    }
    const view = value;
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    return { body: bytes, contentLength: bytes.byteLength };
});
//# sourceMappingURL=BucketHttp.js.map