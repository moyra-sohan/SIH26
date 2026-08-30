import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Build the implementation Effect for an ACM PCA HTTP capability binding.
 *
 * Every ACM PCA capability has the same shape — resolve the CA's ARN,
 * register an IAM policy statement for `acm-pca:{action}` scoped to that
 * CA at deploy time, and return a runtime callable that injects
 * `CertificateAuthorityArn` into the operation's request. Only the
 * operation and the action name differ, so each `{Op}Http.ts` is a thin
 * `Layer.effect(Cap, makeACMPCAHttpBinding({ ... }))`.
 *
 * @internal
 */
export const makeACMPCAHttpBinding = (options) => Effect.gen(function* () {
    const operation = yield* options.operation;
    return Effect.fn(function* (certificateAuthority) {
        const Arn = yield* certificateAuthority.certificateAuthorityArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, AWS.ACMPCA.${options.action}(${certificateAuthority}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [`acm-pca:${options.action}`],
                            Resource: [certificateAuthority.certificateAuthorityArn],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`AWS.ACMPCA.${options.action}(${certificateAuthority.LogicalId})`)(function* (request = {}) {
            return yield* operation({
                ...request,
                CertificateAuthorityArn: yield* Arn,
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map