const { input, isDebuggerPaused, isInput, makeInput, message, sendStepOver } = require('./protocol.js');
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

// Input sequence type --
function makeInputSequence(inputs, inputsPerSecond) {
  return [inputs, inputsPerSecond ? inputsPerSecond : 1];
}

function inputs(inputSequence) {
  return inputSequence[0];
}

function inputsPerSecond(inputSequence) {
  return inputSequence[1];
}

function userInput(...inputSequences) {
  const registerInput = (delay, inputSequences) => {
    if (inputSequences.length === 0) {
      return delay;
    }
    else {
      return registerInput(inputs(inputSequences[0]).reduce((delay, input) => {
        setTimeout(() => process.stdin.emit("input", makeInput(input)), delay);

        return delay + 1000 / inputsPerSecond(inputSequences[0]);
      }, delay),
	                   inputSequences.slice(1));
    }
  };

  return registerInput(0, inputSequences);
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
  makeInputSequence,
  skipToDebuggerPausedAfterStepping,
  userInput
}
