import * as Binding from "../../Binding.js";
export const CodeHookEventSource = Binding.Service("AWS.LexV2.CodeHookEventSource");
/**
 * Handle an Amazon Lex V2 code hook (dialog + fulfillment) for a bot alias
 * locale with the current Lambda function.
 *
 * Provide `LexV2.LambdaCodeHookEventSource` on the hosting function to
 * satisfy the requirement.
 *
 * @param alias The bot alias whose code hook to handle.
 * @param props The alias locale to attach to.
 * @param handler Invoked once per code hook event; the returned value is
 * the response Lex receives.
 *
 * @example Close every fulfilled intent with a message
 * ```typescript
 * yield* LexV2.onCodeHook(alias, { localeId: "en_US" }, (event) =>
 *   Effect.succeed(LexV2.fulfillIntent(event, { message: "Done!" })),
 * );
 * ```
 */
export function onCodeHook(alias, props, handler) {
    return CodeHookEventSource.use((source) => source(alias, props, handler));
}
/**
 * Build a valid code hook response that closes the event's active intent as
 * `Fulfilled` (or `Failed`), optionally relaying a plain-text message —
 * the common shape for a fulfillment code hook.
 *
 * @example Fulfillment hook that confirms the order
 * ```typescript
 * yield* LexV2.onCodeHook(alias, { localeId: "en_US" }, (event) =>
 *   Effect.succeed(
 *     LexV2.fulfillIntent(event, { message: "Your order is placed." }),
 *   ),
 * );
 * ```
 */
export const fulfillIntent = (event, options) => ({
    sessionState: {
        ...event.sessionState,
        dialogAction: { type: "Close" },
        intent: {
            ...event.sessionState.intent,
            state: options?.state ?? "Fulfilled",
        },
    },
    ...(options?.message !== undefined
        ? {
            messages: [
                { contentType: "PlainText", content: options.message },
            ],
        }
        : {}),
});
//# sourceMappingURL=CodeHookEventSource.js.map