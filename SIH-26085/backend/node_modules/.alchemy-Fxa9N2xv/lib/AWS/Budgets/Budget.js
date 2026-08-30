import * as budgets from "@distilled.cloud/aws/budgets";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, diffTags } from "../../Tags.js";
import { AWSEnvironment } from "../Environment.js";
/**
 * An AWS Budget — tracks cost or usage against a defined limit over a time
 * period and notifies subscribers when configured thresholds are crossed.
 *
 * Budgets are a global (account-level) resource; they are free and take
 * effect immediately.
 *
 * ### Creating a Budget
 * **Example:** Monthly cost budget with an email alert at 80%
 * ```typescript
 * import * as Budgets from "alchemy/AWS/Budgets";
 *
 * const budget = yield* Budgets.Budget("MonthlyCost", {
 *   budgetType: "COST",
 *   timeUnit: "MONTHLY",
 *   budgetLimit: { amount: "100", unit: "USD" },
 *   notifications: [
 *     {
 *       notificationType: "ACTUAL",
 *       comparisonOperator: "GREATER_THAN",
 *       threshold: 80,
 *       thresholdType: "PERCENTAGE",
 *       subscribers: [{ subscriptionType: "EMAIL", address: "team@example.com" }],
 *     },
 *   ],
 * });
 * ```
 *
 * **Example:** Budget scoped to a single service
 * ```typescript
 * const budget = yield* Budgets.Budget("EC2Spend", {
 *   budgetLimit: { amount: "500", unit: "USD" },
 *   costFilters: {
 *     Service: ["Amazon Elastic Compute Cloud - Compute"],
 *   },
 * });
 * ```
 *
 * @resource
 */
export const Budget = Resource("AWS.Budgets.Budget");
/**
 * Compute the ARN of a budget. Budgets is a global service, so the ARN has no
 * region component.
 */
export const budgetArn = (accountId, budgetName) => `arn:aws:budgets::${accountId}:budget/${budgetName}`;
const notificationKey = (n) => JSON.stringify({
    NotificationType: n.NotificationType,
    ComparisonOperator: n.ComparisonOperator,
    Threshold: n.Threshold,
    ThresholdType: n.ThresholdType ?? "PERCENTAGE",
});
const toNotification = (n) => ({
    NotificationType: n.notificationType,
    ComparisonOperator: n.comparisonOperator,
    Threshold: n.threshold,
    ThresholdType: n.thresholdType ?? "PERCENTAGE",
});
/**
 * Distilled marks `Subscriber.Address` sensitive, so observed subscribers
 * come back as `Redacted` — unwrap before diffing, or every observed
 * subscriber compares as `<redacted>` and gets torn down (and deleting the
 * last subscriber deletes the whole notification).
 */
const subscriberAddress = (s) => Redacted.isRedacted(s.Address) ? Redacted.value(s.Address) : s.Address;
const subscriberKey = (s) => `${s.SubscriptionType}:${subscriberAddress(s)}`;
export const BudgetProvider = () => Provider.effect(Budget, Effect.gen(function* () {
    const createName = Effect.fn(function* (id, props) {
        return (props.budgetName ??
            (yield* createPhysicalName({ id, maxLength: 100 })));
    });
    const buildBudget = (name, props) => ({
        BudgetName: name,
        BudgetType: props.budgetType ?? "COST",
        TimeUnit: props.timeUnit ?? "MONTHLY",
        BudgetLimit: props.budgetLimit
            ? { Amount: props.budgetLimit.amount, Unit: props.budgetLimit.unit }
            : undefined,
        CostFilters: props.costFilters,
    });
    const syncNotifications = Effect.fn(function* (accountId, name, desired) {
        const current = yield* budgets.describeNotificationsForBudget
            .pages({
            AccountId: accountId,
            BudgetName: name,
        })
            .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => page.Notifications ?? [])), Effect.catchTag("NotFoundException", () => Effect.succeed([])));
        const currentKeys = new Set(current.map(notificationKey));
        const desiredNotifs = desired.map(toNotification);
        const desiredKeys = new Set(desiredNotifs.map(notificationKey));
        for (const n of desired) {
            const notif = toNotification(n);
            const desiredSubscribers = n.subscribers.map((s) => ({
                SubscriptionType: s.subscriptionType,
                Address: s.address,
            }));
            if (!currentKeys.has(notificationKey(notif))) {
                // The notification listing is eventually consistent — right after
                // `createBudget(NotificationsWithSubscribers)` it can come back
                // empty, so an already-created notification surfaces here as a
                // DuplicateRecordException race.
                yield* budgets
                    .createNotification({
                    AccountId: accountId,
                    BudgetName: name,
                    Notification: notif,
                    Subscribers: desiredSubscribers,
                })
                    .pipe(Effect.catchTag("DuplicateRecordException", () => Effect.void));
                continue;
            }
            // The notification already exists — converge its subscribers by
            // diffing the OBSERVED subscriber list against the desired one.
            const observedSubscribers = yield* budgets
                .describeSubscribersForNotification({
                AccountId: accountId,
                BudgetName: name,
                Notification: notif,
            })
                .pipe(Effect.map((r) => r.Subscribers ?? []), Effect.catchTag("NotFoundException", () => Effect.succeed([])));
            const observedKeys = new Set(observedSubscribers.map(subscriberKey));
            const desiredSubKeys = new Set(desiredSubscribers.map(subscriberKey));
            // Create before delete so the notification never drops to zero
            // subscribers (the API requires at least one).
            for (const s of desiredSubscribers) {
                if (observedKeys.has(subscriberKey(s)))
                    continue;
                yield* budgets
                    .createSubscriber({
                    AccountId: accountId,
                    BudgetName: name,
                    Notification: notif,
                    Subscriber: s,
                })
                    .pipe(Effect.catchTag("DuplicateRecordException", () => Effect.void));
            }
            for (const s of observedSubscribers) {
                if (desiredSubKeys.has(subscriberKey(s)))
                    continue;
                yield* budgets
                    .deleteSubscriber({
                    AccountId: accountId,
                    BudgetName: name,
                    Notification: notif,
                    Subscriber: s,
                })
                    .pipe(Effect.catchTag("NotFoundException", () => Effect.void));
            }
        }
        for (const n of current) {
            if (desiredKeys.has(notificationKey(n)))
                continue;
            yield* budgets
                .deleteNotification({
                AccountId: accountId,
                BudgetName: name,
                Notification: n,
            })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.void));
        }
    });
    const syncTags = Effect.fn(function* (arn, desired) {
        // Diff against OBSERVED cloud tags (not olds/output) so adoption and
        // out-of-band drift converge correctly.
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
    return Budget.Provider.of({
        stables: ["budgetName", "accountId", "budgetArn"],
        list: () => Effect.gen(function* () {
            const { accountId } = yield* AWSEnvironment.current;
            return yield* budgets.describeBudgets
                .pages({ AccountId: accountId })
                .pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk)
                .flatMap((page) => page.Budgets ?? [])
                .map((b) => ({
                budgetName: b.BudgetName,
                accountId,
                budgetArn: budgetArn(accountId, b.BudgetName),
            }))), Effect.catchTag("NotFoundException", () => Effect.succeed([])));
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const { accountId } = yield* AWSEnvironment.current;
            const name = output?.budgetName ?? (yield* createName(id, olds ?? {}));
            const found = yield* budgets
                .describeBudget({ AccountId: accountId, BudgetName: name })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)));
            if (!found?.Budget)
                return undefined;
            return {
                budgetName: name,
                accountId,
                budgetArn: budgetArn(accountId, name),
            };
        }),
        diff: Effect.fn(function* ({ id, news = {}, olds = {} }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createName(id, olds);
            const newName = yield* createName(id, news);
            if (oldName !== newName)
                return { action: "replace" };
        }),
        reconcile: Effect.fn(function* ({ id, news = {}, output, session }) {
            const { accountId } = yield* AWSEnvironment.current;
            const name = output?.budgetName ?? (yield* createName(id, news));
            const internalTags = yield* createInternalTags(id);
            const budgetBody = buildBudget(name, news);
            // OBSERVE — cloud state is authoritative.
            const live = yield* budgets
                .describeBudget({ AccountId: accountId, BudgetName: name })
                .pipe(Effect.map((r) => r.Budget), Effect.catchTag("NotFoundException", () => Effect.succeed(undefined)));
            if (!live) {
                // ENSURE — create; tolerate a DuplicateRecord race.
                yield* budgets
                    .createBudget({
                    AccountId: accountId,
                    Budget: budgetBody,
                    NotificationsWithSubscribers: news.notifications?.map((n) => ({
                        Notification: toNotification(n),
                        Subscribers: n.subscribers.map((s) => ({
                            SubscriptionType: s.subscriptionType,
                            Address: s.address,
                        })),
                    })),
                    ResourceTags: Object.entries({
                        ...news.tags,
                        ...internalTags,
                    }).map(([Key, Value]) => ({ Key, Value })),
                })
                    .pipe(Effect.catchTag("DuplicateRecordException", () => budgets.updateBudget({
                    AccountId: accountId,
                    NewBudget: budgetBody,
                })));
            }
            else {
                // SYNC — updateBudget is a full replace of the budget definition.
                yield* budgets.updateBudget({
                    AccountId: accountId,
                    NewBudget: budgetBody,
                });
            }
            // SYNC notifications — the budget update does not touch these.
            yield* syncNotifications(accountId, name, news.notifications ?? []);
            // SYNC tags against observed cloud tags.
            const arn = budgetArn(accountId, name);
            yield* syncTags(arn, { ...news.tags, ...internalTags });
            yield* session.note(name);
            return { budgetName: name, accountId, budgetArn: arn };
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* budgets
                .deleteBudget({
                AccountId: output.accountId,
                BudgetName: output.budgetName,
            })
                .pipe(Effect.catchTag("NotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=Budget.js.map