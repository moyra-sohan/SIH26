import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as CoreBinding from "../../Binding.js";
import { isWorker, WorkerEnvironment } from "./Worker.js";
/**
 * Native runtime layer for a Worker-only {@link Binding}. Registers the native
 * binding on the host Worker at deploy time (via `binding.toWorkerBinding()`)
 * and builds the Effect-native client from the lazy `env[name]` accessor.
 *
 * Factored out of `Binding.ts` (which must stay free of `Worker.ts` to avoid an
 * import cycle through the contract files). Each binding's layer is a one-liner:
 * `export const XBinding = makeBindingLayer(X, makeXClient)`.
 */
export const makeBindingLayer = (tag, makeClient) => Layer.effect(tag, Effect.gen(function* () {
    const env = yield* WorkerEnvironment;
    return Effect.fn(function* (binding) {
        // Deploy-time only: register the native binding on the host Worker.
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* CoreBinding.Host;
            if (isWorker(host)) {
                yield* host.bind(binding.name, {
                    bindings: [binding.toWorkerBinding()],
                    // Dev-only local-emulation opt-out, contributed as a parallel
                    // channel (like `hyperdrives`) so the wire binding stays pure.
                    ...(binding.devRemote
                        ? { devRemote: { [binding.name]: true } }
                        : {}),
                });
            }
        }
        // Lazy: `WorkerEnvironment` is only populated at exec phase.
        const raw = Effect.sync(() => env[binding.name]);
        return makeClient(raw, binding);
    });
}));
//# sourceMappingURL=BindingLayer.js.map