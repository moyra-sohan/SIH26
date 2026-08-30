import * as dms from "@distilled.cloud/aws/database-migration-service";
import * as Layer from "effect/Layer";
import { makeDmsAccountHttpBinding } from "./BindingHttp.js";
import { DescribeEndpointSettings } from "./DescribeEndpointSettings.js";
export const DescribeEndpointSettingsHttp = Layer.effect(DescribeEndpointSettings, makeDmsAccountHttpBinding({
    tag: "AWS.DMS.DescribeEndpointSettings",
    actions: ["dms:DescribeEndpointSettings"],
    operation: dms.describeEndpointSettings,
}));
//# sourceMappingURL=DescribeEndpointSettingsHttp.js.map