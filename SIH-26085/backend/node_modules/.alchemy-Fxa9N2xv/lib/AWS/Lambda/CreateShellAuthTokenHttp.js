import * as microvms from "@distilled.cloud/aws/lambda-microvms";
import { CreateShellAuthToken } from "./CreateShellAuthToken.js";
import { makeImageBinding } from "./MicrovmBinding.js";
export const CreateShellAuthTokenHttp = makeImageBinding({
    binding: CreateShellAuthToken,
    name: "CreateShellAuthToken",
    actions: ["lambda:CreateMicrovmShellAuthToken"],
    operation: microvms.createMicrovmShellAuthToken,
    scope: "microvm",
});
//# sourceMappingURL=CreateShellAuthTokenHttp.js.map