import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS Backup HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the two
 * builders below. Everything except the operation, the IAM action list, and
 * (for vault-scoped operations) the injected `BackupVaultName` is
 * boilerplate. The three `Start*Job` bindings inject an IAM role and a
 * PassRole grant, so they stay bespoke.
 */
/**
 * Build the impl Effect for an account-level operation (job monitoring,
 * protected-resource discovery, restore orchestration). The deploy-time half
 * grants `actions` on `*` — backup job / restore job / copy job IAM actions
 * do not support resource-level scoping.
 */
export const makeBackupAccountHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* () {
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}())`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: ["*"],
                        },
                    ],
                });
            }
        }
        return Effect.fn(options.tag)(function* (request) {
            return yield* op((request ?? {}));
        });
    });
});
/**
 * Build the impl Effect for a vault-scoped operation: the runtime callable
 * injects the bound {@link BackupVault}'s name as `BackupVaultName` and the
 * deploy-time half grants `actions` on the vault ARN (or `*` for
 * recovery-point actions, which authorize on the recovery point's underlying
 * resource ARN — an EBS/RDS snapshot ARN — and cannot be scoped to the
 * vault).
 */
export const makeBackupVaultHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (vault) {
        const BackupVaultName = yield* vault.backupVaultName;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${vault}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: options.wildcardIam
                                ? ["*"]
                                : [Output.interpolate `${vault.backupVaultArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${vault.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                BackupVaultName: yield* BackupVaultName,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map