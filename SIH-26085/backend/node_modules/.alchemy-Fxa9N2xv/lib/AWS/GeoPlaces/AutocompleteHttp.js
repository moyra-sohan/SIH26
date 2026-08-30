import * as geoPlaces from "@distilled.cloud/aws/geo-places";
import * as Layer from "effect/Layer";
import { Autocomplete } from "./Autocomplete.js";
import { makeGeoPlacesHttpBinding } from "./BindingHttp.js";
export const AutocompleteHttp = Layer.effect(Autocomplete, makeGeoPlacesHttpBinding({
    capability: "Autocomplete",
    iamActions: ["geo-places:Autocomplete"],
    operation: geoPlaces.autocomplete,
}));
//# sourceMappingURL=AutocompleteHttp.js.map