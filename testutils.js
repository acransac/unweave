const { isDebuggerPaused, isInput, message, sendStepOver } = require('./protocol.js');
const { commit, floatOn, later } = require('streamer');

function skipToDebuggerPausedAfterStepping(send, stepsToMake) {
  const skipper = stepsToMake => {
    return async (stream) => {
     if (isDebuggerPaused(message(stream)) && stepsToMake === 0) {
       return stream;
     }
     else if (isDebuggerPaused(message(stream))) {
       sendStepOver(send);

       return skipper(stepsToMake - 1)(await later(stream));
     }
     else {
       return skipper(stepsToMake)(await later(stream));
     }
    };
  };

  return skipper(stepsToMake);
}

function inputIsCapture(makeCapture) {
  const captureMaker = async (stream) => {
    if (isInput(message(stream))) {
      return commit(floatOn(stream, makeCapture(input(message(stream)))), captureMaker);
    }
    else {
      return commit(stream, captureMaker);
    }
  };

  return captureMaker;
}

module.exports = {
  inputIsCapture,
  skipToDebuggerPausedAfterStepping
}
