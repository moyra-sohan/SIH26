import * as DynamoDB from "@distilled.cloud/aws/dynamodb";
import * as Layer from "effect/Layer";
import { makeTableHttpBinding } from "./BindingHttp.js";
import { DescribeContinuousBackups } from "./DescribeContinuousBackups.js";
export const DescribeContinuousBackupsHttp = Layer.effect(DescribeContinuousBackups, makeTableHttpBinding({
    tag: "AWS.DynamoDB.DescribeContinuousBackups",
    operation: DynamoDB.describeContinuousBackups,
    actions: ["dynamodb:DescribeContinuousBackups"],
}));
//# sourceMappingURL=DescribeContinuousBackupsHttp.js.map