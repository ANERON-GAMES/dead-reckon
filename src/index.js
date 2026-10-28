function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function assertFiniteNumber(value, name) {
  if (!isFiniteNumber(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

function assertNonNegative(value, name) {
  assertFiniteNumber(value, name);
  if (value < 0) {
    throw new RangeError(`${name} must be greater than or equal to 0`);
  }
}

function assertPositive(value, name) {
  assertFiniteNumber(value, name);
  if (value <= 0) {
    throw new RangeError(`${name} must be greater than 0`);
  }
}

function assertVector(value, name) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty array of finite numbers`);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!isFiniteNumber(value[index])) {
      throw new TypeError(
        `${name} must be a non-empty array of finite numbers`,
      );
    }
  }
}

function assertSameLength(left, right, message) {
  if (left.length !== right.length) {
    throw new TypeError(message);
  }
}

function assertState(state) {
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('state must be an object');
  }
  assertVector(state.position, 'position');
  assertVector(state.velocity, 'velocity');
  assertSameLength(
    state.position,
    state.velocity,
    'position and velocity must have the same length',
  );
  assertFiniteNumber(state.time, 'time');
}

function distance(left, right) {
  const components = new Array(left.length);
  for (let index = 0; index < left.length; index += 1) {
    components[index] = left[index] - right[index];
  }
  return Math.hypot(...components);
}

function blend(from, to, alpha) {
  const position = new Array(from.length);
  for (let index = 0; index < from.length; index += 1) {
    position[index] = from[index] + (to[index] - from[index]) * alpha;
  }
  return position;
}

export function predict(state, time) {
  assertState(state);
  assertFiniteNumber(time, 'time');
  const elapsed = time - state.time;
  const position = new Array(state.position.length);
  for (let index = 0; index < state.position.length; index += 1) {
    position[index] = state.position[index] + state.velocity[index] * elapsed;
  }
  return position;
}

export function needsCorrection(predicted, authoritative, threshold) {
  assertVector(predicted, 'predicted');
  assertVector(authoritative, 'authoritative');
  assertSameLength(
    predicted,
    authoritative,
    'predicted and authoritative must have the same length',
  );
  assertNonNegative(threshold, 'threshold');
  return distance(predicted, authoritative) > threshold;
}

export function correctionStep(from, to, options) {
  assertVector(from, 'from');
  assertVector(to, 'to');
  assertSameLength(from, to, 'from and to must have the same length');
  if (
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('options must be an object');
  }
  assertFiniteNumber(options.elapsed, 'elapsed');
  assertPositive(options.blendTime, 'blendTime');
  assertNonNegative(options.snapDistance, 'snapDistance');

  if (distance(from, to) > options.snapDistance) {
    return { position: to.slice(), snapped: true };
  }
  if (options.elapsed <= 0) {
    return { position: from.slice(), snapped: false };
  }
  if (options.elapsed >= options.blendTime) {
    return { position: to.slice(), snapped: false };
  }
  return {
    position: blend(from, to, options.elapsed / options.blendTime),
    snapped: false,
  };
}
