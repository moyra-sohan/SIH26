import * as mq from "@distilled.cloud/aws/mq";
import * as Layer from "effect/Layer";
import { makeMqBrokerHttpBinding } from "./BindingHttp.js";
import { DeleteUser } from "./DeleteUser.js";
export const DeleteUserHttp = Layer.effect(DeleteUser, makeMqBrokerHttpBinding({
    capability: "DeleteUser",
    operation: mq.deleteUser,
    iamActions: ["mq:DeleteUser"],
}));
//# sourceMappingURL=DeleteUserHttp.js.map