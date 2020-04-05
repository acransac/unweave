const { environmentTree } = require('./components.js');
const { loop, tag, unpackedContent, writeEnvironmentTree } = require('./helpers.js');
const { init } = require('./init.js');
const { changeMode, parseEnvironmentTree } = require('./processes.js');
const { atom, compose, label, show, TerminalTest } = require('terminal');
const { skipToDebuggerPausedAfterStepping, userInput } = require('./testutils.js');

function test_environment(send, render, terminate) {
  const userInteraction = async (stream) => {
    userInput("e", 1000);
    userInput("l", 1500);
    userInput("j", 2000);
    userInput("k", 2500);
    userInput("h", 3000);
    userInput("\r", 3500);
    userInput("\x03", 4000);

    return stream;
  };

  const environmentDisplay = environment => label(atom(writeEnvironmentTree(unpackedContent(environment))), tag(environment));

  return async (stream) => {
    return loop(terminate)
	     (await userInteraction
	       (await show(render)(compose(environmentDisplay, environmentTree()))
	         (await parseEnvironmentTree(send)
		   (await changeMode
	             (await skipToDebuggerPausedAfterStepping(send, 1)(stream))))));
  };
}

TerminalTest.reviewDisplays([
  TerminalTest.makeTestableReactiveDisplay(test_environment, "Environment", (displayTarget, test) => {
    return init(["node", "app.js", "test_target_component_environment.js"], test, displayTarget);
  })
]);
