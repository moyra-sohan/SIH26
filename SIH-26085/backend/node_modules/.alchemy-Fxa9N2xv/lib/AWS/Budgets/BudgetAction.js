import * as budgets from "@distilled.cloud/aws/budgets";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
/**
 * An AWS Budgets action — runs an IAM policy attachment, SCP attachment, or
 * SSM stop-instances document when a budget threshold is crossed, either
 * automatically or after manual approval.
 *
 * The execution role must trust `budgets.amazonaws.com` and carry the
 * permissions the action needs (the AWS managed policy
 * `AWSBudgetsActionsWithAWSResourceControlAccess` covers all three kinds).
 *
 * ### Creating a Budget Action
 * **Example:** Apply a Deny-All Policy at 100% of the Budget
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * const budget = yield* AWS.Budgets.Budget("MonthlyCost", {
 *   budgetLimit: { amount: "100", unit: "USD" },
 * });
 *
 * const action = yield* AWS.Budgets.BudgetAction("FreezeSpend", {
 *   budgetName: budget.budgetName,
 *   notificationType: "ACTUAL",
 *   actionType: "APPLY_IAM_POLICY",
 *   actionThreshold: {
 *     actionThresholdValue: 100,
 *     actionThresholdType: "PERCENTAGE",
 *   },
 *   definition: {
 *     iamActionDefinition: {
 *       policyArn: "arn:aws:iam::aws:policy/AWSDenyAll",
 *       roles: [devRole.roleName],
 *     },
 *   },
 *   executionRoleArn: executionRole.roleArn,
 *   approvalModel: "MANUAL",
 *   subscribers: [{ subscriptionType: "EMAIL", address: "team@example.com" }],
 * });
 * ```
 *
 * **Example:** Stop EC2 Instances Automatically
 * ```typescript
 * const action = yield* AWS.Budgets.BudgetAction("StopDevInstances", {
 *   budgetName: budget.budgetName,
 *   notificationType: "ACTUAL",
 *   actionType: "RUN_SSM_DOCUMENTS",
 *   actionThreshold: {
 *     actionThresholdValue: 100,
 *     actionThresholdType: "PERCENTAGE",
 *   },
 *   definition: {
 *     ssmActionDefinition: {
 *       actionSubType: "STOP_EC2_INSTANCES",
 *       region: "us-east-1",
 *       instanceIds: [instance.instanceId],
 *     },
 *   },
 *   executionRoleArn: executionRole.roleArn,
 *   approvalModel: "AUTOMATIC",
 *   subscribers: [{ subscriptionType: "EMAIL", address: "team@example.com" }],
 * });
 * ```
 *
 * @resource
 */
export const BudgetAction = Resource("AWS.Budgets.BudgetAction");
/**
 * Compute the ARN of a budget action. Budgets is a global service, so the ARN
 * has no region component.
 */
export const budgetActionArn = (accountId, budgetName, actionId) => `arn:aws:budgets::${accountId}:budget/${budgetName}/action/${actionId}`;
const toDefinition = (d) => ({
    IamActionDefinition: d.iamActionDefinition
        ? {
            PolicyArn: d.iamActionDefinition.policyArn,
            Roles: d.iamActionDefinition.roles,
            Groups: d.iamActionDefinition.groups,
            Users: d.iamActionDefinition.users,
        }
        : undefined,
    ScpActionDefinition: d.scpActionDefinition
        ? {
            PolicyId: d.scpActionDefinition.policyId,
            TargetIds: d.scpActionDefinition.targetIds,
        }
        : undefined,
    SsmActionDefinition: d.ssmActionDefinition
        ? {
            ActionSubType: d.ssmActionDefinition.actionSubType,
            Region: d.ssmActionDefinition.region,
            InstanceIds: d.ssmActionDefinition.instanceIds,
        }
        : undefined,
});
const toSubscribers = (subscribers) => subscribers.map((s) => ({
    SubscriptionType: s.subscriptionType,
    Address: s.address,
}));
/** The updatable slice of an action, in a canonical shape for comparison. */
const updatableSlice = (a) => JSON.stringify({
    NotificationType: a.NotificationType,
    ActionThreshold: {
        ActionThresholdValue: a.ActionThreshold.ActionThresholdValue,
        ActionThresholdType: a.ActionThreshold.ActionThresholdType,
    },
    Definition: {
        IamActionDefinition: a.Definition.IamActionDefinition
            ? {
                PolicyArn: a.Definition.IamActionDefinition.PolicyArn,
                Roles: a.Definition.IamActionDefinition.Roles ?? [],
                Groups: a.Definition.IamActionDefinition.Groups ?? [],
                Users: a.Definition.IamActionDefinition.Users ?? [],
            }
            : undefined,
        ScpActionDefinition: a.Definition.ScpActionDefinition,
        SsmActionDefinition: a.Definition.SsmActionDefinition,
    },
    ExecutionRoleArn: a.ExecutionRoleArn,
    ApprovalModel: a.ApprovalModel,
    // Distilled marks `Subscriber.Address` sensitive — observed subscribers
    // come back Redacted; unwrap so the observed-vs-desired comparison does
    // not see `<redacted>` and issue a dirty update on every reconcile.
    Subscribers: [...a.Subscribers]
        .map((s) => `${s.SubscriptionType}:${Redacted.isRedacted(s.Address)
        ? Redacted.value(s.Address)
        : s.Address}`)
        .sort(),
});
export const BudgetActionProvider = () => Provider.effect(BudgetAction, Effect.gen(function* () {
    const syncTags = Effect.fn(function* (arn, desired) {
        const observed = yield* budgets
            .listTagsForResource({ ResourceARN: arn })
            .pipe(Effect.map((r) => Object.fromEntries((r.ResourceTags ?? []).map((t) => [t.Key, t.Value]))), Effect.catchTag("NotFoundException", () => Effect.succeed({})));
        const { removed, upsert } = diffTags(observed, desired);
        if (upsert.length > 0) {
            yield* budgets.tagResource({
                ResourceARN: arn,
                ResourceTags: upsert,
            });
        }
        if (removed.length > 0) {
            yield* budgets.untagResource({
                ResourceARN: arn,
                ResourceTagKeys: removed,
            });
        }
    });
    const attrs = (accountId, budgetName, actionId) => ({
        actionId,
        budgetName,
        accountId,
        actionArn: budgetActionArn(accountId, budgetName, actionId),
    });
    return BudgetAction.Provider.of({
        stables: ["actionId", "budgetName", "accountId", "actionArn"],
        list: () => Effect.gen(function* () {
            const { accountId } = yield* AWSEnvironment.current;
            return yield* budgets.describeBudgetActionsForAccount
                .pages({ AccountId: accountId })
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
                .flatMap((page) => page.Actions ?? [])
                .map((a) => attrs(accountId, a.BudgetName, a.ActionId))));
        }),
        read: Effect.fn(function* ({ output }) {
            // The action ID is server-generated — without persisted output there
            // is no deterministic way to find the action.
            if (!output)
                return undefined;
            const { accountId } = yield* AWSEnvironment.current;
            const found = yield* budgets
                .describeBudgetAction({
                AccountId: accountId,
                BudgetName: output.budgetName,
                ActionId: output.actionId,
            })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)));
            if (!found?.Action)
                return undefined;
            return attrs(accountId, output.budgetName, output.actionId);
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return undefined;
            if (olds.budgetName !== news.budgetName ||
                olds.actionType !== news.actionType) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const { accountId } = yield* AWSEnvironment.current;
            const internalTags = yield* createInternalTags(id);
            const desiredSubscribers = toSubscribers(news.subscribers);
            const desired = {
                NotificationType: news.notificationType,
                ActionThreshold: {
                    ActionThresholdValue: news.actionThreshold.actionThresholdValue,
                    ActionThresholdType: news.actionThreshold.actionThresholdType,
                },
                Definition: toDefinition(news.definition),
                ExecutionRoleArn: news.executionRoleArn,
                ApprovalModel: news.approvalModel ?? "MANUAL",
                Subscribers: desiredSubscribers,
            };
            // OBSERVE — the action ID is server-generated, so `output` is the
            // only handle; cloud state stays authoritative via describe.
            const observed = output
                ? yield* budgets
                    .describeBudgetAction({
                    AccountId: accountId,
                    BudgetName: output.budgetName,
                    ActionId: output.actionId,
                })
                    .pipe(Effect.map((r) => r.Action), Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)))
                : undefined;
            let actionId;
            if (!observed) {
                // ENSURE — create. A freshly created execution role can take a
                // few seconds to become assumable by budgets.amazonaws.com, which
                // surfaces as InvalidParameterException/AccessDeniedException.
                const created = yield* budgets
                    .createBudgetAction({
                    AccountId: accountId,
                    BudgetName: news.budgetName,
                    NotificationType: desired.NotificationType,
                    ActionType: news.actionType,
                    ActionThreshold: desired.ActionThreshold,
                    Definition: desired.Definition,
                    ExecutionRoleArn: desired.ExecutionRoleArn,
                    ApprovalModel: desired.ApprovalModel,
                    Subscribers: desired.Subscribers,
                    ResourceTags: Object.entries({
                        ...news.tags,
                        ...internalTags,
                    }).map(([Key, Value]) => ({ Key, Value })),
                })
                    .pipe(Effect.retry({
                    while: (e) => e._tag === "InvalidParameterException" ||
                        e._tag === "AccessDeniedException",
                    schedule: Schedule.exponential("2 seconds"),
                    times: 6,
                }));
                actionId = created.ActionId;
            }
            else {
                actionId = observed.ActionId;
                // SYNC — apply the update only when the observed action differs
                // from the desired definition.
                if (updatableSlice(observed) !== updatableSlice(desired)) {
                    yield* budgets
                        .updateBudgetAction({
                        AccountId: accountId,
                        BudgetName: news.budgetName,
                        ActionId: actionId,
                        NotificationType: desired.NotificationType,
                        ActionThreshold: desired.ActionThreshold,
                        Definition: desired.Definition,
                        ExecutionRoleArn: desired.ExecutionRoleArn,
                        ApprovalModel: desired.ApprovalModel,
                        Subscribers: desired.Subscribers,
                    })
                        .pipe(Effect.retry({
                        while: (e) => e._tag === "ResourceLockedException",
                        schedule: Schedule.exponential("2 seconds"),
                        times: 6,
                    }));
                }
            }
            // SYNC tags against observed cloud tags.
            const arn = budgetActionArn(accountId, news.budgetName, actionId);
            yield* syncTags(arn, { ...news.tags, ...internalTags });
            yield* session.note(actionId);
            return attrs(accountId, news.budgetName, actionId);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* budgets
                .deleteBudgetAction({
                AccountId: output.accountId,
                BudgetName: output.budgetName,
                ActionId: output.actionId,
            })
                .pipe(
            // An action mid-execution is briefly locked; wait it out.
            Effect.retry({
                while: (e) => e._tag === "ResourceLockedException",
                schedule: Schedule.exponential("2 seconds"),
                times: 6,
            }), Effect.catchTag("NotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=BudgetAction.js.map