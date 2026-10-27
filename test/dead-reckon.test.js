import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { correctionStep, needsCorrection, predict } from '../src/index.js';

describe('predict', () => {
  test('projects a 2D state forward', () => {
    const position = predict(
      { position: [0, 0], velocity: [2, -4], time: 10 },
      12,
    );
    assert.deepEqual(position, [4, -8]);
  });

  test('projects a 3D state forward', () => {
    const position = predict(
      { position: [1, 2, 3], velocity: [0, 1, -2], time: 0 },
      5,
    );
    assert.deepEqual(position, [1, 7, -7]);
  });

  test('projects a 1D state forward', () => {
    assert.deepEqual(
      predict({ position: [4], velocity: [3], time: 1 }, 3),
      [10],
    );
  });

  test('returns the 2D sample position when elapsed time is zero', () => {
    const state = { position: [5, -2], velocity: [9, 8], time: 4 };
    const position = predict(state, 4);
    assert.deepEqual(position, [5, -2]);
    assert.notEqual(position, state.position);
  });

  test('returns the 3D sample position when elapsed time is zero', () => {
    const position = predict(
      { position: [1, 2, 3], velocity: [4, 5, 6], time: 8 },
      8,
    );
    assert.deepEqual(position, [1, 2, 3]);
  });

  test('extrapolates a 2D state backward when elapsed time is negative', () => {
    assert.deepEqual(
      predict({ position: [5, 5], velocity: [1, -2], time: 100 }, 98),
      [3, 9],
    );
  });

  test('extrapolates a 3D state backward when elapsed time is negative', () => {
    assert.deepEqual(
      predict({ position: [0, 10, -4], velocity: [2, -3, 1], time: 6 }, 4),
      [-4, 16, -6],
    );
  });

  test('does not mutate the state', () => {
    const position = [0, 0, 1];
    const velocity = [1, 2, 3];
    const state = { position, velocity, time: 4 };
    predict(state, 10);
    assert.deepEqual(position, [0, 0, 1]);
    assert.deepEqual(velocity, [1, 2, 3]);
    assert.equal(state.time, 4);
  });

  test('returns the same position for the same arguments', () => {
    const state = { position: [1, 2, 3], velocity: [-1, 0.5, 2], time: 10 };
    assert.deepEqual(predict(state, 14), [-3, 4, 11]);
    assert.deepEqual(predict(state, 14), predict(state, 14));
  });
});

describe('needsCorrection', () => {
  test('returns false when a 2D distance equals the threshold', () => {
    assert.equal(needsCorrection([0, 0], [3, 4], 5), false);
  });

  test('returns true when a 2D distance is greater than the threshold', () => {
    assert.equal(needsCorrection([0, 0], [3, 4], 4), true);
  });

  test('returns false when a 2D distance is less than the threshold', () => {
    assert.equal(needsCorrection([0, 0], [3, 4], 6), false);
  });

  test('returns false when a 3D distance equals the threshold', () => {
    assert.equal(needsCorrection([0, 0, 0], [1, 2, 2], 3), false);
  });

  test('returns true when a 3D distance is greater than the threshold', () => {
    assert.equal(needsCorrection([0, 0, 0], [1, 2, 2], 2), true);
  });

  test('returns false when a 3D distance is less than the threshold', () => {
    assert.equal(needsCorrection([0, 0, 0], [1, 2, 2], 4), false);
  });

  test('treats a zero threshold as any nonzero distance', () => {
    assert.equal(needsCorrection([0, 0], [0, 0], 0), false);
    assert.equal(needsCorrection([0, 0, 0], [0, 0, 0], 0), false);
    assert.equal(needsCorrection([0, 0], [1, 0], 0), true);
    assert.equal(needsCorrection([0, 0, 0], [0, 0, 1], 0), true);
  });

  test('compares a prediction with an authoritative position', () => {
    const predicted = predict(
      { position: [0, 0], velocity: [1, 0], time: 0 },
      2,
    );
    assert.deepEqual(predicted, [2, 0]);
    assert.equal(needsCorrection(predicted, [2, 0], 0), false);
    assert.equal(needsCorrection(predicted, [5, 4], 5), false);
    assert.equal(needsCorrection(predicted, [5, 4], 4), true);
  });
});

describe('correctionStep', () => {
  test('snaps a 2D position when the error is above the hard limit', () => {
    const from = [0, 0];
    const to = [3, 4];
    const step = correctionStep(from, to, {
      elapsed: 0,
      blendTime: 1,
      snapDistance: 4,
    });
    assert.deepEqual(step.position, [3, 4]);
    assert.equal(step.snapped, true);
    assert.notEqual(step.position, to);
  });

  test('snaps a 3D position when the error is above the hard limit', () => {
    const step = correctionStep([0, 0, 0], [1, 2, 2], {
      elapsed: -5,
      blendTime: 4,
      snapDistance: 2,
    });
    assert.deepEqual(step.position, [1, 2, 2]);
    assert.equal(step.snapped, true);
  });

  test('blends a 2D position when the error equals the hard limit', () => {
    const step = correctionStep([0, 0], [3, 4], {
      elapsed: 1,
      blendTime: 2,
      snapDistance: 5,
    });
    assert.deepEqual(step.position, [1.5, 2]);
    assert.equal(step.snapped, false);
  });

  test('blends a 3D position when the error equals the hard limit', () => {
    const step = correctionStep([0, 0, 0], [1, 2, 2], {
      elapsed: 1,
      blendTime: 2,
      snapDistance: 3,
    });
    assert.deepEqual(step.position, [0.5, 1, 1]);
    assert.equal(step.snapped, false);
  });

  test('blends a 2D position when the error is below the hard limit', () => {
    const step = correctionStep([0, 0], [4, 0], {
      elapsed: 1,
      blendTime: 4,
      snapDistance: 5,
    });
    assert.deepEqual(step.position, [1, 0]);
    assert.equal(step.snapped, false);
  });

  test('keeps a 2D position when elapsed time is zero and the error is within the limit', () => {
    const from = [2, 3];
    const step = correctionStep(from, [6, 3], {
      elapsed: 0,
      blendTime: 1,
      snapDistance: 5,
    });
    assert.deepEqual(step.position, [2, 3]);
    assert.equal(step.snapped, false);
    assert.notEqual(step.position, from);
  });

  test('keeps a 3D position when elapsed time is zero and the error is within the limit', () => {
    const step = correctionStep([1, 1, 1], [5, 9, 13], {
      elapsed: 0,
      blendTime: 4,
      snapDistance: 20,
    });
    assert.deepEqual(step.position, [1, 1, 1]);
    assert.equal(step.snapped, false);
  });

  test('keeps a 2D position when elapsed time is negative and the error is within the limit', () => {
    const step = correctionStep([2, 3], [6, 3], {
      elapsed: -1,
      blendTime: 1,
      snapDistance: 5,
    });
    assert.deepEqual(step.position, [2, 3]);
    assert.equal(step.snapped, false);
  });

  test('keeps a 3D position when elapsed time is negative and the error is within the limit', () => {
    const step = correctionStep([1, 1, 1], [5, 9, 13], {
      elapsed: -0.5,
      blendTime: 4,
      snapDistance: 20,
    });
    assert.deepEqual(step.position, [1, 1, 1]);
    assert.equal(step.snapped, false);
  });

  test('lands on the 2D target when elapsed time reaches the blend duration', () => {
    const to = [0.1, 0.2];
    const step = correctionStep([0, 0], to, {
      elapsed: 4,
      blendTime: 4,
      snapDistance: 10,
    });
    assert.deepEqual(step.position, [0.1, 0.2]);
    assert.equal(step.snapped, false);
    assert.notEqual(step.position, to);
  });

  test('lands on the 3D target when elapsed time passes the blend duration', () => {
    const step = correctionStep([1, 1, 1], [5, 9, 13], {
      elapsed: 8,
      blendTime: 4,
      snapDistance: 20,
    });
    assert.deepEqual(step.position, [5, 9, 13]);
    assert.equal(step.snapped, false);
  });

  test('blends a 3D position by the fraction of blend time that has elapsed', () => {
    const step = correctionStep([1, 1, 1], [5, 9, 13], {
      elapsed: 1,
      blendTime: 4,
      snapDistance: 20,
    });
    assert.deepEqual(step.position, [2, 3, 4]);
    assert.equal(step.snapped, false);
  });

  test('does not mutate the endpoints', () => {
    const from = [0, 0, 0];
    const to = [1, 2, 2];
    correctionStep(from, to, {
      elapsed: 1,
      blendTime: 2,
      snapDistance: 1,
    });
    assert.deepEqual(from, [0, 0, 0]);
    assert.deepEqual(to, [1, 2, 2]);
  });
});

describe('pipeline', () => {
  test('follows the documented prediction and blend', () => {
    const predicted = predict(
      { position: [0, 0], velocity: [1, 0], time: 0 },
      2,
    );
    const authoritative = [2, 1];
    assert.deepEqual(predicted, [2, 0]);
    assert.equal(needsCorrection(predicted, authoritative, 0.5), true);
    const step = correctionStep(predicted, authoritative, {
      elapsed: 1,
      blendTime: 4,
      snapDistance: 5,
    });
    assert.deepEqual(step.position, [2, 0.25]);
    assert.equal(step.snapped, false);
  });
});

describe('invalid input', () => {
  test('rejects a missing state', () => {
    assert.throws(() => predict(null, 0), {
      name: 'TypeError',
      message: /state/,
    });
    assert.throws(() => predict(undefined, 0), TypeError);
    assert.throws(() => predict(1, 0), TypeError);
    assert.throws(() => predict([], 0), TypeError);
  });

  test('rejects an incomplete state', () => {
    assert.throws(() => predict({ velocity: [1], time: 0 }, 1), {
      name: 'TypeError',
      message: /position/,
    });
    assert.throws(() => predict({ position: [1], time: 0 }, 1), {
      name: 'TypeError',
      message: /velocity/,
    });
    assert.throws(() => predict({ position: [1], velocity: [1] }, 1), {
      name: 'TypeError',
      message: /time/,
    });
  });

  test('rejects empty vectors and mismatched state lengths', () => {
    assert.throws(
      () => predict({ position: [], velocity: [], time: 0 }, 1),
      TypeError,
    );
    assert.throws(
      () => predict({ position: [1, 2], velocity: [1], time: 0 }, 1),
      {
        name: 'TypeError',
        message: /length/,
      },
    );
  });

  test('rejects non-finite state components and timestamps', () => {
    assert.throws(
      () => predict({ position: [Number.NaN], velocity: [1], time: 0 }, 1),
      TypeError,
    );
    assert.throws(
      () => predict({ position: [Infinity], velocity: [0], time: 0 }, 1),
      TypeError,
    );
    assert.throws(
      () => predict({ position: ['1'], velocity: [0], time: 0 }, 1),
      TypeError,
    );
    assert.throws(
      () => predict({ position: [1], velocity: [1], time: Number.NaN }, 1),
      TypeError,
    );
    assert.throws(
      () => predict({ position: [1], velocity: [1], time: 0 }, Infinity),
      {
        name: 'TypeError',
        message: /time/,
      },
    );
  });

  test('rejects a sparse position', () => {
    const position = [1, 2, 3];
    delete position[1];
    assert.throws(
      () => predict({ position, velocity: [0, 0, 0], time: 0 }, 1),
      TypeError,
    );
  });

  test('rejects invalid correction thresholds', () => {
    assert.throws(() => needsCorrection([0, 0], [1, 0], -1), {
      name: 'RangeError',
      message: /threshold/,
    });
    assert.throws(() => needsCorrection([0, 0], [1, 0], Number.NaN), {
      name: 'TypeError',
      message: /threshold/,
    });
    assert.throws(() => needsCorrection([0, 0], [1, 0], '1'), TypeError);
    assert.throws(() => needsCorrection([0], [1, 2], 1), {
      name: 'TypeError',
      message: /length/,
    });
    assert.throws(() => needsCorrection([0, 0], null, 1), TypeError);
  });

  test('rejects invalid correction steps', () => {
    assert.throws(() => correctionStep([0], [1], null), {
      name: 'TypeError',
      message: /options/,
    });
    assert.throws(() => correctionStep([0], [1], []), TypeError);
    assert.throws(
      () =>
        correctionStep([0], [1], {
          elapsed: 0,
          blendTime: 0,
          snapDistance: 1,
        }),
      {
        name: 'RangeError',
        message: /blendTime/,
      },
    );
    assert.throws(
      () =>
        correctionStep([0], [1], {
          elapsed: 0,
          blendTime: -1,
          snapDistance: 1,
        }),
      RangeError,
    );
    assert.throws(
      () =>
        correctionStep([0], [1], {
          elapsed: 0,
          blendTime: 1,
          snapDistance: -1,
        }),
      {
        name: 'RangeError',
        message: /snapDistance/,
      },
    );
    assert.throws(
      () =>
        correctionStep([0], [1], {
          elapsed: Number.NaN,
          blendTime: 1,
          snapDistance: 1,
        }),
      {
        name: 'TypeError',
        message: /elapsed/,
      },
    );
    assert.throws(
      () =>
        correctionStep([0, 0], [1], {
          elapsed: 0,
          blendTime: 1,
          snapDistance: 1,
        }),
      {
        name: 'TypeError',
        message: /length/,
      },
    );
  });
});
