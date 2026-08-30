import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { SingleShotGen } from "effect/Utils";
import * as CoreBinding from "../../Binding.js";
import { ProviderModePolicy } from "../../ProviderMode.js";
import { taggedFunction } from "../../Util/effect.js";
/**
 * Build the fused tag + callable value for a Worker-only binding.
 *
 * `Self` (the per-binding interface) supplies the tag `id` (`Self["key"]`); the
 * binding's `Payload` (extra fields beyond `name`, e.g. RateLimit's
 * `namespaceId`/`simple`) is inferred from `parse`. Omit `parse` for name-only
 * bindings — `name` is read from the first arg's `.name` property.
 */
export const Service = (config) => {
    const tag = CoreBinding.Service(config.id);
    const bind = tag;
    const make = (data) => {
        const self = { ...data };
        self.toWorkerBinding = () => config.toWorkerBinding(self);
        self.asEffect = () => bind(self);
        self[Symbol.iterator] = () => new SingleShotGen(bind(self));
        // The lifted form (`BindingEffect`): capture the ambient
        // `ProviderModePolicy` (`Alchemy.remote()` decoration), then resolve
        // context-adaptively — to the runtime client when the binding's layer is
        // in context (inside an Effect-native Worker), to the decorated binding
        // value otherwise (an async Worker's `env`, resolved by the engine).
        const lifted = Effect.gen(function* () {
            const policy = yield* ProviderModePolicy;
            const decorated = policy === undefined || policy === !!data.devRemote
                ? self
                : make({ ...data, devRemote: policy || undefined });
            const impl = yield* Effect.serviceOption(tag);
            return Option.isSome(impl)
                ? yield* impl.value(decorated)
                : decorated;
        });
        self.pipe = (...fns) => fns.reduce((acc, fn) => fn(acc), lifted);
        return self;
    };
    const construct = (...args) => {
        const { name, ...payload } = config.parse?.(...args) ??
            { name: args[0] };
        return make({
            kind: config.id,
            name: name ?? config.defaultName,
            ...payload,
        });
    };
    return taggedFunction(tag, construct);
};
/** Structural guard for any Worker-only {@link Binding}. */
export const isBinding = (value) => typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    typeof value.toWorkerBinding ===
        "function" &&
    typeof value[Symbol.iterator] ===
        "function";
//# sourceMappingURL=Binding.js.map