import * as medicalimaging from "@distilled.cloud/aws/medical-imaging";
import * as Layer from "effect/Layer";
import { makeMedicalImagingDatastoreHttpBinding } from "./BindingHttp.js";
import { CopyImageSet } from "./CopyImageSet.js";
export const CopyImageSetHttp = Layer.effect(CopyImageSet, makeMedicalImagingDatastoreHttpBinding({
    tag: "AWS.MedicalImaging.CopyImageSet",
    operation: medicalimaging.copyImageSet,
    actions: ["medical-imaging:CopyImageSet"],
}));
//# sourceMappingURL=CopyImageSetHttp.js.map