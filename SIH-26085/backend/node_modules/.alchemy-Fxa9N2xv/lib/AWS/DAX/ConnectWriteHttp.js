import * as Layer from "effect/Layer";
import { ConnectWrite } from "./Connect.js";
import { DAX_PROTOCOL_ACTIONS, DAX_WRITE_ACTIONS, makeDaxConnectHttpBinding, } from "./ConnectHttp.js";
export const ConnectWriteHttp = Layer.effect(ConnectWrite, makeDaxConnectHttpBinding({
    tag: "AWS.DAX.ConnectWrite",
    actions: [...DAX_PROTOCOL_ACTIONS, ...DAX_WRITE_ACTIONS],
}));
//# sourceMappingURL=ConnectWriteHttp.js.map