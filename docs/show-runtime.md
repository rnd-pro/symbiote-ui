# Show Runtime

`symbiote-ui/chat/show-runtime` is the product-neutral provider boundary for a narrated, interactive Show. It is Node-safe at import time. The library owns reusable contracts and browser adapters; the consumer owns scenario copy, articles, DOM targets, product content, navigation, transport, and persistence.

## Contract

The `symbiote-show-v1` directive vocabulary is `speech`, `footnote`, `status`, `actions`, `branch-enter`, `branch-return`, `resume`, `attention`, and `media`. `createShowEvent()` adds a typed `show:*` envelope, sequence, and timestamp. The machine-readable envelope is published as `schemas/show-event-v1.json` and through `SHOW_RUNTIME_CONTRACT` in `symbiote-ui/manifest`.

`ShowSessionState` preserves message history and the exact main-flow playback snapshot before entering a branch. Returning restores `episodeId`, `positionMs`, `cueIndex`, and `subjectId`, but forces `playbackState: "paused"` and `resumeRequired: true`. Only an explicit `resume()` starts playback again.

## Attention and interaction

`ShowAttentionController` owns one visible presenter cursor and serializes the transient attention modes `frame`, `native-selection`, and `click`. It advances presenter frame, cursor, expanding click ripple, native text selection, and marker receipts with one provider-owned `requestAnimationFrame` loop; consumers do not supply a gesture clock or path generator. A consumer supplies only the presentation intent, resolved target, optional style, and stable seed/gesture identity.

Cursor travel, marker, underline, arrow, focus frame, relationship arrow, and native-selection reveal share one natural kinematic contract. Duration follows the measured smoothed arc length, so a large gesture takes longer than a small one and never exceeds the provider's human-stylus speed ceiling. Distance is sampled by arc length with a bounded minimum-jerk acceleration/deceleration profile. Adaptive geometric-tolerance subdivision and centripetal smoothing remove visible corners while preserving target coverage and make the result independent of the source curve's parameterization. Width varies smoothly with speed, curvature, and the derived pressure profile. String or numeric seeds pass through one stable normalization step; seeded irregularity is evaluated at normalized arc coordinates, is spatially smooth and deterministic, and never becomes per-frame jitter. Enclosing ink uses an authored underdraw or controlled overlap with natural tails rather than a mathematically perfect closure.

Native selection progressively extends the actual browser `Selection`/`Range` or text-control range, derives duration from the measured selection travel, settles the exact authored quote/occurrence, and restores the prior selection when requested. `whenSettled()` resolves after the current gesture reaches its visible settled state, or reports that replacement/reset/disposal cancelled it. Its immutable receipt publishes `planVersion`, preserves `cueTimeMs`, `mediaTimeMs`, and gesture identity, and reports `startedAtMs` from the first provider-owned animation frame separately from `firstFrameAtMs`, actual `settledAtMs`, elapsed duration, generation, and normalized path hash. `pause()`, `resume()`, `seek()`, `captureState()`, `restoreState()`, `cancel()`, and `reset()` preserve deterministic replay without stale animation callbacks. `prefers-reduced-motion` renders the final semantic state immediately. Transient settled state remains visible until replacement or `clearTransient()`.

Marker ink is an independent accumulating layer. A marker is committed after its gesture settles, survives later transient frame/cursor/click gestures, and remains visible until `clearMarkers()`. Replacement, seek/branch reset through `ShowAlignedMediaRuntime.onReset`, and disposal cancel the single outstanding animation frame before deterministic replay, so a stale callback cannot duplicate or advance the restored cue. Cue dispatch remains anchored to `media.currentTime`; the animation clock measures only elapsed gesture presentation after that recognized-audio cue. Native selection uses a consumer-supplied selection adapter, such as `selectPresenterText`; DOM targets remain consumer-owned.

Canonical Show marker shapes are:

- `freehand`
- `underline`
- `oval`
- `multi-oval` (the authored alias `ovals` normalizes to this name and is preserved as `requestedMarker`)
- `arrow`
- `converging-arrows`
- `route`
- `bidirectional-route`
- `parallel-route`
- `label`
- `number` (an optional `label` selects digits 1–9; the visible default is 1)
- `box`
- `bracket`
- `slash`

Every canonical marker has a deterministic presenter gesture and receipt. Unknown shapes throw `ShowContractError` with `code: "invalid-marker-shape"`; they never silently become a frame or another marker.

`monitorMeaningfulShowInteractions()` treats trusted primary clicks, input/change/submit, and non-modifier key presses as meaningful. Hover, pointer movement, synthetic events, repeated/composition keys, and modifier-only keys do not pause a Show. The host connects the monitor's `pause` callback to `ShowSessionState.pause()` or its transport.

## Readiness, audio, and media

`waitForShowDomReadiness()` waits for document readiness, fonts, a consumer-resolved DOM target, and media readiness. It uses events and `MutationObserver`, accepts `AbortSignal`, and reports typed timeout/resource errors instead of relying on fixed presentation sleeps.

`ShowAudioArbiter` grants one audible source at a time. Audible media preempts and pauses speech before it begins. `ShowMediaController` exposes two canonical modes:

- `short-muted-montage`: muted, controls hidden, not skippable by the Show control, with `pointer-only` interaction semantics. A Short may point out the available full-video action but cannot activate detailed playback through that control.
- `full-with-media-audio`: audible, controls visible, explicitly skippable, acquired through the audio arbiter, with `detail` interaction semantics.

Stopping, ending, replacement, skip, or rejected playback restores the prior current time, paused state, mute, volume, playback rate, and controls. The former provisional name `full-with-skip` is not a public mode; consumers must use `full-with-media-audio`.

## Recognized-audio alignment

The Show runtime consumes the existing product-neutral `workspace-aligned-sequence-v3` artifact; it does not define a competing authored timeline or Whisper output schema. `createShowAlignedCueSchedule()` combines consumer-owned generic Show directives with canonical `{ turnIndex, anchor, quote, occurrence, edge, offsetMs }` anchors. `resolveShowAudioAnchor()` preserves the established behavior for exact and repeated recognized-word matches and returns an immutable receipt with the media hash, aligned-sequence hash, recognized segment, selected word indexes, resolution, and confidence.

Missing or unreliable word evidence never triggers proportional timing or interpolation. The resolver selects the actual recognized turn/segment `startMs` for a start edge or `endMs` for an end edge and reports `resolution: "segment"`, `source: "recognized-segment"`, and a `fallbackReason`. Segment fallback confidence defaults to `low`; a host may pass an externally proven `segmentConfidence`, while `isWordReliable` is the adapter seam for producer-owned confidence evidence. Neither seam changes the v3 artifact shape.

`ShowAlignedMediaRuntime` samples only `media.currentTime`. It emits due cue receipts once during forward playback, does not re-fire on an ordinary pause/resume at the same time, and rebuilds the cue projection after a seek or `restorePlayback()` branch return. A paused owned restore updates the fired-cue projection and calls `onReset`, but withholds `onCue`; this keeps presenter frame, marker ink, cursor, and native selection cleared until explicit resume crosses the next current/future cue.

After playback starts, native `timeupdate` is the primary sampling signal. Because browsers may coalesce or omit that event under load, the runtime also owns a single lifecycle-bound 250 ms fallback sample while media is playing and unfired cues remain. Every sample reads the actual `media.currentTime`; wall time never advances the Show timeline. One sample dispatches every crossed cue once in schedule order. The fallback stops on pause, ended, error, waiting, seeking, source reset, hidden document, disposal, or exhaustion of the schedule, and catches up from current media time when playback or the document becomes active again. Both `runtime.resume()` and a direct native `media.play()` event use this contract; consumers do not add a timer or polling loop.

An owned nonzero seek remains active through asynchronous decoder reset or quantized native events. Observed zero is never accepted for a nonzero checkpoint. The runtime reasserts the requested position only at a bounded set of native metadata/readiness/progress/seek-completion opportunities, and succeeds only after `media.currentTime` is physically observed within 25 ms of the request. Ownership then releases, so a later user/native seek receives the ordinary `seeked` reset path. Timeout or media/assignment error calls the additive `onSeekFailure(receipt)` callback with `status: "failed"`, an operation ID, reason, requested and observed milliseconds, phase, and source. Replacement, source replacement, and disposal cancel ownership without leaking suppression; the runtime never reports a checkpoint as physically successful while the media remains at zero.

When the source itself is not already in a terminal ready generation, use `await runtime.loadAndRestorePlayback({ source, positionMs, paused: true, preload: 'auto' }, { reason })`. Construct the runtime first, then let this one operation attach listeners, assign the source, call `load()`, wait for that generation's metadata, assign the checkpoint, and observe both current-data readiness and physical seek completion. Startup `abort`/`emptied`/`loadstart` events therefore occur inside ownership, before success is possible. A reset after metadata, source replacement, media error, timeout, operation replacement, or disposal resolves the operation with an immutable `failed` or `cancelled` receipt and also calls `onSeekFailure`; a completed receipt preserves the caller's branch/seek reason. There is no dwell timer. The terminal generation boundary is the browser media lifecycle: metadata from the owned load, `readyState >= HAVE_CURRENT_DATA`, a matching source, and a completed physical seek within 25 ms. A later unrelated user seek follows the ordinary `seeked` path.

## Consumer handshake

Import only the narrow public entrypoint:

```js
import {
  ShowAttentionController,
  ShowAlignedMediaRuntime,
  ShowAudioArbiter,
  ShowMediaController,
  ShowSessionState,
  createShowAlignedCueSchedule,
  monitorMeaningfulShowInteractions,
  normalizeShowDirective,
  resolveShowAudioAnchor,
  waitForShowDomReadiness,
} from 'symbiote-ui/chat/show-runtime';
```

Resolve product targets in the consumer and pass elements or adapters into the controllers. The producer/consumer handshake is: produce and validate `workspace-aligned-sequence-v3`, supply generic Show cues with canonical anchors, create the schedule, then route `onCue({ cue })` to attention/media/state adapters. The attention adapter must forward the schedule's media time explicitly; it must never replace it with wall or animation time:

```js
const runtime = new ShowAlignedMediaRuntime(media, schedule, {
  onCue({ cue, cueTimeMs, mediaTimeMs }) {
    if (cue.directive.type !== 'attention') return;
    attention.present({
      ...cue.directive,
      gestureId: cue.directive.gestureId || cue.cueId,
      cueTimeMs,
      mediaTimeMs,
    });
  },
});
```

Do not copy product identifiers, article data, authored scripts, proof records, voice ownership, or scenario-specific transitions into this package.

For a branch checkpoint that also changes or initializes audio, the consumer must not call `media.load()`, preassign `media.currentTime`, poll, or retry. It creates `ShowAlignedMediaRuntime` with the media and schedule, then calls `loadAndRestorePlayback()` with the source, checkpoint, paused state, and reason. Await the terminal receipt before treating the media generation as ready. An explicit later `resume()` is the only step that releases future/current cue presentation from a paused branch restore.

## Agent chat and fixed Show composition

Use `symbiote-ui/chat/show-chat` when a Show belongs to an ordinary agent conversation. The assistant transcript keeps an `embed` receipt, while the one live `chat-show-player` mounts in a fixed lower composition region below the independently scrolling transcript/workspace. The narrow entrypoint exports `AgentShowConversation`, `createScriptedAgentProvider`, `CHAT_SHOW_PLAYER_CONTRACT`, `agent-show-chat`, `chat-show-player`, and `agent-dock-shell`. Its browser loader first reuses any `panel-layout` and `chat-workspace` constructors already present in the document registry, so a separately built lazy Show bundle does not evaluate a second layout/chat/control/effect component graph. The composition keeps `chat-workspace` and its composer interactive, forwards both text submits and contextual card actions through the same injected `agentProvider.respond(request)` method, and leaves the Show controller independent.

`chat-show-player` is intentionally compact: the header exposes a product-neutral material icon/title, optional action slot, settings request, and close request; the timeline projects at most two rows around the current turn and owns its overflow; the caption/karaoke and optional TTS status blocks remain inside the player; and all transport actions route to the injected controller. Optional `videoControls` use exactly two semantics: `detail` emits a cancelable request and invokes the declared host controller method when allowed, while `pointer-only` emits a receipt without activation. `agent-dock-shell` supplies the Cascade-compatible frame, surface, borders, bounded geometry, and product workspace peer through its `main` slot. At desktop sizes the native `panel-layout` split reserves and resizes the chat peer while leaving the main workspace available for presenter overlays. Below `responsive-breakpoint`, that same chat panel becomes the native end drawer. `open()`, `close()`, and `toggle()` change presentation without recreating transcript or player instances.

The shell owns one standard `panel-layout` split. Its native split resizer and panel collapse control are the desktop contract; at the responsive breakpoint the same chat node becomes the standard end drawer/rail without recreating the transcript or player. The mobile drawer uses the provider-owned `--sn-agent-dock-z` tier, whose standalone fallback and default-theme value are `16000`. This keeps the dock above local workspace/canvas overlays (`--sn-canvas-overlay-z-base`, default `12000`) while global popovers and modals remain above it. Consumers do not supply shell grid, reveal, resize, or drawer CSS.

Register each product-owned Show by its generic embed key with `setShow(key, { controller, timeline, state, title, autoplay, videoController, videoControls })`. An assistant response can then include `{ type: 'embed', key }`. The composition retains one live player instance in the fixed player region while the embed receipt survives transcript rerenders. `autoplay: true` starts playback when the player connects; contextual actions remain optional and never gate or pause narration. The newest `actions` part is marked current while earlier cards remain visible, quieter, and enabled.

```js
import { createScriptedAgentProvider } from 'symbiote-ui/chat/show-chat';

const chat = document.querySelector('agent-show-chat');
chat.setAgentProvider(createScriptedAgentProvider({ routes }));
chat.setShow('show', { controller, timeline, state, autoplay: true });
```

The consumer continues to own all authored copy, scenario IDs, DOM targets, controller creation, recognized-audio alignment, branching policy, persistence, and any API transport. Replacing the scripted provider with a remote agent changes `respond(request)` only.

## Hidden target action lifecycle

`ShowActionLifecycle` runs consumer-injected callbacks in the fixed order `inspect → reveal → transition → target → act → restore`. A collapsed desktop panel or closed mobile drawer is state discovered by `inspect`, not a missing target. Each completed, cancelled, or failed phase is recorded in the returned receipt. `pause()`, `stop()`, `seek()`, `branchChange()`, `branchReturn()`, replacement, and `cancel()` abort stale transition/target/action work. `meaningfulInteraction()` additionally marks the state as user-superseded, so the provider never closes or rewinds a panel the user changed. Restore runs only when the reveal receipt says `changed: true` and no user supersession occurred. Product mappings, routing, DOM selectors, and transition/readiness implementations remain injected consumer adapters.
