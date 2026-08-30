import * as mq from "@distilled.cloud/aws/mq";
import * as Layer from "effect/Layer";
import { makeMqBrokerHttpBinding } from "./BindingHttp.js";
import { CreateUser } from "./CreateUser.js";
export const CreateUserHttp = Layer.effect(CreateUser, makeMqBrokerHttpBinding({
    capability: "CreateUser",
    operation: mq.createUser,
    iamActions: ["mq:CreateUser"],
}));
//# sourceMappingURL=CreateUserHttp.js.map