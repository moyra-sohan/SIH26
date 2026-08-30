import * as microvms from "@distilled.cloud/aws/lambda-microvms";
import { DeleteMicrovmImageVersion } from "./DeleteMicrovmImageVersion.js";
import { makeImageBinding } from "./MicrovmBinding.js";
export const DeleteMicrovmImageVersionHttp = makeImageBinding({
    binding: DeleteMicrovmImageVersion,
    name: "DeleteMicrovmImageVersion",
    actions: ["lambda:DeleteMicrovmImageVersion"],
    operation: microvms.deleteMicrovmImageVersion,
    scope: "image",
    injectImageIdentifier: true,
});
//# sourceMappingURL=DeleteMicrovmImageVersionHttp.js.map