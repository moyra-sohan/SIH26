import * as microvms from "@distilled.cloud/aws/lambda-microvms";
import { CreateAuthToken } from "./CreateAuthToken.js";
import { makeImageBinding } from "./MicrovmBinding.js";
export const CreateAuthTokenHttp = makeImageBinding({
    binding: CreateAuthToken,
    name: "CreateAuthToken",
    actions: ["lambda:CreateMicrovmAuthToken"],
    operation: microvms.createMicrovmAuthToken,
    scope: "microvm",
});
//# sourceMappingURL=CreateAuthTokenHttp.js.map