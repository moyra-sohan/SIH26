import * as ec2 from "@distilled.cloud/aws/ec2";
import * as Effect from "effect/Effect";
/**
 * Resolve the default VPC (if any) for the ambient account/region.
 */
export const getDefaultVpcScope = ec2
    .describeVpcs({ Filters: [{ Name: "isDefault", Values: ["true"] }] })
    .pipe(Effect.map((r) => {
    const vpc = (r.Vpcs ?? []).find((v) => v.IsDefault);
    return { vpcId: vpc?.VpcId, dhcpOptionsId: vpc?.DhcpOptionsId };
}));
/**
 * The GroupId of the default VPC's "default" security group, or `undefined`
 * when the account has no default VPC. Rules on this group are AWS-provisioned
 * furniture; rules on user-created groups inside the default VPC are not.
 */
export const getDefaultVpcDefaultSecurityGroupId = (vpcId) => vpcId === undefined
    ? Effect.succeed(undefined)
    : ec2
        .describeSecurityGroups({
        Filters: [
            { Name: "vpc-id", Values: [vpcId] },
            { Name: "group-name", Values: ["default"] },
        ],
    })
        .pipe(Effect.map((r) => r.SecurityGroups?.[0]?.GroupId));
//# sourceMappingURL=defaultVpcScope.js.map