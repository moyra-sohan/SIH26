import * as Data from "effect/Data";
/**
 * Failure of a Prisma Object Store operation. Every transport-level failure
 * (HTTP, SigV4, decoding) is normalized into this one error so callers never
 * have to match on the underlying S3 error union.
 */
export class BucketError extends Data.TaggedError("BucketError") {
}
//# sourceMappingURL=BucketTypes.js.map