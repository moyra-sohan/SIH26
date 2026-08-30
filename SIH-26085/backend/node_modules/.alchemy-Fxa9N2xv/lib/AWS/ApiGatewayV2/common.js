import * as agw2 from "@distilled.cloud/aws/apigatewayv2";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Schedule from "effect/Schedule";
import { diffTags, normalizeTags } from "../../Tags.js";
/**
 * API Gateway v2 ARN helpers. Unlike most services the resource ARNs used
 * for tagging omit the account id (`arn:aws:apigateway:{region}::/apis/{id}`).
 */
export const apiArn = (region, apiId) => `arn:aws:apigateway:${region}::/apis/${apiId}`;
export const stageArn = (region, apiId, stageName) => `arn:aws:apigateway:${region}::/apis/${apiId}/stages/${stageName}`;
export const domainNameArn = (region, domainName) => `arn:aws:apigateway:${region}::/domainnames/${domainName}`;
export const vpcLinkArn = (region, vpcLinkId) => `arn:aws:apigateway:${region}::/vpclinks/${vpcLinkId}`;
/**
 * The `execute-api` ARN that IAM policies (Lambda resource policies,
 * `execute-api:Invoke`/`ManageConnections` statements) use to scope access
 * to an API. Wildcards match across path segments.
 */
export const executeApiArn = (region, accountId, apiId, suffix = "/*") => `arn:aws:execute-api:${region}:${accountId}:${apiId}${suffix}`;
/**
 * `Create/Update/Delete` operations across API Gateway v2 share an
 * account-wide throttle; parallel test suites and deploys routinely see
 * `TooManyRequestsException` outlast the blanket SDK retry budget. The
 * schedule below (exponential base 1s capped at 20s, 10 attempts, ~60s
 * total) rides out the throttle window without hiding real failures.
 *
 * The helper carries an EXPLICIT return annotation so the conditional type
 * of `Effect.retry` never leaks into declaration emit (which would widen the
 * provider layer to `unknown` for every consumer of `AWS.providers()`).
 */
export const retryOnTooManyRequests = (effect) => Effect.retry(effect, {
    while: (error) => error._tag === "TooManyRequestsException" ||
        error._tag === "ConflictException",
    schedule: Schedule.max([
        pipe(Schedule.exponential(Duration.seconds(1), 2), Schedule.modifyDelay(({ duration }) => Effect.succeed(Duration.isGreaterThan(duration, Duration.seconds(20))
            ? Duration.seconds(20)
            : duration))),
        Schedule.recurs(10),
    ]),
});
/**
 * Normalize the wire tag map (values may be `undefined`) to a plain record.
 */
export const tagRecord = (tags) => Object.fromEntries(Object.entries(tags ?? {}).filter((entry) => entry[1] !== undefined));
/**
 * API Gateway v2 collection operations (`getApis`, `getRoutes`, `getStages`,
 * …) return `{ Items, NextToken }` pages without a Smithy pagination trait,
 * so distilled exposes no `.pages` stream for them. Collect every page
 * manually, bounded at 100 pages so a misbehaving token can never hang the
 * engine.
 */
export const collectAllPages = Effect.fn(function* (fetchPage) {
    const items = [];
    let nextToken = undefined;
    for (let page = 0; page < 100; page++) {
        const result = yield* fetchPage(nextToken);
        items.push(...(result.Items ?? []));
        nextToken = result.NextToken;
        if (!nextToken)
            break;
    }
    return items;
});
/**
 * Diff observed tags against desired tags and apply only the delta via the
 * v2 `tagResource`/`untagResource` operations.
 */
export const syncTags = Effect.fn(function* ({ resourceArn, oldTags, newTags, }) {
    const { removed, upsert } = diffTags(oldTags, newTags);
    if (removed.length > 0) {
        yield* agw2
            .untagResource({ ResourceArn: resourceArn, TagKeys: removed })
            .pipe(Effect.catchTag("NotFoundException", () => Effect.void));
    }
    if (upsert.length > 0) {
        yield* agw2.tagResource({
            ResourceArn: resourceArn,
            Tags: normalizeTags(upsert),
        });
    }
});
//# sourceMappingURL=common.js.map