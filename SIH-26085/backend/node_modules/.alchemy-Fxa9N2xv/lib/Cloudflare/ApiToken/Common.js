import { PERMISSION_GROUPS_BY_NAME, } from "./PermissionGroups.js";
/**
 * Collect the policies a token should be created with: those passed directly
 * as props, plus those contributed by bindings.
 */
export const collectPolicies = (props, bindings) => [
    ...(props ?? []),
    ...bindings.flatMap((binding) => binding.data.policies ?? []),
];
export const resolvePermissionGroup = (ref) => {
    if (typeof ref === "string") {
        const group = PERMISSION_GROUPS_BY_NAME[ref];
        if (!group) {
            // Should be unreachable due to the typed union, but guard anyway in
            // case Cloudflare retires a name we still have in the catalog.
            throw new Error(`Unknown Cloudflare permission group: "${ref}". Pass an explicit { id } instead.`);
        }
        return { id: group.id };
    }
    return ref.meta ? { id: ref.id, meta: ref.meta } : { id: ref.id };
};
const resolveResources = (resources) => {
    const out = {};
    for (const [key, value] of Object.entries(resources)) {
        if (value === undefined)
            continue;
        out[key] = value;
    }
    return out;
};
export const resolvePolicies = (policies) => policies.map((policy) => ({
    effect: policy.effect,
    permissionGroups: policy.permissionGroups.map(resolvePermissionGroup),
    resources: resolveResources(policy.resources),
}));
export const policyFingerprint = (policies) => JSON.stringify(policies.map((p) => ({
    effect: p.effect,
    permissionGroups: [...p.permissionGroups]
        .map((g) => ({ id: g.id, meta: g.meta ?? null }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    resources: Object.keys(p.resources)
        .sort()
        .map((k) => [k, p.resources[k]]),
})));
export const conditionFingerprint = (condition) => JSON.stringify({
    in: [...(condition?.requestIp?.in ?? [])].sort(),
    notIn: [...(condition?.requestIp?.notIn ?? [])].sort(),
});
export const buildConditionPayload = (condition) => condition
    ? {
        requestIp: condition.requestIp
            ? {
                in: condition.requestIp.in,
                notIn: condition.requestIp.notIn,
            }
            : undefined,
    }
    : undefined;
//# sourceMappingURL=Common.js.map