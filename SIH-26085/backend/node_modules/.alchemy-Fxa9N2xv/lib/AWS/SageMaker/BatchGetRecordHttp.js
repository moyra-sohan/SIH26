import * as featurestore from "@distilled.cloud/aws/sagemaker-featurestore-runtime";
import * as Layer from "effect/Layer";
import { BatchGetRecord, } from "./BatchGetRecord.js";
import { makeFeatureGroupHttpBinding } from "./BindingHttp.js";
export const BatchGetRecordHttp = Layer.effect(BatchGetRecord, makeFeatureGroupHttpBinding({
    tag: "AWS.SageMaker.BatchGetRecord",
    operation: featurestore.batchGetRecord,
    actions: ["sagemaker:BatchGetRecord"],
    // The wire request identifies feature groups per identifier batch — scope
    // the whole batch to the bound feature group.
    prepare: (request, featureGroupName) => ({
        Identifiers: [
            {
                FeatureGroupName: featureGroupName,
                RecordIdentifiersValueAsString: request.RecordIdentifiersValueAsString,
                FeatureNames: request.FeatureNames,
            },
        ],
        ExpirationTimeResponse: request.ExpirationTimeResponse,
    }),
}));
//# sourceMappingURL=BatchGetRecordHttp.js.map