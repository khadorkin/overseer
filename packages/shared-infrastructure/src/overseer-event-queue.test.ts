import { assert, describe, it } from "vite-plus/test";
import { OVERSEER_EVENT_QUEUE_LOGICAL_ID } from "./overseer-shared-infrastructure-identifiers.ts";
import { makeOverseerEventQueueSettings } from "./overseer-event-queue.ts";

describe("Overseer event Queue settings", () => {
  it("uses the required logical ID and retains the production Queue", () => {
    assert.strictEqual(OVERSEER_EVENT_QUEUE_LOGICAL_ID, "OverseerEventQueue");
    assert.deepStrictEqual(makeOverseerEventQueueSettings("production"), {
      name: "overseer-event-queue",
      retainQueue: true,
    });
  });

  it("requests generated, destroyable Queues outside production", () => {
    const expected = {
      name: undefined,
      retainQueue: false,
    };

    assert.deepStrictEqual(makeOverseerEventQueueSettings("test-abc123"), expected);
    assert.deepStrictEqual(makeOverseerEventQueueSettings("preview-def456"), expected);
    assert.deepStrictEqual(makeOverseerEventQueueSettings("local-dmmulroy"), expected);
  });
});
