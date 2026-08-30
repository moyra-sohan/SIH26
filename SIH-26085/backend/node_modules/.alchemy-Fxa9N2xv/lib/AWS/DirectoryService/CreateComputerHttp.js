import * as ds from "@distilled.cloud/aws/directory-service";
import * as Layer from "effect/Layer";
import { makeDirectoryHttpBinding } from "./BindingHttp.js";
import { CreateComputer } from "./CreateComputer.js";
export const CreateComputerHttp = Layer.effect(CreateComputer, makeDirectoryHttpBinding({
    tag: "AWS.DirectoryService.CreateComputer",
    operation: ds.createComputer,
    actions: ["ds:CreateComputer"],
}));
//# sourceMappingURL=CreateComputerHttp.js.map