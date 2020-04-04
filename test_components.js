const { environmentTree } = require('./components.js');
const { tag, unpackedContent, writeEnvironmentTree } = require('./helpers.js');
const { init } = require('./init.js');
const { changeMode, parseEnvironmentTree } = require('./processes.js');
const { continuation, forget, later, now } = require('streamer');
const { atom, compose, label, show, TerminalTest } = require('terminal');
const { skipToDebuggerPausedAfterStepping, userInput } = require('./testutils.js');

function test_environment(send, render, terminate) {
  const fakeUserInteraction = async (stream) => {
    userInput("e", 1000);
    userInput("l", 1500);
    userInput("\r", 2000);

    return stream;
  };

  const firstStep = async (stream) => {
    return firstStep(await continuation(now(stream))(forget(await later(stream))));
  };

  const environmentDisplay = environment => label(atom(writeEnvironmentTree(unpackedContent(environment)), tag(environment)));

  return async (stream) => {
    return terminate(await firstStep
	              (await fakeUserInteraction
	                (await show(render)(compose(environmentDisplay, environmentTree()))
	                  (await parseEnvironmentTree(send)
		            (await changeMode
	                      (await skipToDebuggerPausedAfterStepping(send, 1)(stream)))))));
  };
}

TerminalTest.reviewDisplays([
  TerminalTest.makeTestableReactiveDisplay(test_environment, "Environment", (displayTarget, test) => {
    return init(["node", "app.js", "test_target.js"], test, displayTarget);
  })
]);
