import * as paymentcryptography from "@distilled.cloud/aws/payment-cryptography";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import { createPhysicalName } from "../../PhysicalName.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
/**
 * A friendly name for an AWS Payment Cryptography {@link Key}. Aliases give
 * keys a stable, human-readable identifier that survives key rotation — the
 * alias can be repointed to a new key without touching consumers.
 * ### Creating Aliases
 * **Example:** Alias attached to a key
 * ```typescript
 * import * as PaymentCryptography from "alchemy/AWS/PaymentCryptography";
 *
 * const key = yield* PaymentCryptography.Key("DataKey", { keyAttributes: { ... } });
 * const alias = yield* PaymentCryptography.Alias("DataKeyAlias", {
 *   keyArn: key.keyArn,
 * });
 * ```
 *
 * **Example:** Alias with an explicit name
 * ```typescript
 * const alias = yield* PaymentCryptography.Alias("DataKeyAlias", {
 *   aliasName: "alias/payments/data-encryption",
 *   keyArn: key.keyArn,
 * });
 * ```
 *
 * @resource
 */
export const Alias = Resource("AWS.PaymentCryptography.Alias");
const toAttrs = (alias) => ({
    aliasName: alias.AliasName,
    keyArn: alias.KeyArn,
});
export const AliasProvider = () => Provider.effect(Alias, Effect.gen(function* () {
    const createAliasName = Effect.fn(function* (id, props) {
        if (props.aliasName) {
            return props.aliasName;
        }
        const baseName = yield* createPhysicalName({
            id,
            maxLength: 256 - "alias/".length,
        });
        return `alias/${baseName}`;
    });
    const observeAlias = Effect.fn(function* (aliasName) {
        return yield* paymentcryptography
            .getAlias({ AliasName: aliasName })
            .pipe(Effect.map((r) => r.Alias), Effect.catchTag("ResourceNotFoundException", () => Effect.succeed(undefined)));
    });
    return Alias.Provider.of({
        stables: ["aliasName"],
        list: () => paymentcryptography.listAliases.items({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).map(toAttrs))),
        read: Effect.fn(function* ({ id, olds, output }) {
            const aliasName = output?.aliasName ?? (yield* createAliasName(id, olds ?? {}));
            const alias = yield* observeAlias(aliasName);
            if (alias === undefined)
                return undefined;
            return toAttrs(alias);
        }),
        diff: Effect.fn(function* ({ id, news, olds }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createAliasName(id, olds);
            const newName = yield* createAliasName(id, news);
            if (oldName !== newName) {
                return { action: "replace" };
            }
            // fall through: undefined → default update (keyArn repoint)
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            const aliasName = output?.aliasName ?? (yield* createAliasName(id, news));
            // 1. Observe — cloud state is authoritative.
            let alias = yield* observeAlias(aliasName);
            // 2. Ensure — create when missing; a concurrent create surfaces as
            //    ConflictException, which resolves by re-observing.
            if (alias === undefined) {
                alias = yield* paymentcryptography
                    .createAlias({ AliasName: aliasName, KeyArn: news.keyArn })
                    .pipe(Effect.map((r) => r.Alias), Effect.catchTag("ConflictException", () => paymentcryptography
                    .getAlias({ AliasName: aliasName })
                    .pipe(Effect.map((r) => r.Alias))));
            }
            // 3. Sync — repoint the alias when the observed target differs
            //    from the desired one (including detaching).
            if (alias.KeyArn !== news.keyArn) {
                alias = yield* paymentcryptography
                    .updateAlias({ AliasName: aliasName, KeyArn: news.keyArn })
                    .pipe(Effect.map((r) => r.Alias));
            }
            yield* session.note(aliasName);
            return toAttrs(alias);
        }),
        delete: Effect.fn(function* ({ output }) {
            yield* paymentcryptography
                .deleteAlias({ AliasName: output.aliasName })
                .pipe(Effect.catchTag("ResourceNotFoundException", () => Effect.void));
        }),
    });
}));
//# sourceMappingURL=Alias.js.map