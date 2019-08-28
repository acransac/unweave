function Source(emitter, emissionCallbackName) {
  this.emitter = emitter;

  this.emissionCallbackName = emissionCallbackName;
}

Source.from = function (eventEmitter, emissionCallbackName) {
  return new Source(eventEmitter, emissionCallbackName);
};

Source.prototype.withDownstream = function (continuation) {
  this.emitter[this.emissionCallbackName] = (value) => continuation(makeStream(value, new Promise((resolve) => {
    this.emitter[this.emissionCallbackName] = (value) => resolve(value);
  }), this));

  return this;
};

function makeStream(now, afterwards, source) {
  return [now, afterwards, source];
}

function now(stream) {
  return stream[0];
}

function afterwards(stream) {
  return stream[1];
}

function source(stream) {
  return stream[2];
}

async function later(stream) {
  return makeStream(await afterwards(stream), new Promise((resolve) => {
    source(stream).emitter[source(stream).emissionCallbackName] = (value) => resolve(value);
  }), source(stream));
}

function floatOn(stream, jsValue) {
  return makeStream(jsValue, afterwards(stream), source(stream));
}

function IO(procedure, ioChannel) {
  return (stream) => procedure(ioChannel)(stream);
}

module.exports = { Source, now, later, floatOn, IO };
