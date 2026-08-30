import * as appflow from "@distilled.cloud/aws/appflow";
import * as Layer from "effect/Layer";
import { makeAppFlowHttpBinding } from "./BindingHttp.js";
import { DescribeConnectorEntity } from "./DescribeConnectorEntity.js";
export const DescribeConnectorEntityHttp = Layer.effect(DescribeConnectorEntity, makeAppFlowHttpBinding({
    action: "DescribeConnectorEntity",
    operation: appflow.describeConnectorEntity,
    identifier: (profile) => profile.connectorProfileName,
    requestKey: "connectorProfileName",
    resources: (profile) => [profile.connectorProfileArn],
}));
//# sourceMappingURL=DescribeConnectorEntityHttp.js.map