import * as mwaa from "@distilled.cloud/aws/mwaa";
import * as Layer from "effect/Layer";
import { makeMWAAAirflowRoleHttpBinding } from "./BindingHttp.js";
import { CreateWebLoginToken } from "./CreateWebLoginToken.js";
export const CreateWebLoginTokenHttp = Layer.effect(CreateWebLoginToken, makeMWAAAirflowRoleHttpBinding({
    tag: "AWS.MWAA.CreateWebLoginToken",
    operation: mwaa.createWebLoginToken,
    actions: ["airflow:CreateWebLoginToken"],
}));
//# sourceMappingURL=CreateWebLoginTokenHttp.js.map