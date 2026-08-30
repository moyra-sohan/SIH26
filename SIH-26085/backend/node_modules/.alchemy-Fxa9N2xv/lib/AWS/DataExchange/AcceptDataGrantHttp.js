import * as dataexchange from "@distilled.cloud/aws/dataexchange";
import * as Layer from "effect/Layer";
import { makeDataExchangeAccountHttpBinding } from "./BindingHttp.js";
import { AcceptDataGrant } from "./AcceptDataGrant.js";
export const AcceptDataGrantHttp = Layer.effect(AcceptDataGrant, makeDataExchangeAccountHttpBinding({
    tag: "AWS.DataExchange.AcceptDataGrant",
    operation: dataexchange.acceptDataGrant,
    actions: ["dataexchange:AcceptDataGrant"],
}));
//# sourceMappingURL=AcceptDataGrantHttp.js.map