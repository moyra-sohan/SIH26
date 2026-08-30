import * as mwaa from "@distilled.cloud/aws/mwaa";
import * as Layer from "effect/Layer";
import { makeMWAAEnvironmentHttpBinding } from "./BindingHttp.js";
import { CreateCliToken } from "./CreateCliToken.js";
export const CreateCliTokenHttp = Layer.effect(CreateCliToken, makeMWAAEnvironmentHttpBinding({
    tag: "AWS.MWAA.CreateCliToken",
    operation: mwaa.createCliToken,
    actions: ["airflow:CreateCliToken"],
}));
//# sourceMappingURL=CreateCliTokenHttp.js.map