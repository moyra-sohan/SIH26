import * as DynamoDB from "@distilled.cloud/aws/dynamodb";
import * as Layer from "effect/Layer";
import { makeTableHttpBinding } from "./BindingHttp.js";
import { DeleteItem } from "./DeleteItem.js";
export const DeleteItemHttp = Layer.effect(DeleteItem, makeTableHttpBinding({
    tag: "AWS.DynamoDB.DeleteItem",
    operation: DynamoDB.deleteItem,
    actions: ["dynamodb:DeleteItem"],
}));
//# sourceMappingURL=DeleteItemHttp.js.map