import * as Data from "effect/Data";
import * as Binding from "./Binding.js";
const TypeId = "Cloudflare.Browser";
export class BrowserError extends Data.TaggedError("BrowserError") {
}
export const Browser = Binding.Service({
    id: TypeId,
    defaultName: "BROWSER",
    toWorkerBinding: (binding) => ({
        type: "browser",
        name: binding.name,
    }),
});
export const isBrowser = (value) => Binding.isBinding(value) && value.kind === TypeId;
//# sourceMappingURL=Browser.js.map