import { assert, describe, it } from "vite-plus/test";
import { makeOverseerEventDataInfrastructureSettings } from "./overseer-event-data-lake.ts";

describe("Overseer event-data infrastructure settings", () => {
  it("preserves production names and retains the bucket and Data Catalog", () => {
    assert.deepStrictEqual(makeOverseerEventDataInfrastructureSettings("production"), {
      retainBucket: true,
      retainCatalog: true,
      forceDestroyBucket: false,
      bucketName: "overseer-event-data-lake",
      catalogTokenName: "Overseer R2 Data Catalog Maintenance",
      streamName: "overseer_event_stream",
      rawEventsSinkName: "overseer_raw_events_sink",
      workspaceSinkName: "overseer_workspace_sink",
      projectSinkName: "overseer_project_sink",
      rawEventsPipelineName: "overseer_raw_events_pipeline",
      workspacePipelineName: "overseer_workspace_pipeline",
      projectPipelineName: "overseer_project_pipeline",
    });
  });

  it("requests generated, destroyable resources for every non-production stage", () => {
    const expected = {
      retainBucket: false,
      retainCatalog: false,
      forceDestroyBucket: true,
      bucketName: undefined,
      catalogTokenName: undefined,
      streamName: undefined,
      rawEventsSinkName: undefined,
      workspaceSinkName: undefined,
      projectSinkName: undefined,
      rawEventsPipelineName: undefined,
      workspacePipelineName: undefined,
      projectPipelineName: undefined,
    };

    assert.deepStrictEqual(makeOverseerEventDataInfrastructureSettings("test-abc123"), expected);
    assert.deepStrictEqual(makeOverseerEventDataInfrastructureSettings("preview-def456"), expected);
    assert.deepStrictEqual(makeOverseerEventDataInfrastructureSettings("local-dmmulroy"), expected);
  });
});
