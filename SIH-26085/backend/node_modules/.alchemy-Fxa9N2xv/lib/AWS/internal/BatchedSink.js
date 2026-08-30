import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as Sink from "effect/Sink";
/**
 * Raised when a batch API keeps reporting entries as unprocessed after the
 * bounded retry schedule is exhausted. Carries the stranded entries (in input
 * order) so callers can decide what to do with them (DLQ, die, drop).
 */
export class BatchRetryExhaustedError extends Data.TaggedError("BatchRetryExhaustedError") {
}
/**
 * The shared engine behind every AWS batch-API sink (`SQS.QueueSink`,
 * `SNS.TopicSink`, `Kinesis.StreamSink`, ...).
 *
 * Semantics:
 * - each upstream chunk is split into `<= maxRecords` / `<= maxBytes` batches
 *   **preserving input order**;
 * - batches are sent **sequentially** (order-preservation is the default);
 * - after each `send`, the `rejected` subset is surfaced via `onRejected` and
 *   dropped, and the `unprocessed` subset is re-submitted (in order) on the
 *   bounded `retrySchedule`;
 * - exhausting retries fails the sink with a typed
 *   {@link BatchRetryExhaustedError} carrying the stranded entries.
 *
 * Internal — NOT exported from the `AWS` barrel.
 */
export const makeBatchedSink = (options) => {
    const schedule = options.retrySchedule ??
        Schedule.max([Schedule.recurs(5), Schedule.exponential("200 millis")]);
    const onRejected = options.onRejected ??
        ((entries) => Effect.logWarning(`BatchedSink dropped ${entries.length} permanently rejected entr${entries.length === 1 ? "y" : "ies"}`));
    // One attempt over the currently-pending subset. Returns the entries that
    // are still unprocessed after this attempt (empty = converged).
    const attempt = (pendingRef) => Effect.gen(function* () {
        const pending = yield* Ref.get(pendingRef);
        if (pending.length === 0) {
            return pending;
        }
        const out = yield* options.send(pending);
        const rejected = options.rejected?.(out, pending) ?? [];
        if (rejected.length > 0) {
            yield* onRejected(rejected);
        }
        const remaining = options.unprocessed?.(out, pending) ?? [];
        yield* Ref.set(pendingRef, remaining);
        return remaining;
    });
    const flushBatch = (batch) => Effect.gen(function* () {
        const pendingRef = yield* Ref.make(batch);
        yield* repeatWhilePending(attempt(pendingRef), schedule);
        const stranded = yield* Ref.get(pendingRef);
        if (stranded.length > 0) {
            return yield* new BatchRetryExhaustedError({ entries: stranded });
        }
    });
    return Sink.forEachArray((chunk) => Effect.gen(function* () {
        const batches = yield* Effect.sync(() => packBatches(chunk, options));
        yield* Effect.forEach(batches, flushBatch, { discard: true });
    }));
};
/**
 * Re-runs `step` (which re-submits the pending subset) on the bounded
 * schedule until it reports nothing left to send.
 *
 * Extracted with an explicit return type so `Repeat.Return`'s conditional
 * type never leaks into declaration emit (see PATTERNS §7 on inlined
 * retry/repeat poisoning `.d.ts` inference).
 */
const repeatWhilePending = (step, schedule) => Effect.repeat(step, {
    schedule,
    until: (remaining) => remaining.length === 0,
});
/** Greedily pack a chunk into `<= maxRecords` / `<= maxBytes` batches, preserving order. */
const packBatches = (chunk, options) => {
    const { maxBytes, maxRecords, sizeOf } = options;
    const batches = [];
    let current = [];
    let currentBytes = 0;
    for (const record of chunk) {
        const size = sizeOf?.(record) ?? 0;
        const overRecords = current.length >= maxRecords;
        const overBytes = maxBytes !== undefined &&
            current.length > 0 &&
            currentBytes + size > maxBytes;
        if (overRecords || overBytes) {
            batches.push(current);
            current = [];
            currentBytes = 0;
        }
        // A single record larger than maxBytes still ships alone; the API
        // rejects it and the error surfaces through the sink's error channel.
        current.push(record);
        currentBytes += size;
    }
    if (current.length > 0) {
        batches.push(current);
    }
    return batches;
};
//# sourceMappingURL=BatchedSink.js.map