import * as mm from "@distilled.cloud/aws/mailmanager";
import * as Layer from "effect/Layer";
import { makeAddressListHttpBinding } from "./BindingHttp.js";
import { CreateAddressListImportJob } from "./CreateAddressListImportJob.js";
export const CreateAddressListImportJobHttp = Layer.effect(CreateAddressListImportJob, makeAddressListHttpBinding({
    tag: "AWS.MailManager.CreateAddressListImportJob",
    operation: mm.createAddressListImportJob,
    actions: ["ses:CreateAddressListImportJob"],
}));
//# sourceMappingURL=CreateAddressListImportJobHttp.js.map