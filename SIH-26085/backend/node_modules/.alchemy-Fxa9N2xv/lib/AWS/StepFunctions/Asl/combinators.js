/**
 * The `Sfn.*` combinators — Effect-mirroring constructors over the ASL AST.
 *
 * Names and semantics track their `Effect` counterparts as closely as the
 * target language allows: `Sfn.gen`, `Sfn.retry`, `Sfn.catchTag`,
 * `Sfn.catchAll`, `Sfn.all`, `Sfn.forEach`, `Sfn.sleep`, `Sfn.when`,
 * `Sfn.match`, `Sfn.succeed`, `Sfn.fail`. Divergences are deliberate:
 * `retry` takes an option bag mirroring the `Schedule.exponential`
 * vocabulary (a real `Schedule` is opaque and cannot be introspected into
 * ASL's `BackoffRate`), and branching goes through `when`/`match` because a
 * compiled program cannot branch on runtime JS.
 */
import * as Duration from "effect/Duration";
import { aslSeconds } from "./compile.js";
import { isSfnEffect as isSfn, make, } from "./Program.js";
/**
 * Invoke a Lambda function as a Task state
 * (`arn:aws:states:::lambda:invoke`). The payload may embed typed `Expr`
 * references and resource `Output`s; the result reference is the function's
 * response payload.
 *
 * Compiling the program emits the `lambda:InvokeFunction` policy statement
 * for the function's exact ARN (and its qualified variants) into the
 * collected `policyStatements`.
 */
export const invoke = (fn, payload) => make({ kind: "invoke", fn, payload });
/**
 * Call an optimized service integration as a Task state, e.g.
 * `arn:aws:states:::sqs:sendMessage`. Provide the exact-ARN policy
 * statements the execution role needs.
 */
export const integrate = (options) => make({ kind: "integrate", options, waitForTaskToken: false });
/**
 * Call a service integration with the `.waitForTaskToken` callback pattern:
 * the state parks until `SendTaskSuccess`/`SendTaskFailure` is called with
 * the token. Embed {@link taskToken} (re-exported as `Sfn.taskToken`) in the
 * arguments to hand the token to the callback side; the result is the JSON
 * given to `SendTaskSuccess`.
 */
export const waitForTaskToken = (options) => make({ kind: "integrate", options, waitForTaskToken: true });
/**
 * Run programs in parallel (an ASL `Parallel` state) — mirrors
 * `Effect.all`. The result is the tuple of branch results.
 */
export const all = (branches) => make({ kind: "all", branches });
/**
 * Apply `body` to every element of `items` (an ASL inline `Map` state) —
 * mirrors `Effect.forEach`, including the `concurrency` option
 * (`MaxConcurrency`). The result is the array of iteration results.
 */
export const forEach = (items, body, options) => make({
    kind: "forEach",
    items: items,
    body: body,
    options: options ?? {},
});
/**
 * Pause the workflow (an ASL `Wait` state) — mirrors `Effect.sleep`.
 * Durations round up to whole seconds (ASL's granularity).
 */
export const sleep = (duration) => make({
    kind: "sleep",
    seconds: Math.max(1, Math.ceil(Duration.toSeconds(duration))),
});
/**
 * Branch on a typed condition (an ASL `Choice` state) — mirrors
 * `Effect.if`. Build conditions with the typed comparators (`Sfn.eq`,
 * `Sfn.gt`, `Sfn.and`, …). When `onFalse` is omitted the false branch
 * produces `null`.
 */
export const when = (condition, onTrue, onFalse) => make({ kind: "when", condition, onTrue, onFalse });
/**
 * Branch on a value's literal cases (an ASL `Choice` state with one rule
 * per case) — mirrors `Effect.match`-style dispatch. With no `otherwise`
 * and no matching case the execution fails with `States.NoChoiceMatched`.
 */
export const match = (value, cases, otherwise) => make({ kind: "match", value, cases, otherwise });
/**
 * Produce a value (an ASL `Pass` state) — mirrors `Effect.succeed`. The
 * value may embed typed `Expr` references from earlier steps.
 */
export const succeed = (value) => make({ kind: "succeed", value });
/**
 * Fail the workflow with a tagged error (an ASL `Fail` state) — mirrors
 * `Effect.fail`. The error's `_tag` becomes the ASL `Error` name, so
 * `Sfn.catchTag(program, tag, …)` and `Sfn.retry({ while: [tag] })` line up
 * with it end-to-end.
 */
export const fail = (error, cause) => make({
    kind: "fail",
    error: error._tag,
    cause: cause ?? error.message ?? error._tag,
    failure: error,
});
/**
 * Retry a program on failure (ASL `Retry`) — mirrors `Effect.retry`, with
 * an option bag in the `Schedule.exponential` vocabulary (`initial`,
 * `backoff`, `maxAttempts`, `maxDelay`, `jitter`; `while` takes error
 * tags). Multi-state programs are wrapped in a single-branch `Parallel`
 * state so the whole program re-runs, matching `Effect.retry` semantics.
 */
export const retry = ((selfOrOptions, options) => isSfn(selfOrOptions)
    ? make({ kind: "retry", inner: selfOrOptions, options: options ?? {} })
    : (self) => make({ kind: "retry", inner: self, options: selfOrOptions }));
/**
 * Catch failures by tag (ASL `Catch` with `ErrorEquals`) — mirrors
 * `Effect.catchTag`, narrowing `E` exactly the same way. The handler
 * receives a typed reference to the ASL error output (`{ Error, Cause }`).
 */
export const catchTag = ((...args) => isSfn(args[0])
    ? make({
        kind: "catch",
        inner: args[0],
        tags: Array.isArray(args[1]) ? args[1] : [args[1]],
        handler: args[2],
    })
    : (self) => make({
        kind: "catch",
        inner: self,
        tags: Array.isArray(args[0]) ? args[0] : [args[0]],
        handler: args[1],
    }));
/**
 * Catch every failure (ASL `Catch` with `States.ALL`) — mirrors
 * `Effect.catchAll`.
 */
export const catchAll = ((...args) => isSfn(args[0])
    ? make({
        kind: "catch",
        inner: args[0],
        tags: ["States.ALL"],
        handler: args[1],
    })
    : (self) => make({
        kind: "catch",
        inner: self,
        tags: ["States.ALL"],
        handler: args[0],
    }));
/** The `States.*` built-in error names, for `retry`/`catchTag`. */
export const Errors = {
    ALL: "States.ALL",
    Timeout: "States.Timeout",
    TaskFailed: "States.TaskFailed",
    Permissions: "States.Permissions",
    BranchFailed: "States.BranchFailed",
    NoChoiceMatched: "States.NoChoiceMatched",
    IntrinsicFailure: "States.IntrinsicFailure",
    ExceedToleratedFailureThreshold: "States.ExceedToleratedFailureThreshold",
    ItemReaderFailed: "States.ItemReaderFailed",
    ResultWriterFailed: "States.ResultWriterFailed",
    HeartbeatTimeout: "States.HeartbeatTimeout",
    QueryEvaluationError: "States.QueryEvaluationError",
    Runtime: "States.Runtime",
};
//# sourceMappingURL=combinators.js.map