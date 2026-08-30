import * as Data from "effect/Data";
/**
 * Error returned by an OpenSearch domain's REST data plane (the search/index
 * API served under the domain's `endpoint`).
 *
 * Raised when the HTTP request fails, the response is not a 2xx (and not an
 * expected `404` on document lookups), or the body is not valid JSON.
 */
export class OpenSearchApiError extends Data.TaggedError("AWS.OpenSearch.ApiError") {
}
//# sourceMappingURL=DataPlaneTypes.js.map