import * as deadline from "@distilled.cloud/aws/deadline";
import * as Effect from "effect/Effect";
import * as EffectStream from "effect/Stream";
import { Unowned } from "../../AdoptPolicy.js";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { createInternalTags, hasAlchemyTags } from "../../Tags.js";
import { asPlain, deadlineArnOf, fetchDeadlineTags, retryWhileFarmSettling, syncDeadlineTags, } from "./internal.js";
/**
 * An AWS Deadline Cloud budget — tracks a queue's approximate render spend
 * over a fixed window and stops scheduling when thresholds are crossed.
 *
 * ### Creating Budgets
 * **Example:** Queue Budget with Hard Stop
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * const budget = yield* AWS.Deadline.Budget("MonthlyBudget", {
 *   farmId: farm.farmId,
 *   queueId: queue.queueId,
 *   approximateDollarLimit: 100,
 *   actions: [
 *     { type: "STOP_SCHEDULING_AND_COMPLETE_TASKS", thresholdPercentage: 100 },
 *   ],
 *   schedule: {
 *     fixed: {
 *       startTime: "2026-01-01T00:00:00Z",
 *       endTime: "2027-01-01T00:00:00Z",
 *     },
 *   },
 * });
 * ```
 *
 * **Example:** Graduated Thresholds
 * ```typescript
 * // Let in-flight tasks finish at 90%, cancel everything at 100%.
 * const budget = yield* AWS.Deadline.Budget("QueueBudget", {
 *   farmId: farm.farmId,
 *   queueId: queue.queueId,
 *   approximateDollarLimit: 500,
 *   actions: [
 *     { type: "STOP_SCHEDULING_AND_COMPLETE_TASKS", thresholdPercentage: 90 },
 *     { type: "STOP_SCHEDULING_AND_CANCEL_TASKS", thresholdPercentage: 100 },
 *   ],
 *   schedule: {
 *     fixed: {
 *       startTime: "2026-01-01T00:00:00Z",
 *       endTime: "2026-02-01T00:00:00Z",
 *     },
 *   },
 * });
 * ```
 *
 * @resource
 */
export const Budget = Resource("AWS.Deadline.Budget");
const createBudgetName = (id, props) => props.displayName
    ? Effect.succeed(props.displayName)
    : createPhysicalName({ id, maxLength: 100 });
const readBudgetById = Effect.fn(function* (farmId, budgetId, arnOf) {
    const described = yield* deadline
        .getBudget({ farmId, budgetId })
        .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    if (!described)
        return undefined;
    const budgetArn = arnOf(`farm/${farmId}/budget/${described.budgetId}`);
    const state = {
        described,
        attrs: {
            farmId,
            budgetId: described.budgetId,
            budgetArn,
            queueId: described.usageTrackingResource.queueId,
            displayName: described.displayName,
            status: described.status,
            approximateDollarLimit: described.approximateDollarLimit,
            tags: yield* fetchDeadlineTags(budgetArn),
        },
    };
    return state;
});
const findBudgetByDisplayName = Effect.fn(function* (farmId, displayName, arnOf) {
    const summaries = yield* deadline.listBudgets.items({ farmId }).pipe(EffectStream.runCollect, Effect.map((chunk) => Array.from(chunk)), 
    // The parent farm may itself be gone.
    Effect.catchTag("ResourceNotFoundException", () => Effect.succeed([])));
    const match = summaries.find((summary) => summary.displayName === displayName);
    if (!match)
        return undefined;
    return yield* readBudgetById(farmId, match.budgetId, arnOf);
});
const actionKey = (action) => `${action.type}@${action.thresholdPercentage}`;
const toWireSchedule = (schedule) => ({
    fixed: {
        startTime: new Date(schedule.fixed.startTime),
        endTime: new Date(schedule.fixed.endTime),
    },
});
export const BudgetProvider = () => Provider.effect(Budget, Effect.gen(function* () {
    return {
        stables: ["farmId", "budgetId", "budgetArn", "queueId"],
        // Keyed by a parent farm — sub-resource list() convention.
        list: () => Effect.succeed([]),
        read: Effect.fn(function* ({ id, olds, output }) {
            const arnOf = yield* deadlineArnOf;
            const farmId = output?.farmId ?? olds?.farmId;
            if (farmId === undefined)
                return undefined;
            const state = output?.budgetId
                ? yield* readBudgetById(farmId, output.budgetId, arnOf)
                : yield* findBudgetByDisplayName(farmId, yield* createBudgetName(id, olds ?? {}), arnOf);
            if (!state)
                return undefined;
            return (yield* hasAlchemyTags(id, state.attrs.tags))
                ? state.attrs
                : Unowned(state.attrs);
        }),
        diff: Effect.fn(function* ({ news, olds }) {
            if (!isResolved(news))
                return;
            if (olds === undefined)
                return;
            // The parent farm and tracked queue are fixed at creation.
            if (olds.farmId !== news.farmId || olds.queueId !== news.queueId) {
                return { action: "replace" };
            }
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            if (news === undefined) {
                return yield* Effect.fail(new Error("AWS.Deadline.Budget requires props"));
            }
            const arnOf = yield* deadlineArnOf;
            const farmId = news.farmId;
            const displayName = yield* createBudgetName(id, news);
            const internalTags = yield* createInternalTags(id);
            const desiredTags = { ...internalTags, ...news.tags };
            const desiredSchedule = toWireSchedule(news.schedule);
            // Observe.
            let state = output?.budgetId
                ? yield* readBudgetById(farmId, output.budgetId, arnOf)
                : yield* findBudgetByDisplayName(farmId, displayName, arnOf);
            // Ensure.
            if (state === undefined) {
                const created = yield* retryWhileFarmSettling(deadline.createBudget({
                    farmId,
                    displayName,
                    description: news.description,
                    usageTrackingResource: { queueId: news.queueId },
                    approximateDollarLimit: news.approximateDollarLimit,
                    actions: news.actions,
                    schedule: desiredSchedule,
                    tags: desiredTags,
                }));
                yield* session.note(`Created budget ${displayName} (${created.budgetId})`);
                state = yield* readBudgetById(farmId, created.budgetId, arnOf);
                if (state === undefined) {
                    return yield* Effect.fail(new Error(`failed to read created budget ${displayName}`));
                }
            }
            // Sync mutable settings — compute action/schedule deltas from
            // OBSERVED state.
            const described = state.described;
            const observedActions = described.actions.map((action) => ({
                type: action.type,
                thresholdPercentage: action.thresholdPercentage,
            }));
            const observedKeys = new Set(observedActions.map(actionKey));
            const desiredKeys = new Set(news.actions.map(actionKey));
            const actionsToAdd = news.actions.filter((action) => !observedKeys.has(actionKey(action)));
            const actionsToRemove = observedActions.filter((action) => !desiredKeys.has(actionKey(action)));
            const observedSchedule = described.schedule.fixed;
            // Deadline clamps a startTime in the past to the creation instant,
            // so a past desired startTime can never converge — only compare it
            // while it is still in the future.
            const now = yield* Effect.sync(() => Date.now());
            const desiredStart = desiredSchedule.fixed.startTime.getTime();
            const scheduleDrifted = (desiredStart > now &&
                observedSchedule.startTime.getTime() !== desiredStart) ||
                observedSchedule.endTime.getTime() !==
                    desiredSchedule.fixed.endTime.getTime();
            const desiredStatus = news.status ?? described.status;
            const needsUpdate = displayName !== described.displayName ||
                (news.description !== undefined &&
                    news.description !== (asPlain(described.description) ?? "")) ||
                desiredStatus !== described.status ||
                news.approximateDollarLimit !== described.approximateDollarLimit ||
                actionsToAdd.length > 0 ||
                actionsToRemove.length > 0 ||
                scheduleDrifted;
            if (needsUpdate) {
                yield* retryWhileFarmSettling(deadline.updateBudget({
                    farmId,
                    budgetId: state.attrs.budgetId,
                    displayName,
                    description: news.description,
                    status: news.status,
                    approximateDollarLimit: news.approximateDollarLimit,
                    actionsToAdd: actionsToAdd.length > 0 ? actionsToAdd : undefined,
                    actionsToRemove: actionsToRemove.length > 0 ? actionsToRemove : undefined,
                    schedule: scheduleDrifted ? desiredSchedule : undefined,
                }));
                yield* session.note(`Updated budget ${displayName}`);
            }
            // Sync tags — diff against observed cloud tags.
            yield* syncDeadlineTags(state.attrs.budgetArn, desiredTags);
            yield* session.note(state.attrs.budgetArn);
            const final = yield* readBudgetById(farmId, state.attrs.budgetId, arnOf);
            if (!final) {
                return yield* Effect.fail(new Error(`failed to read reconciled budget ${displayName}`));
            }
            return final.attrs;
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* deadline
                .deleteBudget({
                farmId: output.farmId,
                budgetId: output.budgetId,
            })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    };
}));
//# sourceMappingURL=Budget.js.map