import * as Alchemy from "alchemy";
import * as Axiom from "alchemy/Axiom";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect, Layer } from "effect";

import {
  OverseerE2eTraceIngestTokenResource,
  OverseerE2eTraceQueryTokenResource,
  OverseerE2eTracesDatasetResource,
} from "./axiom/overseer-e2e-trace-resources.ts";
import {
  OverseerProductionTraceIngestTokenResource,
  OverseerProductionTraceQueryTokenResource,
  OverseerProductionTracesDatasetResource,
} from "./axiom/overseer-production-trace-resources.ts";
import { OverseerEmailAllowlistAccessPolicyResource } from "./overseer-email-allowlist-access-policy.ts";
import { OverseerEmailOneTimePinIdentityProviderLookup } from "./overseer-email-one-time-pin-identity-provider-lookup.ts";
import { OverseerEventDataLakeResources } from "./overseer-event-data-lake.ts";
import { OverseerEventQueueResource } from "./overseer-event-queue.ts";
import { OVERSEER_SHARED_INFRASTRUCTURE_PRODUCTION_STAGE } from "./overseer-shared-infrastructure-identifiers.ts";
import { OverseerSharedInfrastructureStack } from "./overseer-shared-infrastructure-stack.ts";

const OverseerPermanentSharedInfrastructure = Effect.gen(function* () {
  const axiomE2eTracesDataset = yield* OverseerE2eTracesDatasetResource;
  const axiomE2eTraceIngestToken = yield* OverseerE2eTraceIngestTokenResource;
  const axiomE2eTraceQueryToken = yield* OverseerE2eTraceQueryTokenResource;
  const axiomProductionTracesDataset = yield* OverseerProductionTracesDatasetResource;
  const axiomProductionTraceIngestToken = yield* OverseerProductionTraceIngestTokenResource;
  const axiomProductionTraceQueryToken = yield* OverseerProductionTraceQueryTokenResource;
  const emailAllowlistAccessPolicy = yield* OverseerEmailAllowlistAccessPolicyResource;

  return {
    axiomE2eTraceApiBaseUrl: axiomE2eTracesDataset.apiBaseUrl,
    axiomE2eTraceDatasetName: axiomE2eTracesDataset.name,
    axiomE2eTraceIngestToken: axiomE2eTraceIngestToken.token,
    axiomE2eTraceOtlpEndpoint: axiomE2eTracesDataset.otelTracesEndpoint,
    axiomE2eTraceQueryToken: axiomE2eTraceQueryToken.token,
    axiomProductionTraceApiBaseUrl: axiomProductionTracesDataset.apiBaseUrl,
    axiomProductionTraceDatasetName: axiomProductionTracesDataset.name,
    axiomProductionTraceIngestToken: axiomProductionTraceIngestToken.token,
    axiomProductionTraceOtlpEndpoint: axiomProductionTracesDataset.otelTracesEndpoint,
    axiomProductionTraceQueryToken: axiomProductionTraceQueryToken.token,
    emailAllowlistAccessPolicyId: emailAllowlistAccessPolicy.policyId,
    emailOneTimePinIdentityProviderId:
      OverseerEmailOneTimePinIdentityProviderLookup.identityProviderId.as<string>(),
  };
});

/**
 * Compiles the one shared-infrastructure Stack for the current stage.
 *
 * Production owns the permanent Axiom and reusable Access resources. Other stages reference those
 * explicit exceptions while owning an isolated Queue and complete live event-lake subsystem. During
 * local runs only the Queue is emulated: Alchemy has no local Pipeline or R2 Data Catalog provider,
 * so `remote()` keeps the connected bucket, catalog, sinks, streams, and SQL pipelines live together.
 */
export const OverseerSharedInfrastructure = OverseerSharedInfrastructureStack.make(
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Axiom.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage;
    const productionReference =
      OverseerSharedInfrastructureStack.stage[OVERSEER_SHARED_INFRASTRUCTURE_PRODUCTION_STAGE];
    if (productionReference === undefined) {
      return yield* Effect.die(
        new Error("Overseer permanent shared infrastructure reference is unavailable."),
      );
    }
    const permanentInfrastructure =
      stage === OVERSEER_SHARED_INFRASTRUCTURE_PRODUCTION_STAGE
        ? yield* OverseerPermanentSharedInfrastructure
        : yield* productionReference;

    const eventDataLake = yield* OverseerEventDataLakeResources.pipe(Alchemy.remote());
    const eventQueue = yield* OverseerEventQueueResource;

    return {
      axiomE2eTraceApiBaseUrl: permanentInfrastructure.axiomE2eTraceApiBaseUrl,
      axiomE2eTraceDatasetName: permanentInfrastructure.axiomE2eTraceDatasetName,
      axiomE2eTraceIngestToken: permanentInfrastructure.axiomE2eTraceIngestToken,
      axiomE2eTraceOtlpEndpoint: permanentInfrastructure.axiomE2eTraceOtlpEndpoint,
      axiomE2eTraceQueryToken: permanentInfrastructure.axiomE2eTraceQueryToken,
      axiomProductionTraceApiBaseUrl: permanentInfrastructure.axiomProductionTraceApiBaseUrl,
      axiomProductionTraceDatasetName: permanentInfrastructure.axiomProductionTraceDatasetName,
      axiomProductionTraceIngestToken: permanentInfrastructure.axiomProductionTraceIngestToken,
      axiomProductionTraceOtlpEndpoint: permanentInfrastructure.axiomProductionTraceOtlpEndpoint,
      axiomProductionTraceQueryToken: permanentInfrastructure.axiomProductionTraceQueryToken,
      emailAllowlistAccessPolicyId: permanentInfrastructure.emailAllowlistAccessPolicyId,
      emailOneTimePinIdentityProviderId: permanentInfrastructure.emailOneTimePinIdentityProviderId,
      eventDataBucketName: eventDataLake.bucket.bucketName,
      eventDataCatalogUri: eventDataLake.catalog.catalogUri,
      eventDataWarehouseName: eventDataLake.catalog.name,
      eventQueueId: eventQueue.queueId,
      eventQueueName: eventQueue.queueName,
      eventStreamId: eventDataLake.stream.streamId,
    };
  }),
);
