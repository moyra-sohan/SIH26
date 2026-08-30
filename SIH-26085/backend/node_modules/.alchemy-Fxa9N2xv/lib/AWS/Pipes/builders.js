import * as Effect from "effect/Effect";
import { toWireSeconds } from "../../Util/Duration.js";
import * as IAM from "../IAM/index.js";
import { Pipe } from "./Pipe.js";
/**
 * Start building an EventBridge Pipe from a source resource. The terminal
 * `.toLambda(...)` / `.toQueue(...)` call synthesizes the
 * `pipes.amazonaws.com` execution role — source-read plus target-invoke
 * (plus enrichment-invoke) policies scoped to the exact resource ARNs —
 * and yields the {@link Pipe}.
 *
 * ```typescript
 * const pipe = yield* AWS.Pipes.from(queue, { batchSize: 1 })
 *   .filter(JSON.stringify({ body: { type: ["order.created"] } }))
 *   .toLambda(fn);
 * ```
 */
export const from = (source, options = {}) => makePipeBuilder({ source, options, filters: [] });
const makePipeBuilder = (state) => ({
    /**
     * Add EventBridge event-pattern filters. Only source events matching at
     * least one pattern reach the enrichment/target. Accepts pattern strings
     * or plain objects (JSON-stringified).
     */
    filter: (...patterns) => makePipeBuilder({
        ...state,
        filters: [
            ...state.filters,
            ...patterns.map((pattern) => typeof pattern === "string" ? pattern : JSON.stringify(pattern)),
        ],
    }),
    /**
     * Enrich each batch with a Lambda function before delivery to the
     * target. The synthesized role is granted `lambda:InvokeFunction` on the
     * enrichment function.
     */
    enrich: (fn, parameters) => makePipeBuilder({ ...state, enrichment: { fn, parameters } }),
    /**
     * Deliver batches to a Lambda function target.
     */
    toLambda: (fn, options = {}) => materializePipe(state, fn.LogicalId, [
        {
            Effect: "Allow",
            Action: ["lambda:InvokeFunction"],
            Resource: [fn.functionArn],
        },
    ], fn.functionArn, {
        InputTemplate: options.inputTemplate,
        LambdaFunctionParameters: options.invocationType
            ? { InvocationType: options.invocationType }
            : undefined,
    }, options),
    /**
     * Deliver batches to an SQS queue target.
     */
    toQueue: (queue, options = {}) => materializePipe(state, queue.LogicalId, [
        {
            Effect: "Allow",
            Action: ["sqs:SendMessage"],
            Resource: [queue.queueArn],
        },
    ], queue.queueArn, {
        InputTemplate: options.inputTemplate,
        SqsQueueParameters: options.messageGroupId !== undefined ||
            options.messageDeduplicationId !== undefined
            ? {
                MessageGroupId: options.messageGroupId,
                MessageDeduplicationId: options.messageDeduplicationId,
            }
            : undefined,
    }, options),
});
const sourceSpec = (state) => {
    const { source, options, filters } = state;
    // The wire field is whole seconds.
    const maximumBatchingWindowInSeconds = toWireSeconds(options.maximumBatchingWindow);
    const filterCriteria = filters.length > 0
        ? { FilterCriteria: { Filters: filters.map((Pattern) => ({ Pattern })) } }
        : {};
    switch (source.Type) {
        case "AWS.SQS.Queue":
            return {
                arn: source.queueArn,
                statements: [
                    {
                        Effect: "Allow",
                        Action: [
                            "sqs:ReceiveMessage",
                            "sqs:DeleteMessage",
                            "sqs:GetQueueAttributes",
                        ],
                        Resource: [source.queueArn],
                    },
                ],
                parameters: {
                    ...filterCriteria,
                    SqsQueueParameters: {
                        BatchSize: options.batchSize,
                        MaximumBatchingWindowInSeconds: maximumBatchingWindowInSeconds,
                    },
                },
            };
        case "AWS.Kinesis.Stream":
            return {
                arn: source.streamArn,
                statements: [
                    {
                        Effect: "Allow",
                        Action: [
                            "kinesis:DescribeStream",
                            "kinesis:DescribeStreamSummary",
                            "kinesis:GetRecords",
                            "kinesis:GetShardIterator",
                            "kinesis:ListShards",
                            "kinesis:ListStreams",
                        ],
                        Resource: [source.streamArn],
                    },
                ],
                parameters: {
                    ...filterCriteria,
                    KinesisStreamParameters: {
                        StartingPosition: options.startingPosition ?? "LATEST",
                        BatchSize: options.batchSize,
                        MaximumBatchingWindowInSeconds: maximumBatchingWindowInSeconds,
                    },
                },
            };
        case "AWS.DynamoDB.Table":
            return {
                arn: source.latestStreamArn,
                statements: [
                    {
                        Effect: "Allow",
                        Action: [
                            "dynamodb:DescribeStream",
                            "dynamodb:GetRecords",
                            "dynamodb:GetShardIterator",
                            "dynamodb:ListStreams",
                        ],
                        Resource: [source.latestStreamArn],
                    },
                ],
                parameters: {
                    ...filterCriteria,
                    DynamoDBStreamParameters: {
                        StartingPosition: options.startingPosition ?? "LATEST",
                        BatchSize: options.batchSize,
                        MaximumBatchingWindowInSeconds: maximumBatchingWindowInSeconds,
                    },
                },
            };
    }
};
const materializePipe = (state, targetId, targetStatements, targetArn, targetParameters, options) => Effect.gen(function* () {
    const src = sourceSpec(state);
    const pipeId = options.name ?? `${state.source.LogicalId}To${targetId}Pipe`;
    const enrichmentStatements = state.enrichment
        ? [
            {
                Effect: "Allow",
                Action: ["lambda:InvokeFunction"],
                Resource: [state.enrichment.fn.functionArn],
            },
        ]
        : [];
    const role = yield* IAM.Role(`${pipeId}Role`, {
        assumeRolePolicyDocument: {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: { Service: "pipes.amazonaws.com" },
                    Action: ["sts:AssumeRole"],
                },
            ],
        },
        inlinePolicies: {
            PipeSource: {
                Version: "2012-10-17",
                Statement: src.statements,
            },
            PipeTarget: {
                Version: "2012-10-17",
                Statement: [...targetStatements, ...enrichmentStatements],
            },
        },
    });
    return yield* Pipe(pipeId, {
        pipeName: options.name,
        description: options.description,
        desiredState: options.desiredState,
        source: src.arn,
        sourceParameters: src.parameters,
        enrichment: state.enrichment
            ? state.enrichment.fn.functionArn
            : undefined,
        enrichmentParameters: state.enrichment?.parameters,
        target: targetArn,
        targetParameters,
        roleArn: role.roleArn,
    });
});
//# sourceMappingURL=builders.js.map