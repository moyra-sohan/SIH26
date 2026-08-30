import * as apprunner from "@distilled.cloud/aws/apprunner";
import { AssociateCustomDomain } from "./AssociateCustomDomain.js";
import { makeAppRunnerHttpBinding } from "./BindingHttp.js";
/**
 * HTTP implementation of the {@link AssociateCustomDomain} binding. Calls
 * `apprunner:AssociateCustomDomain` with the Lambda's IAM role, scoped to
 * the bound service.
 */
export const AssociateCustomDomainHttp = makeAppRunnerHttpBinding(AssociateCustomDomain, {
    operation: apprunner.associateCustomDomain,
    spec: (service) => ({
        identifiers: { ServiceArn: service.serviceArn },
        iam: () => ({
            actions: ["apprunner:AssociateCustomDomain"],
            resources: [service.serviceArn],
        }),
    }),
});
//# sourceMappingURL=AssociateCustomDomainHttp.js.map