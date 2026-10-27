# @aneron/dead-reckon

Deterministic dead reckoning for networked entities.

## Purpose

Project an entity from its last known position, velocity, and timestamp, then decide whether a newer authoritative position is far enough from that projection to correct. When a correction is required, take one smoothed step: snap if the error exceeds a hard limit, otherwise blend across a caller-supplied duration.

Times are arguments. The library does not read a clock, schedule work, generate random values, or perform input or output.

## Install

```sh
npm install @aneron/dead-reckon
```

The package is ESM-only, runs on Node.js 20 and 22, and has no runtime dependencies.

## Usage

```js
import { predict, needsCorrection, correctionStep } from '@aneron/dead-reckon';

const last = {
  position: [0, 0],
  velocity: [1, 0],
  time: 0,
};

const predicted = predict(last, 2);
const authoritative = [2, 1];

if (needsCorrection(predicted, authoritative, 0.5)) {
  const step = correctionStep(predicted, authoritative, {
    elapsed: 1,
    blendTime: 4,
    snapDistance: 5,
  });
}
```

`predict` returns `[2, 0]`. The authoritative position is 1 unit away, which is greater than the threshold `0.5`, so a correction is required. That error is within `snapDistance`. With one quarter of the blend duration elapsed, `step.position` is `[2, 0.25]` and `step.snapped` is `false`.

Pass the position from the start of the correction as the first argument of `correctionStep`. Pass how long that correction has already been running as `elapsed`. Passing a partially blended position back in as the start begins a new blend.

## API

### `predict(state, time)`

`state.position` and `state.velocity` are non-empty arrays of finite numbers with the same length. `state.time` and `time` are finite numbers in one shared time unit.

Returns a new position array:

```text
position + velocity * (time - state.time)
```

### `needsCorrection(predicted, authoritative, threshold)`

Both positions are non-empty arrays of finite numbers with the same length. `threshold` is a finite number greater than or equal to 0.

Returns `true` when the Euclidean distance between the positions is strictly greater than `threshold`. An equal distance returns `false`.

### `correctionStep(from, to, options)`

`from` and `to` are non-empty arrays of finite numbers with the same length.

`options.elapsed` is a finite number. `options.blendTime` is a finite number greater than 0. `options.snapDistance` is a finite number greater than or equal to 0.

Returns `{ position, snapped }`. `position` is a new array.

- If the Euclidean error is strictly greater than `snapDistance`, `position` is a copy of `to` and `snapped` is `true`.
- Otherwise `snapped` is `false`. An `elapsed` value of 0 or less copies `from`. An `elapsed` value at or beyond `blendTime` copies `to`. Between those bounds, `position` is `from + (to - from) * (elapsed / blendTime)`.

None of the inputs are mutated.

Invalid arguments throw `TypeError` when a value has the wrong type or is not finite, and `RangeError` when a finite number is outside its allowed range. `position` and `velocity` must share a length, and each pair of vectors passed together must share a length.

## Design

Prediction is linear extrapolation. A timestamp equal to the sample time returns that sample's position. A later timestamp moves with the velocity. An earlier timestamp moves backward along the velocity. Each velocity component is a position unit per time unit. The caller keeps position and time units consistent.

The correction threshold uses a strict inequality, so a sample that lands on the allowance boundary is left alone. Snapping uses a strict inequality as well. An error equal to `snapDistance` stays on the blend path. The snap check runs before the blend, so a large error jumps to the target even when `elapsed` is zero or negative.

The blend weight is only `elapsed / blendTime`. It does not depend on how many times the function is called. When the blend duration has elapsed, the returned position is a copy of the target.

The same arguments always produce the same result. Vector length is not fixed. Two-component and three-component positions both work, as does any other positive length.

## License

MIT. Copyright (c) 2026 Vadim Gubin.
