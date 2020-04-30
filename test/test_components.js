const { breakpoints, displayedScript, environmentTree, runLocation, scriptSource } = require('../src/components.js');
const { tag, unpackedContent, writeEnvironmentTree, writeScriptSource } = require('../src/helpers.js');
const { init } = require('../src/init.js');
const { changeMode, loop, parseEnvironmentTree, pullScriptSource, step } = require('../src/processes.js');
const { atom, compose, label, show, TerminalTest } = require('terminal');
const { skipToDebuggerPausedAfterStepping, userInput } = require('../src/testutils.js');

function test_environment(send, render, terminate) {
  const userInteraction = async (stream) => {
    userInput("n", 1000);
    userInput("e", 2000);
    userInput("l", 2500);
    userInput("j", 3000);
    userInput("k", 3500);
    userInput("h", 4000);
    userInput("\r", 4500);
    userInput("\x03", 5000);

    return stream;
  };

  const environmentDisplay = environment => label(atom(writeEnvironmentTree(unpackedContent(environment))), tag(environment));

  return async (stream) => {
    return loop(terminate)
	     (await userInteraction
	       (await show(render)(compose(environmentDisplay, environmentTree()))
		 (await step(send)
	           (await parseEnvironmentTree(send)
		     (await changeMode
	               (await skipToDebuggerPausedAfterStepping(send, 0)(stream)))))));
  };
}

function test_scriptSource(send, render, terminate) {
  const userInteraction = async (stream) => {
    userInput("\x03", 3000);

    return stream;
  };

  const scriptSourceDisplay = (source, runLocation, breakpoints, displayedScript) => {
    return label(atom(writeScriptSource(unpackedContent(source), runLocation, breakpoints, displayedScript)), tag(source));
  };

  return async (stream) => {
    return loop(terminate)
	     (await userInteraction
	       (await show(render)(compose(scriptSourceDisplay,
		                           scriptSource(),
		                           runLocation(),
		                           breakpoints(),
		                           displayedScript()))
		 (await step(send)
	           (await pullScriptSource(send)
		     (await changeMode
	               (await skipToDebuggerPausedAfterStepping(send, 0)(stream)))))));
  };
}

module.exports = TerminalTest.reviewDisplays([
  TerminalTest.makeTestableReactiveDisplay(test_environment, "Environment With Object", (displayTarget, test, finish) => {
    return init(["node", "app.js", "test_target.js"], test, finish, displayTarget);
  }),
  TerminalTest.makeTestableReactiveDisplay(test_environment, "Environment With Array", (displayTarget, test, finish) => {
    return init(["node", "app.js", "test_target_array.js"], test, finish, displayTarget);
  }),
  TerminalTest.makeTestableReactiveDisplay(test_scriptSource, "Script Source", (displayTarget, test, finish) => {
    return init(["node", "app.js", "test_target.js"], test, finish, displayTarget);
  })
], "Test Components");
