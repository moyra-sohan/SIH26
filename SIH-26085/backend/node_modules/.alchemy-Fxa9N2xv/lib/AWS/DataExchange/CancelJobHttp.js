import * as dataexchange from "@distilled.cloud/aws/dataexchange";
import * as Layer from "effect/Layer";
import { makeDataExchangeAccountHttpBinding } from "./BindingHttp.js";
import { CancelJob } from "./CancelJob.js";
export const CancelJobHttp = Layer.effect(CancelJob, makeDataExchangeAccountHttpBinding({
    tag: "AWS.DataExchange.CancelJob",
    operation: dataexchange.cancelJob,
    actions: ["dataexchange:CancelJob"],
}));
//# sourceMappingURL=CancelJobHttp.js.map