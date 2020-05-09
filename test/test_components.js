const { breakpoints, commandLine, displayedScript, environmentTree, focusableCaptureLog, instructions, logCapture, runLocation, scriptSource, sourceTree, topRightColumnDisplay } = require('../src/components.js');
const { backspaceInput, ctrlCInput, enterInput, tag, unpackedContent, writeEnvironmentTree, writeScriptSource, writeSourceTree } = require('../src/helpers.js');
const { init } = require('../src/init.js');
const { addBreakpoint, changeMode, loop, parseCaptures, parseEnvironmentTree, parseSourceTree, pullScriptSource, step } = require('../src/processes.js');
const { breakpointCapture, interactionKeys, isBreakpointCapture, isDebuggerPaused, isQueryCapture, message, query } = require('../src/protocol.js');
const { commit } = require('streamer');
const { atom, compose, cons, emptyList, inline, label, show, sizeWidth, TerminalTest } = require('terminal');
const { makeInputSequence, repeatKey, skipToDebuggerPausedAfterStepping, userInput } = require('../src/testutils.js');

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
  const userInteraction = async (stream) => {
    userInput(makeInputSequence([""]),
	      makeInputSequence([
	        ...repeatKey(interactionKeys("scrollDown"), 9),
		...repeatKey(interactionKeys("scrollUp"), 9)
	      ], 2),
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

function test_sourceTree(send, render, terminate) {
  const userInteraction = async (stream) => {
    if (isDebuggerPaused(message(stream))) {
      userInput(makeInputSequence([
        "",
	interactionKeys("stepOver"),
	interactionKeys("sourceTreeFocus"),
	interactionKeys("selectPrevious"),
	interactionKeys("selectChild"),
	...repeatKey(interactionKeys("selectNext"), 2),
	interactionKeys("selectChild"),
	enterInput(),
	interactionKeys("sourceTreeFocus"),
	interactionKeys("selectParent"),
	enterInput(),
	interactionKeys("stepOver"),
	interactionKeys("sourceTreeFocus"),
	interactionKeys("selectParent"),
	interactionKeys("selectNext"),
	interactionKeys("selectChild"),
	enterInput(),
	ctrlCInput()
      ]));

      return stream;
    }
    else {
      return commit(stream, userInteraction);
    }
  };

  const sourceTreeDisplay = (scriptSource, runLocation, breakpoints, displayedScript, sourceTree) => {
    return inline(cons(
	           sizeWidth(50, label(atom(writeScriptSource(unpackedContent(scriptSource),
			                                      runLocation,
			                                      breakpoints,
			                                      displayedScript)),
	                               tag(scriptSource))),
	           cons(
		     sizeWidth(50, label(atom(writeSourceTree(unpackedContent(sourceTree))), tag(sourceTree))),
		     emptyList())));
  };

  return async (stream) => {
    return loop(terminate)
	     (await userInteraction
	       (await show(render)(compose(sourceTreeDisplay,
		                           scriptSource(),
		                           runLocation(),
		                           breakpoints(),
		                           displayedScript(),
	                                   sourceTree()))
		 (await step(send)
	           (await pullScriptSource(send)
		     (await parseSourceTree()
		       (await parseCaptures()
	                 (await changeMode(stream))))))));
  };
}

function test_instructions(send, render, terminate) {
  const userInteraction = async (stream) => {
    userInput(makeInputSequence([
      "",
      interactionKeys("environmentTreeFocus"),
      enterInput(),
      interactionKeys("sourceTreeFocus"),
      enterInput(),
      interactionKeys("messagesFocus"),
      enterInput(),
      ctrlCInput()
    ], 0.3));

    return stream;
  };

  const instructionsDisplay = instructions => label(atom(unpackedContent(instructions)), tag(instructions));

  return async (stream) => {
    return loop(terminate)
	     (await userInteraction
	       (await show(render)(compose(instructionsDisplay, instructions()))
	         (await changeMode
	           (await skipToDebuggerPausedAfterStepping(send, 0)(stream)))));
  };
}

function test_capture(isCapture, readCapture, focusKey, promptPrefix, labelName) {
  return (send, render, terminate) => {
    const userInteraction = async (stream) => {
      userInput(makeInputSequence(["", focusKey]),
                makeInputSequence(["a", "1", "b", "2", ...repeatKey(backspaceInput(), 5), enterInput(), ctrlCInput()], 2));

      return stream;
    };

    const captureDisplay = capture => label(atom(unpackedContent(capture)), tag(capture));

    return async (stream) => {
      return loop(terminate)
               (await userInteraction
                 (await show(render)(compose(captureDisplay, focusableCaptureLog(logCapture(isCapture,
			                                                                    readCapture,
          					                                            promptPrefix),
          						                         isCapture,
          						                         labelName,
          						                         focusKey)))
                   (await parseCaptures()
                     (await changeMode
                       (await skipToDebuggerPausedAfterStepping(send, 0)(stream))))));
    };
  };
}

function test_breakpointCapture() {
  return test_capture(isBreakpointCapture,
	              breakpointCapture,
	              interactionKeys("breakpointCapture"),
	              "Add breakpoint at line",
	              "add breakpoint");
}

function test_queryCapture() {
  return test_capture(isQueryCapture, query, interactionKeys("queryCapture"), "Query Inspector", "query Inspector");
}

function test_commandLine(send, render, terminate) {
  const userInteraction = async (stream) => {
    userInput(makeInputSequence([
      "",
      interactionKeys("queryCapture"),
      enterInput(),
      interactionKeys("breakpointCapture"),
      enterInput(),
      ctrlCInput()
    ]));

    return stream;
  };

  const commandLineDisplay = (commandLine, instructions, queryCapture, breakpointCapture) => commandLine(instructions,
	                                                                                                 queryCapture,
	                                                                                                 breakpointCapture);

  return async (stream) => {
    return loop(terminate)
	     (await userInteraction
	       (await show(render)(compose(commandLineDisplay,
		                           commandLine(),
		                           instructions(),
                                           focusableCaptureLog(logCapture(isQueryCapture, query, "Query Inspector"),
						               isQueryCapture,
						               "query Inspector",
						               interactionKeys("queryCapture")),
                                           focusableCaptureLog(logCapture(isBreakpointCapture,
							                  breakpointCapture,
						                          "Add breakpoint at line"),
							       isBreakpointCapture,
							       "add breakpoint",
							       interactionKeys("breakpointCapture"))))
	         (await changeMode
	           (await skipToDebuggerPausedAfterStepping(send, 0)(stream)))));
  };
}

function test_topRightColumnDisplay(send, render, terminate) {
  const userInteraction = async (stream) => {
    userInput(makeInputSequence([
      "",
      interactionKeys("environmentTreeFocus"),
      enterInput(),
      interactionKeys("sourceTreeFocus"),
      enterInput(),
      ctrlCInput()
    ]));

    return stream;
  };

  const topRightDisplay = (topRightColumnDisplay, environmentTree, sourceTree) => topRightColumnDisplay(environmentTree,
	                                                                                                sourceTree);

  return async (stream) => {
    return loop(terminate)
	     (await userInteraction
	       (await show(render)(compose(topRightDisplay, topRightColumnDisplay(), environmentTree(), sourceTree()))
	         (await changeMode
	           (await skipToDebuggerPausedAfterStepping(send, 0)(stream)))));
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
  }),
  TerminalTest.makeTestableReactiveDisplay(test_sourceTree, "Source Tree", (displayTarget, test, finish) => {
    return init(["node", "app.js", "test_target_source_tree_dir/test_target_source_tree.js"], test, finish, displayTarget);
  }),
  TerminalTest.makeTestableReactiveDisplay(test_instructions, "Instructions", (displayTarget, test, finish) => {
    return init(["node", "app.js", "test_target.js"], test, finish, displayTarget);
  }),
  TerminalTest.makeTestableReactiveDisplay(test_breakpointCapture(), "Breakpoint Capture", (displayTarget, test, finish) => {
    return init(["node", "app.js", "test_target.js"], test, finish, displayTarget);
  }),
  TerminalTest.makeTestableReactiveDisplay(test_queryCapture(), "Query Capture", (displayTarget, test, finish) => {
    return init(["node", "app.js", "test_target.js"], test, finish, displayTarget);
  }),
  TerminalTest.makeTestableReactiveDisplay(test_commandLine, "Command Line", (displayTarget, test, finish) => {
    return init(["node", "app.js", "test_target.js"], test, finish, displayTarget);
  }),
  TerminalTest.makeTestableReactiveDisplay(test_topRightColumnDisplay,
	                                   "Top Right Column Display",
	                                   (displayTarget, test, finish) => {
    return init(["node", "app.js", "test_target.js"], test, finish, displayTarget);
  })
], "Test Components");
