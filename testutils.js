const { isDebuggerPaused, message, sendStepOver } = require('./protocol.js');
const { later } = require('streamer');

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

module.exports = {
  skipToDebuggerPausedAfterStepping
}
