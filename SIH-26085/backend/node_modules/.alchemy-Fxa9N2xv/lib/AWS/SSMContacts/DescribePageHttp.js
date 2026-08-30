import * as ssm from "@distilled.cloud/aws/ssm-contacts";
import * as Layer from "effect/Layer";
import { makeAccountHttpBinding } from "./BindingHttp.js";
import { DescribePage } from "./DescribePage.js";
export const DescribePageHttp = Layer.effect(DescribePage, makeAccountHttpBinding({
    tag: "AWS.SSMContacts.DescribePage",
    operation: ssm.describePage,
    actions: ["ssm-contacts:DescribePage"],
}));
//# sourceMappingURL=DescribePageHttp.js.map