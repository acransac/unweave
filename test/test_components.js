const { breakpoints, displayedScript, environmentTree, runLocation, scriptSource } = require('../src/components.js');
const { ctrlCInput, enterInput, tag, unpackedContent, writeEnvironmentTree, writeScriptSource } = require('../src/helpers.js');
const { init } = require('../src/init.js');
const { addBreakpoint, changeMode, loop, parseCaptures, parseEnvironmentTree, pullScriptSource, step } = require('../src/processes.js');
const { interactionKeys } = require('../src/protocol.js');
const { atom, compose, label, show, TerminalTest } = require('terminal');
const { makeInputSequence, skipToDebuggerPausedAfterStepping, userInput } = require('../src/testutils.js');

function test_environment(send, render, terminate) {
  const userInteraction = async (stream) => {
    userInput(makeInputSequence([
      "",
      interactionKeys("stepOver"),
      interactionKeys("environmentTreeFocus"),
      interactionKeys("selectChild"),
      interactionKeys("selectNext"),
      interactionKeys("selectPrevious"),
      interactionKeys("selectParent"),
      enterInput(),
      ctrlCInput()
    ]));

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
  const repeat = (key, count) => new Array(count).fill(key);

  const userInteraction = async (stream) => {
    userInput(makeInputSequence([""]),
	      makeInputSequence([...repeat(interactionKeys("scrollDown"), 9), ...repeat(interactionKeys("scrollUp"), 9)], 2),
              makeInputSequence([interactionKeys("breakpointCapture"), "8", enterInput()]),
	      makeInputSequence([
	        interactionKeys("stepOver"),
		interactionKeys("stepInto"),
		interactionKeys("stepOut"),
		interactionKeys("continue"),
		ctrlCInput()
              ], 0.5));

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
	           (await addBreakpoint(send)
	             (await pullScriptSource(send)
		       (await parseCaptures()
		         (await changeMode
	                   (await skipToDebuggerPausedAfterStepping(send, 0)(stream)))))))));
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
    return init(["node", "app.js", "test_target_script_source.js"], test, finish, displayTarget);
  })
], "Test Components");
