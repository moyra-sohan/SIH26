import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { AWSEnvironment } from "../Environment.js";
import { makeBatchedSink } from "../internal/BatchedSink.js";
import { isBindingHost } from "../Lambda/Function.js";
import { BusSink } from "./BusSink.js";
import { PutEvents } from "./PutEvents.js";
const encoder = new TextEncoder();
/**
 * Approximate wire size of one entry, per AWS's documented calculation:
 * 14 bytes if `Time` is specified, plus the UTF-8 byte lengths of `Source`,
 * `DetailType`, `Detail`, and each entry in `Resources`.
 */
const entrySize = (entry) => {
    let size = entry.Time !== undefined ? 14 : 0;
    if (entry.Source !== undefined) {
        size += encoder.encode(entry.Source).length;
    }
    if (entry.DetailType !== undefined) {
        size += encoder.encode(entry.DetailType).length;
    }
    if (entry.Detail !== undefined) {
        size += encoder.encode(entry.Detail).length;
    }
    for (const resource of entry.Resources ?? []) {
        size += encoder.encode(resource).length;
    }
    return size;
};
/**
 * Per-entry error codes EventBridge documents as retryable. Every other
 * `ErrorCode` (`MalformedDetail`, `AccessDeniedException`, ...) is permanent.
 */
const TRANSIENT_ERROR_CODES = new Set([
    "ThrottlingException",
    "InternalFailure",
]);
/**
 * Select the original entries whose positional `PutEventsResultEntry` carries
 * an `ErrorCode` of the given transience, preserving input order (the result
 * `Entries` array is aligned index-for-index with the request entries).
 */
const selectFailed = (out, batch, transient) => {
    const results = out.Entries;
    if (results === undefined || (out.FailedEntryCount ?? 0) === 0) {
        return [];
    }
    return batch.filter((_, index) => {
        const code = results[index]?.ErrorCode;
        return code !== undefined && TRANSIENT_ERROR_CODES.has(code) === transient;
    });
};
/**
 * HTTP implementation of {@link BusSink}. At deploy time it grants
 * `events:PutEvents` on the bound bus (or the default bus); at runtime it
 * batches stream elements into `PutEvents` calls (10 entries / 256 KiB) with
 * bounded retry of transient per-entry failures. Provide this layer on the
 * Function using the sink.
 */
export const BusSinkHttp = Layer.effect(BusSink, Effect.gen(function* () {
    const putEvents = yield* PutEvents;
    return Effect.fn(function* (bus) {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                const { accountId, region } = yield* AWSEnvironment.current;
                // Pass the ARN as an unresolved Output — binding data is resolved
                // by the engine before the host reconciles (see PutEventsHttp).
                const resource = bus
                    ? Output.interpolate `${bus.eventBusArn}`
                    : `arn:aws:events:${region}:${accountId}:event-bus/default`;
                yield* host.bind `Allow(${host}, AWS.EventBridge.BusSink(${bus ?? "default"}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: ["events:PutEvents"],
                            Resource: [resource],
                        },
                    ],
                });
            }
        }
        const put = yield* putEvents(bus);
        return makeBatchedSink({
            maxRecords: 10,
            maxBytes: 262_144,
            sizeOf: entrySize,
            send: (batch) => put({ Entries: [...batch] }),
            // ThrottlingException / InternalFailure are transient — re-submit
            // them on the bounded schedule.
            unprocessed: (out, batch) => selectFailed(out, batch, true),
            // Any other per-entry ErrorCode (e.g. MalformedDetail) is permanent —
            // drop and surface.
            rejected: (out, batch) => selectFailed(out, batch, false),
        });
    });
}));
//# sourceMappingURL=BusSinkHttp.js.map