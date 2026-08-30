/**
 * Runtime half of the Prisma Object Store bindings: an S3-compatible client
 * pointed at a bucket key's endpoint. Internal — the capability modules
 * (`ReadBucket.ts`, `WriteBucket.ts`, `ReadWriteBucket.ts`) build their public
 * clients on top of these primitives.
 */
import { Credentials, Endpoint, Presign, Region } from "@distilled.cloud/aws";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { BucketError, } from "../BucketTypes.js";
/**
 * SigV4 credential scope used for Prisma Object Store requests. Prisma
 * addresses buckets through a single regionless endpoint and does not report
 * a region on a bucket key, so requests are signed under the `auto` scope
 * that S3-compatible stores conventionally accept.
 */
export const BUCKET_SIGNING_REGION = "auto";
export const toBucketError = (error) => new BucketError({
    message: typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "Unknown Prisma Object Store error",
    cause: error instanceof Error ? error : new Error(String(error)),
});
const signingContext = (credentials) => Effect.all([
    credentials.endpoint,
    credentials.accessKeyId,
    credentials.secretAccessKey,
]).pipe(Effect.map(([endpoint, accessKeyId, secretAccessKey]) => Layer.mergeAll(Layer.succeed(Credentials.Credentials, Effect.succeed({
    accessKeyId: Redacted.make(accessKeyId),
    secretAccessKey,
    sessionToken: undefined,
    region: BUCKET_SIGNING_REGION,
})), Layer.succeed(Region.Region, Effect.succeed(BUCKET_SIGNING_REGION)), Layer.succeed(Endpoint.Endpoint, Effect.succeed(endpoint)), FetchHttpClient.layer)));
/**
 * Build the transport for a bound bucket key. Requests are signed with the
 * key's own credentials against its endpoint; because a custom endpoint is
 * set, the S3 client addresses the bucket path-style rather than through the
 * AWS virtual-host rules.
 */
export const makeBucketAccess = (credentials) => {
    const context = signingContext(credentials);
    return {
        bucketName: credentials.bucketName,
        authorize: (effect) => context.pipe(Effect.flatMap((layer) => Effect.provide(effect, layer))),
        presign: (request) => Effect.all([context, credentials.bucketName]).pipe(Effect.flatMap(([layer, bucket]) => Presign.presignS3Url({
            method: request.method,
            bucket,
            key: request.key,
            region: BUCKET_SIGNING_REGION,
            expiresIn: request.expiresIn,
            contentType: request.method === "PUT" ? request.contentType : undefined,
            responseContentType: request.method === "GET"
                ? request.responseContentType
                : undefined,
        }).pipe(Effect.provide(layer))), Effect.mapError(toBucketError)),
    };
};
/** Render a {@link BucketRange} as an HTTP `Range` header value. */
export const rangeHeader = (range) => {
    if (range === undefined)
        return undefined;
    const end = range.length === undefined ? "" : String(range.offset + range.length - 1);
    return `bytes=${range.offset}-${end}`;
};
const stripQuotes = (etag) => etag === undefined ? "" : etag.replaceAll('"', "");
const definedMetadata = (metadata) => {
    const result = {};
    for (const [key, value] of Object.entries(metadata ?? {})) {
        if (value !== undefined)
            result[key] = value;
    }
    return result;
};
export const objectFrom = (key, attributes) => ({
    key,
    size: attributes.ContentLength ?? 0,
    etag: stripQuotes(attributes.ETag),
    lastModified: attributes.LastModified,
    contentType: attributes.ContentType,
    metadata: definedMetadata(attributes.Metadata),
});
export const objectFromListEntry = (entry) => ({
    key: entry.Key ?? "",
    size: entry.Size ?? 0,
    etag: stripQuotes(entry.ETag),
    lastModified: entry.LastModified,
    contentType: undefined,
    metadata: {},
});
const concatBytes = (chunks) => {
    const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return result;
};
/**
 * Wrap a `GetObject` response as a {@link BucketObjectBody}. The body is a
 * single-consumption stream, so `body` and the buffering accessors are three
 * views of the same bytes and only one of them may be read.
 */
export const objectBodyFrom = (key, response) => {
    const body = (response.Body ?? Stream.empty).pipe(Stream.mapError(toBucketError));
    const bytes = () => Stream.runCollect(body).pipe(Effect.map(concatBytes));
    const text = () => Stream.mkString(Stream.decodeText(body));
    return {
        ...objectFrom(key, response),
        body,
        bytes,
        arrayBuffer: () => bytes().pipe(Effect.map((collected) => {
            const buffer = new ArrayBuffer(collected.byteLength);
            new Uint8Array(buffer).set(collected);
            return buffer;
        })),
        text,
        json: () => text().pipe(Effect.flatMap((decoded) => Effect.try({
            try: () => JSON.parse(decoded),
            catch: toBucketError,
        }))),
    };
};
//# sourceMappingURL=BucketClient.js.map