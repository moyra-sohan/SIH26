import * as contacts from "@distilled.cloud/aws/notificationscontacts";
import * as Layer from "effect/Layer";
import { ActivateEmailContact } from "./ActivateEmailContact.js";
import { makeEmailContactHttpBinding } from "./BindingHttp.js";
export const ActivateEmailContactHttp = Layer.effect(ActivateEmailContact, makeEmailContactHttpBinding({
    tag: "AWS.NotificationsContacts.ActivateEmailContact",
    actions: ["notifications-contacts:ActivateEmailContact"],
    operation: contacts.activateEmailContact,
}));
//# sourceMappingURL=ActivateEmailContactHttp.js.map