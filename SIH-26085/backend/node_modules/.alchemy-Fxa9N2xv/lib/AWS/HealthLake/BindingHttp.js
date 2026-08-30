import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.js";
import * as Output from "../../Output.js";
import { isBindingHost } from "../Lambda/Function.js";
/**
 * Shared scaffolding for AWS HealthLake HTTP bindings.
 *
 * NOT exported from `index.ts` — every `{Op}Http.ts` in this service is a
 * thin `Layer.effect(Cap, make…HttpBinding({ … }))` over one of the builders
 * below. Everything except the operation and the IAM action list is
 * boilerplate: every HealthLake job operation is scoped to one FHIR data
 * store, whose id is injected as `DatastoreId` and whose ARN receives the
 * grant. The `Start*Job` operations additionally inject the bound
 * data-access role and a scoped `iam:PassRole` grant.
 */
/**
 * Build the impl Effect for a data-store-scoped HealthLake operation
 * (describe/list import and export jobs): the runtime callable injects the
 * bound {@link FHIRDatastore}'s id as `DatastoreId` and the deploy-time half
 * grants `actions` on the data store ARN.
 */
export const makeHealthLakeDatastoreHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (datastore) {
        const DatastoreId = yield* datastore.datastoreId;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${datastore}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${datastore.datastoreArn}`],
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${datastore.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                DatastoreId: yield* DatastoreId,
            });
        });
    });
});
/**
 * Build the impl Effect for a HealthLake `Start*Job` operation: the binding
 * is constructed with the {@link FHIRDatastore} **and the data-access role**
 * (the IAM role HealthLake assumes to read/write the S3 locations; its trust
 * policy must allow `healthlake.amazonaws.com`). The runtime callable injects
 * the data store id as `DatastoreId` and the role's ARN as
 * `DataAccessRoleArn`; the deploy-time half grants `actions` on the data
 * store ARN plus `iam:PassRole` on the role — without the PassRole grant,
 * `Start*Job` fails only at runtime with an AccessDeniedException.
 */
export const makeHealthLakeStartJobHttpBinding = (options) => Effect.gen(function* () {
    const op = yield* options.operation;
    return Effect.fn(function* (datastore, dataAccessRole) {
        const DatastoreId = yield* datastore.datastoreId;
        const RoleArn = yield* dataAccessRole.roleArn;
        if (!globalThis.__ALCHEMY_RUNTIME__) {
            const host = yield* Binding.Host;
            if (isBindingHost(host)) {
                yield* host.bind `Allow(${host}, ${options.tag}(${datastore}, ${dataAccessRole}))`({
                    policyStatements: [
                        {
                            Effect: "Allow",
                            Action: [...options.actions],
                            Resource: [Output.interpolate `${datastore.datastoreArn}`],
                        },
                        // CRITICAL: without iam:PassRole on the data-access role,
                        // Start*Job fails only at runtime with an AccessDenied.
                        {
                            Effect: "Allow",
                            Action: ["iam:PassRole"],
                            Resource: [Output.interpolate `${dataAccessRole.roleArn}`],
                            Condition: {
                                StringEquals: {
                                    "iam:PassedToService": "healthlake.amazonaws.com",
                                },
                            },
                        },
                    ],
                });
            }
        }
        return Effect.fn(`${options.tag}(${datastore.LogicalId})`)(function* (request) {
            return yield* op({
                ...request,
                DatastoreId: yield* DatastoreId,
                DataAccessRoleArn: request.DataAccessRoleArn ?? (yield* RoleArn),
            });
        });
    });
});
//# sourceMappingURL=BindingHttp.js.map