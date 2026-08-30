import * as Redacted from "effect/Redacted";
import { toWireDays, toWireSeconds } from "../../Util/Duration.js";
/**
 * Convert an optional `Duration.Input` prop to whole wire seconds.
 *
 * @deprecated Import {@link toWireSeconds} from `Util/Duration.ts` directly.
 * Kept as an alias because several other AWS services still import it from
 * here.
 */
export const durationToSeconds = toWireSeconds;
/**
 * Convert an optional `Duration.Input` prop to whole wire days.
 *
 * @deprecated Import {@link toWireDays} from `Util/Duration.ts` directly.
 * Kept as an alias because several other AWS services still import it from
 * here.
 */
export const durationToDays = toWireDays;
export const toTagRecord = (tags) => Object.fromEntries((tags ?? [])
    .filter((tag) => typeof tag.Key === "string" && typeof tag.Value === "string")
    .map((tag) => [tag.Key, tag.Value]));
const decodePolicyString = (value) => {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
};
export const parsePolicyDocument = (value) => {
    if (!value) {
        return undefined;
    }
    const decoded = decodePolicyString(value);
    return JSON.parse(decoded);
};
export const stringifyPolicyDocument = (value) => JSON.stringify(value);
export const normalizeIamPath = (value) => {
    const path = value ?? "/";
    const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
    return withLeadingSlash.endsWith("/")
        ? withLeadingSlash
        : `${withLeadingSlash}/`;
};
export const policyArnFromParts = ({ accountId, path, policyName, }) => `arn:aws:iam::${accountId}:policy${normalizeIamPath(path)}${policyName}`;
export const oldestNondefaultPolicyVersion = (versions) => [...(versions ?? [])]
    .filter((version) => !version.IsDefaultVersion && version.VersionId)
    .sort((a, b) => (a.CreateDate?.getTime() ?? 0) - (b.CreateDate?.getTime() ?? 0))[0];
export const toRedactedString = (value) => value === undefined
    ? undefined
    : typeof value === "string"
        ? Redacted.make(value)
        : value;
export const toRedactedBytes = (value) => value === undefined
    ? undefined
    : value instanceof Uint8Array
        ? Redacted.make(value)
        : value;
export const unwrapRedactedString = (value) => (typeof value === "string" ? value : Redacted.value(value));
//# sourceMappingURL=common.js.map