import * as cloudtrail from "@distilled.cloud/aws/cloudtrail";
import * as Layer from "effect/Layer";
import { makeCloudTrailEventDataStoreHttpBinding } from "./BindingHttp.js";
import { CancelQuery } from "./CancelQuery.js";
export const CancelQueryHttp = Layer.effect(CancelQuery, makeCloudTrailEventDataStoreHttpBinding({
    tag: "AWS.CloudTrail.CancelQuery",
    operation: cloudtrail.cancelQuery,
    actions: ["cloudtrail:CancelQuery"],
}));
//# sourceMappingURL=CancelQueryHttp.js.map