import * as dataexchange from "@distilled.cloud/aws/dataexchange";
import * as Layer from "effect/Layer";
import { makeDataExchangeAccountHttpBinding } from "./BindingHttp.js";
import { CreateDataGrant } from "./CreateDataGrant.js";
export const CreateDataGrantHttp = Layer.effect(CreateDataGrant, makeDataExchangeAccountHttpBinding({
    tag: "AWS.DataExchange.CreateDataGrant",
    operation: dataexchange.createDataGrant,
    actions: ["dataexchange:CreateDataGrant"],
}));
//# sourceMappingURL=CreateDataGrantHttp.js.map