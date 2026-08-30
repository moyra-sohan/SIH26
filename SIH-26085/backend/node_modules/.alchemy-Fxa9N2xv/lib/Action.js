import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { makeCaptureContext } from "./ActionRuntimeContext.js";
import { toFqn } from "./FQN.js";
import { CurrentNamespace } from "./Namespace.js";
import * as Output from "./Output.js";
import { RuntimeContext } from "./RuntimeContext.js";
import { Stack } from "./Stack.js";
export const isAction = (value) => typeof value === "object" && value !== null && value?.Kind === "action";
export function Action(...args) {
    if (args.length === 0) {
        // Tagged form: Action<Self, In, Out>()(type)
        return (type) => makeActionClass(type, undefined);
    }
    // Inline form: Action(type, runnerOrInit)
    const [type, initOrRun] = args;
    return makeActionClass(type, initOrRun);
}
const isRunnerEffect = (v) => Effect.isEffect(v);
const makeActionClass = (type, baked) => {
    // Pre-resolve baked init/runner into a single Effect<Runner, _, Req>. Use
    // Effect.cached so the init's body runs at most once per process — every
    // action instance after the first reuses the resolved runner without paying
    // the init cost (or re-yielding its dependencies).
    let resolveRunner;
    if (baked !== undefined) {
        resolveRunner = isRunnerEffect(baked)
            ? Effect.runSync(Effect.cached(baked))
            : Effect.succeed(baked);
    }
    // Tagged form needs a Context tag so the user can supply the runner
    // through a Layer. Inline form bakes the runner in and skips the tag.
    const SelfTag = baked
        ? undefined
        : Context.Service(`alchemy/Action<${type}>`);
    // Outputs referenced via `yield* output` inside the init Effect land here,
    // recorded by the capture RuntimeContext. Shared per definition — the init
    // runs at most once (Effect.cached), so captures are inherently
    // per-definition, matching how the init's `Req` bubbles per definition.
    const captures = {};
    const captureContext = makeCaptureContext(captures);
    const constructor = (...args) => {
        const [id, input] = args.length === 1 ? [type, args[0]] : args;
        return Effect.gen(function* () {
            const run = resolveRunner
                ? yield* resolveRunner.pipe(Effect.provideService(RuntimeContext, captureContext))
                : (yield* SelfTag);
            return yield* registerAction(type, id, input, run, captures);
        });
    };
    const extra = { Type: type };
    if (SelfTag) {
        extra.Self = SelfTag;
        // `.make(initOrRun)` — accepts either a direct runner or an init Effect.
        // For init form we use `Layer.effect` so the init's Req surfaces on the
        // Layer, and run it under the capture RuntimeContext so `yield* output`
        // accessors are recorded just like the inline form; for runners we use
        // `Layer.succeed` (nothing to capture).
        extra.make = (initOrRun) => isRunnerEffect(initOrRun)
            ? Layer.effect(SelfTag, initOrRun.pipe(Effect.provideService(RuntimeContext, captureContext)))
            : Layer.succeed(SelfTag, initOrRun);
    }
    return Object.assign(constructor, extra);
};
const registerAction = (type, id, input, run, captures) => Effect.gen(function* () {
    const stack = yield* Stack;
    const namespace = yield* CurrentNamespace;
    const fqn = toFqn(namespace, id);
    const actions = (stack.actions ??= {});
    const existing = actions[fqn];
    if (existing)
        return Output.of(existing);
    // FQN collision check: actions share the same FQN namespace as resources
    // so the dependency graph stays unified. Rejecting overlaps here makes
    // the constraint obvious at registration time.
    if (stack.resources[fqn]) {
        return yield* Effect.die(new Error(`Action '${fqn}' collides with a Resource of the same logical id`));
    }
    const target = {
        Kind: "action",
        Type: type,
        Namespace: namespace,
        FQN: fqn,
        LogicalId: id,
        Input: input,
        Captures: captures,
        Run: run,
        Output: undefined,
    };
    target.toString = () => `Action<${type}>(${id})`;
    actions[fqn] = target;
    // `yield* Sync({...})` returns `Output<Out>`. The engine writes the
    // materialized value into `tracker[fqn]` during apply; `Output.of(action)`
    // resolves a ResourceExpr by looking up `outputs[fqn]` — which is
    // precisely that materialized value. Property access into the returned
    // Output chains through the standard PropExpr proxy.
    return Output.of(target);
});
//# sourceMappingURL=Action.js.map