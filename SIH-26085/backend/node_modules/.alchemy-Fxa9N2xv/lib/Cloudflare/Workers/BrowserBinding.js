import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Binding from "./Binding.js";
import { makeBindingLayer } from "./BindingLayer.js";
import { Browser, BrowserError, } from "./Browser.js";
/**
 * The layer that provides the Effect-native interface for the Cloudflare
 * Workers Browser Rendering binding.
 *
 * Provide it on the Worker effect (`Effect.provide(Cloudflare.Workers.BrowserBinding)`)
 * so that yielding a {@link Browser} binding attaches the native `browser`
 * binding to the surrounding Worker at deploy time and, at runtime, resolves to
 * the Effect-native {@link BrowserClient}.
 */
export const BrowserBinding = makeBindingLayer(Browser, (raw) => {
    const respond = (action, options) => raw.pipe(Effect.flatMap((binding) => tryPromise(() => binding.quickAction(action, options))), Effect.flatMap((response) => response.ok ? Effect.succeed(response) : failResponse(action, response)));
    const jsonAction = (action, options) => respond(action, options).pipe(Effect.flatMap((response) => tryPromise(() => response.json())));
    const streamAction = (action, options) => respond(action, options).pipe(Effect.map((response) => Stream.fromReadableStream({
        evaluate: () => response.body,
        onError: (cause) => new BrowserError({
            message: `Browser Rendering '${action}' stream failed`,
            cause,
        }),
    })), Stream.unwrap);
    const quickAction = ((action, options) => BINARY_ACTIONS.has(action)
        ? streamAction(action, options)
        : jsonAction(action, options));
    return {
        raw,
        fetch: (...args) => raw.pipe(Effect.flatMap((binding) => tryPromise(() => binding.fetch(...args)))),
        quickAction,
        screenshot: (options) => streamAction("screenshot", options),
        pdf: (options) => streamAction("pdf", options),
        content: (options) => jsonAction("content", options),
        scrape: (options) => jsonAction("scrape", options),
        links: (options) => jsonAction("links", options),
        snapshot: (options) => jsonAction("snapshot", options),
        json: (options) => jsonAction("json", options),
        markdown: (options) => jsonAction("markdown", options),
    };
});
/** Actions whose successful response is raw binary rather than JSON. */
const BINARY_ACTIONS = new Set(["screenshot", "pdf"]);
/** Build a {@link BrowserError} from a non-success Browser Run response. */
const failResponse = (action, response) => tryPromise(() => response.text()).pipe(Effect.flatMap((body) => {
    let cause = body;
    try {
        cause = JSON.parse(body);
    }
    catch {
        // keep the raw text as the cause
    }
    const message = cause?.errors?.[0]
        ?.message ??
        `Browser Rendering '${action}' failed with status ${response.status}`;
    return Effect.fail(new BrowserError({ message, cause }));
}));
const tryPromise = (fn) => Effect.tryPromise({
    try: fn,
    catch: (error) => new BrowserError({
        message: error instanceof Error
            ? error.message
            : "Unknown Browser Rendering error",
        cause: error,
    }),
});
//# sourceMappingURL=BrowserBinding.js.map