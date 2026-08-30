import * as personalize from "@distilled.cloud/aws/personalize";
import * as Layer from "effect/Layer";
import { makePersonalizeAccountHttpBinding } from "./BindingHttp.js";
import { CreateCampaign } from "./CreateCampaign.js";
export const CreateCampaignHttp = Layer.effect(CreateCampaign, makePersonalizeAccountHttpBinding({
    tag: "AWS.Personalize.CreateCampaign",
    operation: personalize.createCampaign,
    actions: ["personalize:CreateCampaign"],
}));
//# sourceMappingURL=CreateCampaignHttp.js.map