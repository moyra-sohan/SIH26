import * as mm from "@distilled.cloud/aws/mailmanager";
import * as Layer from "effect/Layer";
import { makeAddressListHttpBinding } from "./BindingHttp.js";
import { DeregisterMemberFromAddressList } from "./DeregisterMemberFromAddressList.js";
export const DeregisterMemberFromAddressListHttp = Layer.effect(DeregisterMemberFromAddressList, makeAddressListHttpBinding({
    tag: "AWS.MailManager.DeregisterMemberFromAddressList",
    operation: mm.deregisterMemberFromAddressList,
    actions: ["ses:DeregisterMemberFromAddressList"],
}));
//# sourceMappingURL=DeregisterMemberFromAddressListHttp.js.map