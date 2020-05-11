const { breakpoints, commandLine, displayedScript, environmentTree, focusableCaptureLog, instructions, logCapture, messages, runLocation, scriptSource, sourceTree, topRightColumnDisplay } = require('./components.js');
const { addBreakpoint, changeMode, loop, parseCaptures, parseEnvironmentTree, parseSourceTree, pullScriptSource, queryInspector, step } = require('./processes.js');
const { breakpointCapture, columnNumber, interactionKeys, isBreakpointCapture, isDebuggerPaused, isQueryCapture, pauseLocation, query } = require('./protocol.js');
const { developerDisplay } = require('./templates.js');
const { compose, show } = require('terminal');

function debugSession(send, render, terminate) {
  return async (stream) => {
    const debugLogger = message => columnNumber(pauseLocation(message));

    return loop(terminate)(await show(render)(compose(developerDisplay,
			                              scriptSource(),
			                              runLocation(),
			                              breakpoints(),
			                              displayedScript(),
		                                      topRightColumnDisplay(),
			                              environmentTree(),
			                              messages(isDebuggerPaused, debugLogger),
		                                      sourceTree(),
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
							                  interactionKeys("breakpointCapture"))))(
	                                        await step(send)(
	                                          await queryInspector(send)(
		                                    await addBreakpoint(send)(
		                                      await pullScriptSource(send)(
		                                        await parseEnvironmentTree(send)(
			                                  await parseSourceTree()(
			                                    await parseCaptures()(
		  	                                      await changeMode(stream))))))))));
  };
}

module.exports = { debugSession };
