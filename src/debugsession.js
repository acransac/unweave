const { breakpoints, commandLine, displayedScript, environmentTree, focusableCaptureLog, instructions, logCapture, messages, runLocation, scriptSource, sourceTree, topRightColumnDisplay } = require('./components.js');
const { scrollableContent, tag, unpackedContent, writeScriptSource } = require('./helpers.js');
const { addBreakpoint, changeMode, loop, parseCaptures, parseEnvironmentTree, parseSourceTree, pullScriptSource, queryInspector, step } = require('./processes.js');
const { breakpointCapture, columnNumber, interactionKeys, isBreakpointCapture, isDebuggerPaused, isQueryCapture, pauseLocation, query } = require('./protocol.js');
const { atom, column, compose, cons, emptyList, indent, label, row, show, sizeHeight, sizeWidth, vindent } = require('terminal');

function debugSession(send, render, terminate) {
  return async (stream) => {
    const debugLogger = message => columnNumber(pauseLocation(message));

    return loop(terminate)(await show(render)(compose(developerSession,
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

function developerSession(source,
	                  runLocation,
	                  breakpoints,
	                  displayedScript,
	                  topRightColumnDisplay,
	                  environmentTree,
	                  messages,
	                  sourceTree,
	                  command,
                          instructions,
                          queryCapture,
                          breakpointCapture) {
  return cons(
	   cons(
	     sizeWidth(50, label(atom(writeScriptSource(unpackedContent(source), runLocation, breakpoints, displayedScript)),
	                         tag(source))),
	     cons(
	       cons(
	         topRightColumnDisplay(environmentTree, sourceTree),
	         cons(
	           vindent(50, sizeHeight(50, label(atom(scrollableContent(unpackedContent(messages))), tag(messages)))),
	  	   indent(50, column(50)))),
	       row(90))),
	   cons(
	     cons(
	       command(instructions, queryCapture, breakpointCapture),
 	       vindent(90, row(10))),
	     emptyList()));
}

module.exports = { debugSession };
