/// <reference types="@cloudflare/workers-types" />
import * as Effect from "effect/Effect";
import { makeLanguageModelLayer } from "../AI/LanguageModel.js";
import { AI, WorkersAIError } from "./AI.js";
import * as Binding from "./Binding.js";
import { makeBindingLayer } from "./BindingLayer.js";
/**
 * The layer that provides the Effect-native interface for the Cloudflare
 * Workers AI binding.
 *
 * Provide it on the Worker effect (`Effect.provide(Cloudflare.Workers.AIBinding)`)
 * so that yielding an {@link AI} binding attaches the native `ai` binding to
 * the surrounding Worker at deploy time and, at runtime, resolves to the
 * Effect-native {@link AIClient} (wrapping the raw `Ai` handle so `run` /
 * `models` return Effects and `model(...)` yields a `LanguageModel` layer).
 */
export const AIBinding = makeBindingLayer(AI, (raw) => {
    const self = {
        raw,
        run: (model, inputs, options) => Effect.gen(function* () {
            const ai = yield* raw;
            return yield* tryPromise(() => ai.run(model, inputs, options));
        }),
        models: (params) => Effect.gen(function* () {
            const ai = yield* raw;
            return yield* tryPromise(() => ai.models(params));
        }),
        model: (options) => makeLanguageModelLayer({
            ...options,
            client: self,
        }),
    };
    return self;
});
const tryPromise = (fn) => Effect.tryPromise({
    try: fn,
    catch: (error) => new WorkersAIError({
        message: error instanceof Error
            ? error.message
            : "Unknown Workers AI runtime error",
        cause: error,
    }),
});
//# sourceMappingURL=AIBinding.js.map