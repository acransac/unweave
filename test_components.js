const { environment } = require('./components.js');
const { tag, unpackedContent } = require('./helpers.js');
const { init } = require('./init.js');
const { continuation, forget, later, now } = require('streamer');
const { atom, compose, label, show, TerminalTest } = require('terminal');
const { skipToDebuggerPausedAfterStepping, userInput } = require('./testutils.js');

function test_environment(send, render, terminate) {
  const firstStep = async (stream) => {
    userInput("e", 2000);

    return await continuation(now(stream))(forget(await later(stream)));
  };

  const environmentDisplay = environment => label(atom(unpackedContent(environment)), tag(environment));

  return async (stream) => {
    return terminate(await firstStep(await show(render)(compose(environmentDisplay, environment()))
	                              (await skipToDebuggerPausedAfterStepping(send, 1)(stream))));
  };
}

TerminalTest.reviewDisplays([
  TerminalTest.makeTestableReactiveDisplay(test_environment, "Environment", (displayTarget, test) => {
    return init(["node", "app.js", "test_target.js"], test, displayTarget);
  })
]);
