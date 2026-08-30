import * as apprunner from "@distilled.cloud/aws/apprunner";
import { makeAppRunnerHttpBinding } from "./BindingHttp.js";
import { DescribeCustomDomains } from "./DescribeCustomDomains.js";
/**
 * HTTP implementation of the {@link DescribeCustomDomains} binding. Calls
 * `apprunner:DescribeCustomDomains` with the Lambda's IAM role, scoped to
 * the bound service.
 */
export const DescribeCustomDomainsHttp = makeAppRunnerHttpBinding(DescribeCustomDomains, {
    operation: apprunner.describeCustomDomains,
    spec: (service) => ({
        identifiers: { ServiceArn: service.serviceArn },
        iam: () => ({
            actions: ["apprunner:DescribeCustomDomains"],
            resources: [service.serviceArn],
        }),
    }),
});
//# sourceMappingURL=DescribeCustomDomainsHttp.js.map