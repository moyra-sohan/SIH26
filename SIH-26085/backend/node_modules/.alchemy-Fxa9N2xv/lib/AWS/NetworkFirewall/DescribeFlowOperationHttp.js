import * as nfw from "@distilled.cloud/aws/network-firewall";
import * as Layer from "effect/Layer";
import { makeNetworkFirewallFirewallHttpBinding } from "./BindingHttp.js";
import { DescribeFlowOperation } from "./DescribeFlowOperation.js";
export const DescribeFlowOperationHttp = Layer.effect(DescribeFlowOperation, makeNetworkFirewallFirewallHttpBinding({
    tag: "AWS.NetworkFirewall.DescribeFlowOperation",
    operation: nfw.describeFlowOperation,
    actions: ["network-firewall:DescribeFlowOperation"],
}));
//# sourceMappingURL=DescribeFlowOperationHttp.js.map