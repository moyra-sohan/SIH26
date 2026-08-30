import * as nfw from "@distilled.cloud/aws/network-firewall";
import * as Layer from "effect/Layer";
import { makeNetworkFirewallFirewallHttpBinding } from "./BindingHttp.js";
import { DescribeFirewall } from "./DescribeFirewall.js";
export const DescribeFirewallHttp = Layer.effect(DescribeFirewall, makeNetworkFirewallFirewallHttpBinding({
    tag: "AWS.NetworkFirewall.DescribeFirewall",
    operation: nfw.describeFirewall,
    actions: ["network-firewall:DescribeFirewall"],
}));
//# sourceMappingURL=DescribeFirewallHttp.js.map