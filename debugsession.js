const { breakpoints, commandLine, displayedScript, environment, focusableCaptureLog, instructions, logCapture, messages, runLocation, scriptSource, sourceTree, topRightColumnDisplay } = require('./components.js');
const { content, isCtrlC, makeDisplayedContent, scrollableContent, tag, topLine, unpackedContent } = require('./helpers.js');
const { addBreakpoint, changeMode, parseCaptures, parseSourceTree, pullEnvironment, pullScriptSource, queryInspector, step } = require('./processes.js');
const { breakpointCapture, input, isBreakpointCapture, isInput, isQueryCapture, isSourceTree, lineNumber, message, query, readSourceTree, scriptHandle } = require('./protocol.js');
const { branches, root } = require('./sourcetree.js');
const { continuation, forget, later, now } = require('streamer');
const { atom, column, compose, cons, emptyList, indent, label, row, show, sizeHeight, sizeWidth, vindent } = require('terminal');

function debugSession(send, render, terminate) {
  return async (stream) => {
    const debugLogger = message => `root: ${root(readSourceTree(message))}, tree: ${JSON.stringify(branches(readSourceTree(message)))}`;

    return loop(terminate)(await show(render)(compose(developerSession,
			                              scriptSource(),
			                              runLocation(),
			                              breakpoints(),
			                              displayedScript(),
		                                      topRightColumnDisplay(),
			                              environment(),
			                              messages(isSourceTree, debugLogger),
		                                      sourceTree(),
			                              commandLine(),
                                                      instructions(),
                                                      focusableCaptureLog(logCapture(isQueryCapture, query, "Query Inspector"),
						                          isQueryCapture,
						                          "query Inspector",
						                          "q"),
                                                      focusableCaptureLog(logCapture(isBreakpointCapture,
							                             breakpointCapture,
						                                     "Add breakpoint at line"),
							                  isBreakpointCapture,
							                  "add breakpoint",
							                  "b")))(
	                                        await step(send)(
	                                          await queryInspector(send)(
		                                    await addBreakpoint(send)(
		                                      await pullEnvironment(send)(
		                                        await pullScriptSource(send)(
			                                  await parseSourceTree()(
			                                    await parseCaptures()(
		  	                                      await changeMode(stream))))))))));
  };
}

function loop(terminate) {
  const looper = async (stream) => {
    if (isInput(message(stream)) && isCtrlC(input(message(stream)))) {
      return terminate();
    }
    else {
      return looper(await continuation(now(stream))(forget(await later(stream))));
    }
  };

  return looper;
}

function developerSession(source,
	                  runLocation,
	                  breakpoints,
	                  displayedScript,
	                  topRightColumnDisplay,
	                  environment,
	                  messages,
	                  sourceTree,
	                  command,
                          instructions,
                          queryCapture,
                          breakpointCapture) {
  return cons(
	   cons(
	     sizeWidth(50, label(atom(scriptSourceWithLocationAndBreakpoints(unpackedContent(source),
		                                                             runLocation,
		                                                             breakpoints,
		                                                             displayedScript)),
	                         tag(source))),
	     cons(
	       cons(
	         topRightColumnDisplay(environment, sourceTree),
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

function scriptSourceWithLocationAndBreakpoints(scriptSource, 
	                                        runLocation,
	                                        breakpoints,
	                                        displayedScript) {
  const formatScriptSource = (formattedLines, breakpoints, originalLines, originalLineNumber) => {
    if (originalLines.length === 0) {
      return formattedLines;
    }
    else {
      const hasBreakpoint = !(breakpoints.length === 0) && lineNumber(breakpoints[0]) === originalLineNumber;

      const isCurrentExecutionLocation = scriptHandle(runLocation) === displayedScript
		                           && lineNumber(runLocation) === originalLineNumber;

      return formatScriptSource(
        [...formattedLines, `${hasBreakpoint ? "*" : " "}${isCurrentExecutionLocation ? "> " : "  "}${originalLines[0]}`],
        hasBreakpoint ? breakpoints.slice(1) : breakpoints,
        originalLines.slice(1),
        originalLineNumber + 1);
    }
  };

  return scrollableContent(makeDisplayedContent(formatScriptSource([],
	                                                           breakpoints.filter(breakpoint => {
								     return scriptHandle(breakpoint) === displayedScript;
	                                                           })
	                                                                      .sort((breakpointA, breakpointB) => {
								     return lineNumber(breakpointA) - lineNumber(breakpointB);
							           }),
	                                                           content(scriptSource).split("\n"),
	                                                           0).join("\n"),
	                                        topLine(scriptSource)));
}

module.exports = { debugSession };
