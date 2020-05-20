const { breakpoints, commandLine, displayedScript, environmentTree, focusableCaptureLog, instructions, logCapture, messages, runLocation, scriptSource, sourceTree, topRightColumnDisplay } = require('../src/components.js');
const { ctrlCInput } = require('../src/helpers.js');
const { init } = require('../src/init.js');
const { loop } = require('../src/processes.js');
const { interactionKeys } = require('../src/protocol.js');
const { developerDisplay } = require('../src/templates.js');
const { compose, show, TerminalTest } = require('terminal');
const { makeInputSequence, skipToDebuggerPausedAfterStepping, userInput } = require('../src/testutils.js');

function test_developerDisplay(send, render, terminate) {
  const userInteraction = async (stream) => {
    userInput(makeInputSequence(["", ctrlCInput()], 0.3));

    return stream;
  };

  return async (stream) => {
    return loop(terminate)
	     (await userInteraction
	       (await show(render)(compose(developerDisplay,
			                   scriptSource(),
			                   runLocation(),
			                   breakpoints(),
			                   displayedScript(),
		                           topRightColumnDisplay(),
			                   environmentTree(),
			                   messages(message => false, () => {}),
		                           sourceTree(),
			                   commandLine(),
                                           instructions(),
                                           focusableCaptureLog(logCapture(message => false, message => {}, ""),
						               message => false,
						               "query Inspector",
						               interactionKeys("queryCapture")),
                                           focusableCaptureLog(logCapture(message => false, message => {}, ""),
							       message => false,
							       "add breakpoint",
							       interactionKeys("breakpointCapture"))))
	         (await skipToDebuggerPausedAfterStepping(send, 0)(stream))));
  };
}

module.exports = TerminalTest.reviewDisplays([
  TerminalTest.makeTestableReactiveDisplay(test_developerDisplay, "Developer Display", (displayTarget, test, finish) => {
    return init(["node", "app.js", "targets/test_target.js"], test, finish, displayTarget);
  })
], "Test Templates");
