import * as appsync from "@distilled.cloud/aws/appsync";
import * as iam from "@distilled.cloud/aws/iam";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { deepEqual, isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
import { retryConcurrentModification, retryWhileRolePropagates, sanitizeAppSyncName, } from "./common.js";
/**
 * An AppSync data source — the target a resolver reads from or writes to.
 *
 * For `AWS_LAMBDA` and `AMAZON_DYNAMODB` targets a least-privilege service
 * role is created automatically (unless an explicit `serviceRoleArn` is
 * given): `lambda:InvokeFunction` on the function, or the DynamoDB
 * read/write actions on the table and its indexes.
 * ### Creating Data Sources
 * **Example:** Lambda data source (auto-created invoke role)
 * ```typescript
 * const ds = yield* AppSync.DataSource("LambdaDS", {
 *   api,
 *   type: "AWS_LAMBDA",
 *   lambdaConfig: { lambdaFunctionArn: fn.functionArn },
 * });
 * ```
 *
 * **Example:** NONE data source (local compute)
 * ```typescript
 * const local = yield* AppSync.DataSource("Local", {
 *   api,
 *   type: "NONE",
 * });
 * ```
 *
 * **Example:** DynamoDB data source
 * ```typescript
 * const ds = yield* AppSync.DataSource("TableDS", {
 *   api,
 *   type: "AMAZON_DYNAMODB",
 *   dynamodbConfig: { tableName: table.tableName },
 * });
 * ```
 *
 * @resource
 */
export const DataSourceResource = Resource("AWS.AppSync.DataSource");
/**
 * User-facing wrapper for the DataSource resource. Accepts `api: GraphqlApi`
 * as the idiomatic way to attach a data source to an API.
 */
export const DataSource = (id, props) => Effect.gen(function* () {
    const { api, ...rest } = props;
    const apiId = rest.apiId ?? api?.apiId;
    if (!apiId) {
        return yield* Effect.die("DataSource requires either `api` (preferred) or an explicit `apiId`.");
    }
    return yield* DataSourceResource(id, { ...rest, apiId });
});
export const DataSourceProvider = () => Provider.effect(DataSourceResource, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.name ??
            sanitizeAppSyncName(yield* createPhysicalName({ id, maxLength: 64 })));
    });
    const getDataSourceSafe = (apiId, name) => appsync.getDataSource({ apiId, name }).pipe(Effect.map((response) => response.dataSource), Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)));
    /**
     * Least-privilege statements for the auto-created service role,
     * derived from the configured target.
     */
    const buildRolePolicyStatements = (news, region, accountId) => {
        const statements = [];
        if (news.type === "AWS_LAMBDA" && news.lambdaConfig !== undefined) {
            const arn = news.lambdaConfig.lambdaFunctionArn;
            statements.push({
                Effect: "Allow",
                Action: ["lambda:InvokeFunction"],
                Resource: /:function:[^:]+:/.test(arn) ? [arn] : [arn, `${arn}:*`],
            });
        }
        if (news.type === "AMAZON_DYNAMODB" &&
            news.dynamodbConfig !== undefined) {
            const tableRegion = news.dynamodbConfig.awsRegion ?? region;
            const tableArn = `arn:aws:dynamodb:${tableRegion}:${accountId}:table/${news.dynamodbConfig.tableName}`;
            statements.push({
                Effect: "Allow",
                Action: [
                    "dynamodb:BatchGetItem",
                    "dynamodb:BatchWriteItem",
                    "dynamodb:ConditionCheckItem",
                    "dynamodb:DeleteItem",
                    "dynamodb:GetItem",
                    "dynamodb:PutItem",
                    "dynamodb:Query",
                    "dynamodb:Scan",
                    "dynamodb:UpdateItem",
                ],
                Resource: [tableArn, `${tableArn}/index/*`],
            });
        }
        statements.push(...(news.policyStatements ?? []));
        return statements;
    };
    const needsServiceRole = (news) => news.type === "AWS_LAMBDA" ||
        news.type === "AMAZON_DYNAMODB" ||
        news.type === "AMAZON_EVENTBRIDGE";
    /**
     * Ensure the auto-created service role exists with the
     * `appsync.amazonaws.com` trust policy and the desired inline
     * policy. Idempotent across reconciles.
     */
    const ensureServiceRole = Effect.fn(function* ({ id, roleName, statements, }) {
        const tags = yield* createInternalTags(id);
        const role = yield* iam
            .createRole({
            RoleName: roleName,
            AssumeRolePolicyDocument: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Principal: { Service: "appsync.amazonaws.com" },
                        Action: "sts:AssumeRole",
                    },
                ],
            }),
            Tags: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
        })
            .pipe(Effect.catchTag("EntityAlreadyExistsException", () => iam.getRole({ RoleName: roleName })));
        if (statements.length > 0) {
            yield* iam.putRolePolicy({
                RoleName: roleName,
                PolicyName: `${roleName}-policy`,
                PolicyDocument: JSON.stringify({
                    Version: "2012-10-17",
                    Statement: statements,
                }),
            });
        }
        else {
            yield* iam
                .deleteRolePolicy({
                RoleName: roleName,
                PolicyName: `${roleName}-policy`,
            })
                .pipe(Effect.catchTag("NoSuchEntityException", () => Effect.void));
        }
        return role.Role.Arn;
    });
    /** Delete the auto-created service role and its inline policies. */
    const deleteServiceRole = Effect.fn(function* (roleName) {
        yield* iam.listRolePolicies.items({ RoleName: roleName }).pipe(Stream.mapEffect((policyName) => iam
            .deleteRolePolicy({
            RoleName: roleName,
            PolicyName: policyName,
        })
            .pipe(Effect.catchTag("NoSuchEntityException", () => Effect.void))), Stream.runDrain, Effect.catchTag("NoSuchEntityException", () => Effect.void));
        yield* iam
            .deleteRole({ RoleName: roleName })
            .pipe(Effect.catchTag("NoSuchEntityException", () => Effect.void));
    });
    const toWireConfigs = (news, region) => ({
        lambdaConfig: news.lambdaConfig,
        dynamodbConfig: news.dynamodbConfig === undefined
            ? undefined
            : {
                tableName: news.dynamodbConfig.tableName,
                awsRegion: news.dynamodbConfig.awsRegion ?? region,
                useCallerCredentials: news.dynamodbConfig.useCallerCredentials,
                versioned: news.dynamodbConfig.versioned,
            },
        httpConfig: news.httpConfig,
    });
    const toAttributes = (apiId, ds, roleName) => ({
        apiId,
        name: ds.name,
        dataSourceArn: ds.dataSourceArn,
        type: ds.type,
        serviceRoleArn: ds.serviceRoleArn,
        roleName,
    });
    return DataSourceResource.Provider.of({
        stables: ["apiId", "name", "dataSourceArn"],
        // Sub-resource keyed entirely by its GraphQL API (apiId) with no global
        // enumeration API of its own — nuke reaches it through the parent's
        // deletion, so enumeration returns empty per the ProviderService
        // doctrine.
        list: () => Effect.succeed([]),
        read: Effect.fn(function* ({ id, olds, output }) {
            const apiId = output?.apiId ?? olds?.apiId;
            if (apiId === undefined)
                return undefined;
            const name = output?.name ?? (yield* createName(id, olds ?? {}));
            const ds = yield* getDataSourceSafe(apiId, name);
            if (ds?.name == null)
                return undefined;
            return toAttributes(apiId, ds, output?.roleName);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds ?? {});
            const newName = yield* createName(id, news ?? {});
            if (news.apiId !== olds.apiId || oldName !== newName) {
                return { action: "replace" };
            }
            // type/config/role converge via updateDataSource
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { region, accountId } = yield* AWSEnvironment.current;
            const apiId = output?.apiId ?? news.apiId;
            const name = output?.name ?? (yield* createName(id, news));
            const configs = toWireConfigs(news, region);
            // Ensure the service role first — the data source cannot point
            // at a Lambda/DynamoDB target without one.
            let serviceRoleArn = news.serviceRoleArn;
            let roleName;
            if (serviceRoleArn === undefined && needsServiceRole(news)) {
                roleName = yield* createPhysicalName({ id, maxLength: 64 });
                serviceRoleArn = yield* ensureServiceRole({
                    id,
                    roleName,
                    statements: buildRolePolicyStatements(news, region, accountId),
                });
            }
            // 1. OBSERVE
            let observed = yield* getDataSourceSafe(apiId, name);
            // 2. ENSURE — a fresh role can take a few seconds to become
            //    assumable by AppSync.
            if (observed?.name == null) {
                const created = yield* retryWhileRolePropagates(retryConcurrentModification(appsync.createDataSource({
                    apiId,
                    name,
                    description: news.description,
                    type: news.type,
                    serviceRoleArn,
                    ...configs,
                })));
                observed = created.dataSource;
                yield* session.note(`Created data source ${name}`);
            }
            else {
                // 3. SYNC — single update when the observed surface drifted.
                const surface = (ds) => JSON.parse(JSON.stringify({
                    description: ds.description,
                    type: ds.type,
                    serviceRoleArn: ds.serviceRoleArn,
                    lambdaConfig: ds.lambdaConfig,
                    // AWS normalizes optional booleans into the response;
                    // mirror the defaults so no-ops stay no-ops.
                    dynamodbConfig: ds.dynamodbConfig === undefined
                        ? undefined
                        : {
                            tableName: ds.dynamodbConfig.tableName,
                            awsRegion: ds.dynamodbConfig.awsRegion,
                            useCallerCredentials: ds.dynamodbConfig.useCallerCredentials ?? false,
                            versioned: ds.dynamodbConfig.versioned ?? false,
                        },
                    httpConfig: ds.httpConfig,
                }));
                const desired = surface({
                    description: news.description,
                    type: news.type,
                    serviceRoleArn,
                    ...configs,
                });
                if (!deepEqual(surface(observed), desired)) {
                    const updated = yield* retryWhileRolePropagates(retryConcurrentModification(appsync.updateDataSource({
                        apiId,
                        name,
                        description: news.description,
                        type: news.type,
                        serviceRoleArn,
                        ...configs,
                    })));
                    observed = updated.dataSource ?? observed;
                    yield* session.note(`Updated data source ${name}`);
                }
            }
            yield* session.note(name);
            return toAttributes(apiId, observed, roleName);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* retryConcurrentModification(appsync
                .deleteDataSource({ apiId: output.apiId, name: output.name })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.void)));
            if (output.roleName !== undefined) {
                yield* deleteServiceRole(output.roleName);
            }
        }),
    });
}));
//# sourceMappingURL=DataSource.js.map