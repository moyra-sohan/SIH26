import * as dataexchange from "@distilled.cloud/aws/dataexchange";
import * as Layer from "effect/Layer";
import { makeDataExchangeAccountHttpBinding } from "./BindingHttp.js";
import { DeleteDataGrant } from "./DeleteDataGrant.js";
export const DeleteDataGrantHttp = Layer.effect(DeleteDataGrant, makeDataExchangeAccountHttpBinding({
    tag: "AWS.DataExchange.DeleteDataGrant",
    operation: dataexchange.deleteDataGrant,
    actions: ["dataexchange:DeleteDataGrant"],
}));
//# sourceMappingURL=DeleteDataGrantHttp.js.map