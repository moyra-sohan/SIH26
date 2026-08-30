import * as sesv2 from "@distilled.cloud/aws/sesv2";
import * as Layer from "effect/Layer";
import { makeSESHttpBinding } from "./BindingHttp.js";
import { DeleteSuppressedDestination } from "./DeleteSuppressedDestination.js";
export const DeleteSuppressedDestinationHttp = Layer.effect(DeleteSuppressedDestination, makeSESHttpBinding({
    tag: "AWS.SES.DeleteSuppressedDestination",
    operation: sesv2.deleteSuppressedDestination,
    actions: ["ses:DeleteSuppressedDestination"],
}));
//# sourceMappingURL=DeleteSuppressedDestinationHttp.js.map