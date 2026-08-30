import * as qbusiness from "@distilled.cloud/aws/qbusiness";
import * as Layer from "effect/Layer";
import { toWireMinutes } from "../../Util/Duration.js";
import { makeQBusinessWebExperienceHttpBinding } from "./BindingHttp.js";
import { CreateAnonymousWebExperienceUrl, } from "./CreateAnonymousWebExperienceUrl.js";
export const CreateAnonymousWebExperienceUrlHttp = Layer.effect(CreateAnonymousWebExperienceUrl, makeQBusinessWebExperienceHttpBinding({
    tag: "AWS.QBusiness.CreateAnonymousWebExperienceUrl",
    operation: qbusiness.createAnonymousWebExperienceUrl,
    actions: ["qbusiness:CreateAnonymousWebExperienceUrl"],
    prepare: (request) => ({
        sessionDurationInMinutes: toWireMinutes(request?.sessionDuration),
    }),
}));
//# sourceMappingURL=CreateAnonymousWebExperienceUrlHttp.js.map