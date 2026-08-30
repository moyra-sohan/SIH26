import * as iotfleetwise from "@distilled.cloud/aws/iotfleetwise";
import * as Layer from "effect/Layer";
import { AssociateVehicleFleet } from "./AssociateVehicleFleet.js";
import { makeFleetWiseResourceHttpBinding } from "./BindingHttp.js";
export const AssociateVehicleFleetHttp = Layer.effect(AssociateVehicleFleet, makeFleetWiseResourceHttpBinding({
    tag: "AWS.IoTFleetWise.AssociateVehicleFleet",
    operation: iotfleetwise.associateVehicleFleet,
    actions: ["iotfleetwise:AssociateVehicleFleet"],
    requestKey: "fleetId",
    identifier: (fleet) => fleet.fleetId,
    // The action authorizes on both the fleet and the vehicle; the vehicle
    // is a runtime argument, so its grant is the account-wide pattern.
    resources: (fleet) => [
        fleet.fleetArn,
        "arn:aws:iotfleetwise:*:*:vehicle/*",
    ],
}));
//# sourceMappingURL=AssociateVehicleFleetHttp.js.map