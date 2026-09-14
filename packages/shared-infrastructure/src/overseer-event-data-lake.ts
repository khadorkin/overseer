import * as Alchemy from "alchemy";
import * as Output from "alchemy/Output";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

import { OVERSEER_SHARED_INFRASTRUCTURE_PRODUCTION_STAGE } from "./overseer-shared-infrastructure-identifiers.ts";

/** Physical-name and retention settings for one event-data infrastructure stage. */
export interface OverseerEventDataInfrastructureSettings {
  /** Whether the R2 bucket and its event data survive Stack destruction. */
  readonly retainBucket: boolean;
  /** Whether the R2 Data Catalog survives Stack destruction. */
  readonly retainCatalog: boolean;
  /** Whether Alchemy may empty the R2 bucket before destroying an ephemeral stage. */
  readonly forceDestroyBucket: boolean;
  /** Production bucket name, or undefined to request an Alchemy-generated stage-isolated name. */
  readonly bucketName: string | undefined;
  /** Production token name, or undefined to request an Alchemy-generated stage-isolated name. */
  readonly catalogTokenName: string | undefined;
  /** Production Pipeline stream name, or undefined to request an Alchemy-generated name. */
  readonly streamName: string | undefined;
  /** Production raw-events sink name, or undefined to request an Alchemy-generated name. */
  readonly rawEventsSinkName: string | undefined;
  /** Production Workspace sink name, or undefined to request an Alchemy-generated name. */
  readonly workspaceSinkName: string | undefined;
  /** Production Project sink name, or undefined to request an Alchemy-generated name. */
  readonly projectSinkName: string | undefined;
  /** Production raw-events Pipeline name, or undefined to request an Alchemy-generated name. */
  readonly rawEventsPipelineName: string | undefined;
  /** Production Workspace Pipeline name, or undefined to request an Alchemy-generated name. */
  readonly workspacePipelineName: string | undefined;
  /** Production Project Pipeline name, or undefined to request an Alchemy-generated name. */
  readonly projectPipelineName: string | undefined;
}

/** Selects established production names or generated, destroyable non-production resources. */
export const makeOverseerEventDataInfrastructureSettings = (
  stage: string,
): OverseerEventDataInfrastructureSettings => {
  const production = stage === OVERSEER_SHARED_INFRASTRUCTURE_PRODUCTION_STAGE;
  return {
    retainBucket: production,
    retainCatalog: production,
    forceDestroyBucket: !production,
    bucketName: production ? "overseer-event-data-lake" : undefined,
    catalogTokenName: production ? "Overseer R2 Data Catalog Maintenance" : undefined,
    streamName: production ? "overseer_event_stream" : undefined,
    rawEventsSinkName: production ? "overseer_raw_events_sink" : undefined,
    workspaceSinkName: production ? "overseer_workspace_sink" : undefined,
    projectSinkName: production ? "overseer_project_sink" : undefined,
    rawEventsPipelineName: production ? "overseer_raw_events_pipeline" : undefined,
    workspacePipelineName: production ? "overseer_workspace_pipeline" : undefined,
    projectPipelineName: production ? "overseer_project_pipeline" : undefined,
  };
};

const makeOptionalPhysicalName = (name: string | undefined): { readonly name?: string } =>
  name === undefined ? {} : { name };

/**
 * Creates the raw Overseer event lake and independently replaceable Workspace and Project
 * projections.
 */
export const OverseerEventDataLakeResources = Effect.gen(function* () {
  const { accountId } = yield* yield* Cloudflare.CloudflareEnvironment;
  const stage = yield* Alchemy.Stage;
  const settings = makeOverseerEventDataInfrastructureSettings(stage);

  const bucket = yield* Cloudflare.R2.Bucket("overseer-event-data-lake-bucket", {
    ...makeOptionalPhysicalName(settings.bucketName),
    forceDestroy: settings.forceDestroyBucket,
  }).pipe(RemovalPolicy.retain(settings.retainBucket));

  const catalogToken = yield* Cloudflare.ApiToken.AccountApiToken(
    "overseer-r2-data-catalog-token",
    {
      ...makeOptionalPhysicalName(settings.catalogTokenName),
      accountId,
      policies: [
        {
          effect: "allow",
          permissionGroups: ["Workers R2 Storage Write", "Workers R2 Data Catalog Write"],
          resources: {
            [`com.cloudflare.api.account.${accountId}`]: "*",
          },
        },
      ],
    },
  );

  const catalog = yield* Cloudflare.R2.DataCatalog("overseer-event-data-catalog", {
    bucketName: bucket.bucketName,
    compaction: {
      state: "enabled",
      targetSizeMb: "256",
    },
    token: catalogToken.value,
  }).pipe(RemovalPolicy.retain(settings.retainCatalog));

  const stream = yield* Cloudflare.Pipelines.Stream("overseer-event-stream", {
    ...makeOptionalPhysicalName(settings.streamName),
    schema: {
      fields: [
        {
          name: "envelopeVersion",
          sqlName: "envelope_version",
          type: "int32",
          required: true,
        },
        {
          name: "eventId",
          sqlName: "event_id",
          type: "string",
          required: true,
        },
        { name: "source", type: "string", required: true },
        {
          name: "type",
          sqlName: "event_type",
          type: "string",
          required: true,
        },
        {
          name: "timestamp",
          sqlName: "event_timestamp",
          type: "timestamp",
          unit: "millisecond",
          required: true,
        },
        { name: "actor", type: "json", required: true },
        { name: "metadata", type: "json", required: true },
        { name: "payload", type: "json", required: true },
      ],
    },
    format: {
      type: "json",
      timestampFormat: "unix_millis",
    },
    http: { enabled: false },
    workerBinding: { enabled: true },
  });

  const rawEventsSink = yield* Cloudflare.Pipelines.Sink("overseer-raw-events-sink", {
    ...makeOptionalPhysicalName(settings.rawEventsSinkName),
    type: "r2_data_catalog",
    config: {
      bucket: catalog.bucketName,
      namespace: "overseer",
      tableName: "events",
      token: catalogToken.value,
      rollingPolicy: { intervalSeconds: 60 },
    },
    format: { type: "parquet", compression: "zstd" },
  });

  const workspaceSink = yield* Cloudflare.Pipelines.Sink("overseer-workspace-sink", {
    ...makeOptionalPhysicalName(settings.workspaceSinkName),
    type: "r2_data_catalog",
    config: {
      bucket: catalog.bucketName,
      namespace: "overseer",
      tableName: "workspace",
      token: catalogToken.value,
      rollingPolicy: { intervalSeconds: 60 },
    },
    format: { type: "parquet", compression: "zstd" },
  });

  const projectSink = yield* Cloudflare.Pipelines.Sink("overseer-project-sink", {
    ...makeOptionalPhysicalName(settings.projectSinkName),
    type: "r2_data_catalog",
    config: {
      bucket: catalog.bucketName,
      namespace: "overseer",
      tableName: "project",
      token: catalogToken.value,
      rollingPolicy: { intervalSeconds: 60 },
    },
    format: { type: "parquet", compression: "zstd" },
  });

  const rawEventsPipeline = yield* Cloudflare.Pipelines.Pipeline("overseer-raw-events-pipeline", {
    ...makeOptionalPhysicalName(settings.rawEventsPipelineName),
    sql: Output.interpolate`INSERT INTO ${rawEventsSink.name}
SELECT
  "envelopeVersion" AS envelope_version,
  "eventId" AS event_id,
  source,
  type AS event_type,
  timestamp AS event_timestamp,
  actor,
  metadata,
  payload
FROM ${stream.name}`,
  });

  const workspacePipeline = yield* Cloudflare.Pipelines.Pipeline("overseer-workspace-pipeline", {
    ...makeOptionalPhysicalName(settings.workspacePipelineName),
    sql: Output.interpolate`INSERT INTO ${workspaceSink.name}
SELECT
  "eventId" AS event_id,
  type AS event_type,
  timestamp AS event_timestamp,
  source,
  json_get_str(payload, 'workspace', 'workspaceId') AS workspace_id,
  json_get_str(payload, 'workspace', 'name') AS name,
  json_get_str(payload, 'workspace', 'state') AS state,
  to_timestamp_millis(json_get_str(payload, 'workspace', 'createdAt')) AS created_at,
  to_timestamp_millis(json_get_str(payload, 'workspace', 'updatedAt')) AS updated_at,
  json_get(payload, 'workspace', 'entityVersion')::BIGINT AS entity_version,
  type = 'workspace.delete.v1' AS is_deleted
FROM ${stream.name}
WHERE "envelopeVersion" = 1
  AND type IN (
    'workspace.create.v1',
    'workspace.rename.v1',
    'workspace.archive.v1',
    'workspace.unarchive.v1',
    'workspace.delete.v1'
  )`,
  });

  const projectPipeline = yield* Cloudflare.Pipelines.Pipeline("overseer-project-pipeline", {
    ...makeOptionalPhysicalName(settings.projectPipelineName),
    sql: Output.interpolate`INSERT INTO ${projectSink.name}
SELECT
  "eventId" AS event_id,
  type AS event_type,
  timestamp AS event_timestamp,
  source,
  json_get_str(payload, 'project', 'projectId') AS project_id,
  json_get_str(payload, 'project', 'workspaceId') AS workspace_id,
  json_get_str(payload, 'project', 'name') AS name,
  json_get_str(payload, 'project', 'state') AS state,
  to_timestamp_millis(json_get_str(payload, 'project', 'createdAt')) AS created_at,
  to_timestamp_millis(json_get_str(payload, 'project', 'updatedAt')) AS updated_at,
  json_get(payload, 'project', 'entityVersion')::BIGINT AS entity_version,
  type = 'project.delete.v1' AS is_deleted
FROM ${stream.name}
WHERE "envelopeVersion" = 1
  AND type IN (
    'project.create.v1',
    'project.rename.v1',
    'project.archive.v1',
    'project.unarchive.v1',
    'project.delete.v1'
  )`,
  });

  return {
    bucket,
    catalog,
    stream,
    rawEventsSink,
    rawEventsPipeline,
    workspaceSink,
    workspacePipeline,
    projectSink,
    projectPipeline,
  };
});
