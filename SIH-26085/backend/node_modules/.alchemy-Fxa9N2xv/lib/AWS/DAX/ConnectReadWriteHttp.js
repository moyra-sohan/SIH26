import * as Layer from "effect/Layer";
import { ConnectReadWrite } from "./Connect.js";
import { DAX_PROTOCOL_ACTIONS, DAX_READ_ACTIONS, DAX_WRITE_ACTIONS, makeDaxConnectHttpBinding, } from "./ConnectHttp.js";
export const ConnectReadWriteHttp = Layer.effect(ConnectReadWrite, makeDaxConnectHttpBinding({
    tag: "AWS.DAX.ConnectReadWrite",
    actions: [
        ...DAX_PROTOCOL_ACTIONS,
        ...DAX_READ_ACTIONS,
        ...DAX_WRITE_ACTIONS,
    ],
}));
//# sourceMappingURL=ConnectReadWriteHttp.js.map