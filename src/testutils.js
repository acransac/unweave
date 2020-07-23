// Copyright (c) Adrien Cransac
// License: MIT

const { input, isDebuggerPaused, isInput, makeInput, message, sendStepOver } = require('./protocol.js');
const { commit, floatOn, later } = require('@acransac/streamer');

// # Initialize Tests

/*
 * Skip all messages until the debugger is paused after some steps have been registered in the program's execution
 * @param {function} send - The callback to send requests over websocket to Inspector
 * @param {number} stepsToMake - The number of steps to register after the execution has started
 * @return {Process} - The process to start with in the composition passed to the test's streamer downstream
 */
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

// # Mock User Input
// ## Input Sequence

/*
 * Make an input sequence
 * @param {string[]} inputs - An array of characters which are the mocked user inputs, occuring in the array's order
 * @param {number} [inputsPerSecond: 1] - The number of inputs to trigger per second
 * @return {InputSequence}
 */
function makeInputSequence(inputs, inputsPerSecond) {
  return [inputs, inputsPerSecond ? inputsPerSecond : 1];
}

function inputs(inputSequence) {
  return inputSequence[0];
}

function inputsPerSecond(inputSequence) {
  return inputSequence[1];
}

// ## Record Inputs

/*
 * Assign each user input to a capture
 * @param {function} makeCapture - The capture's constructor
 * @return {Process} - The process outputs the given capture associated with the key on input messages
 */
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

/*
 * Create an array of characters with the same key repeated
 * @param {string} key - The character to repeat
 * @param {number} count - The number of times to repeat the key
 * @return {string[]}
 */
function repeatKey(key, count) {
  return new Array(count).fill(key);
}

/*
 * Trigger the standard input with predefined keys
 * @param {...InputSequence} inputSequences - A series of input sequences to trigger in turn, at their specified rate
 * @return {}
 */
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

module.exports = {
  inputIsCapture,
  makeInputSequence,
  repeatKey,
  skipToDebuggerPausedAfterStepping,
  userInput
}
