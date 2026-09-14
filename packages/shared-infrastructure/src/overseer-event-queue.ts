import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import { Effect } from "effect";

import {
  OVERSEER_EVENT_QUEUE_LOGICAL_ID,
  OVERSEER_SHARED_INFRASTRUCTURE_PRODUCTION_STAGE,
  OVERSEER_SHARED_INFRASTRUCTURE_STACK_NAME,
} from "./overseer-shared-infrastructure-identifiers.ts";

/** Physical-name and retention settings for one event Queue stage. */
export interface OverseerEventQueueSettings {
  /** Production Queue name, or undefined to request an Alchemy-generated isolated name. */
  readonly name: string | undefined;
  /** Whether the Queue and its pending messages survive Stack destruction. */
  readonly retainQueue: boolean;
}

/** Selects the retained production Queue or a generated, destroyable non-production Queue. */
export const makeOverseerEventQueueSettings = (stage: string): OverseerEventQueueSettings => {
  const production = stage === OVERSEER_SHARED_INFRASTRUCTURE_PRODUCTION_STAGE;
  return {
    name: production ? "overseer-event-queue" : undefined,
    retainQueue: production,
  };
};

/** Creates the stage-isolated at-least-once Queue that carries encoded Overseer events. */
export const OverseerEventQueueResource = Effect.gen(function* () {
  const stage = yield* Alchemy.Stage;

  const settings = makeOverseerEventQueueSettings(stage);
  const props: Cloudflare.Queues.QueueProps =
    settings.name === undefined ? {} : { name: settings.name };

  return yield* Cloudflare.Queues.Queue(OVERSEER_EVENT_QUEUE_LOGICAL_ID, props).pipe(
    RemovalPolicy.retain(settings.retainQueue),
  );
});

/** References the current stage's event Queue without transferring its lifecycle ownership. */
export const OverseerEventQueueReference = Cloudflare.Queues.Queue.ref(
  OVERSEER_EVENT_QUEUE_LOGICAL_ID,
  { stack: OVERSEER_SHARED_INFRASTRUCTURE_STACK_NAME },
);
