import * as Layer from "effect/Layer";
import { ConnectRead } from "./Connect.js";
import { DAX_PROTOCOL_ACTIONS, DAX_READ_ACTIONS, makeDaxConnectHttpBinding, } from "./ConnectHttp.js";
export const ConnectReadHttp = Layer.effect(ConnectRead, makeDaxConnectHttpBinding({
    tag: "AWS.DAX.ConnectRead",
    actions: [...DAX_PROTOCOL_ACTIONS, ...DAX_READ_ACTIONS],
}));
//# sourceMappingURL=ConnectReadHttp.js.map