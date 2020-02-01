const { breakpoints, commandLine, displayedScript, environment, messages, runLocation, scriptSource, sourceTree, topRightColumnDisplay } = require('./components.js');
const { content, isCtrlC, topLine } = require('./helpers.js');
const { addBreakpoint, changeMode, parseCaptures, parseSourceTree, pullEnvironment, pullScriptSource, queryInspector, step } = require('./processes.js');
const { input, isInput, lineNumber, message, scriptHandle } = require('./protocol.js');
const { continuation, forget, later, now } = require('streamer');
const { atom, compose, cons, emptyList, row, show, sizeWidth, vindent } = require('terminal');

function debugSession(send, render, terminate) {
  return async (stream) => {
    return loop(terminate)(await show(render)(compose(developerSession,
			                              scriptSource(),
			                              runLocation(),
			                              breakpoints(),
			                              displayedScript(),
		                                      topRightColumnDisplay(),
			                              environment(),
			                              messages(),
		                                      sourceTree(),
			                              commandLine()))(
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
	                  command) {
  return cons(
	   cons(
	     sizeWidth(50, atom(scriptSourceWithLocationAndBreakpoints(source,
		                                                       runLocation,
		                                                       breakpoints,
		                                                       displayedScript))),
	     cons(
	       topRightColumnDisplay(environment, messages, sourceTree),
	       row(90))),
	   cons(
	     cons(
	       atom(command),
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

  return formatScriptSource([],
	                    breakpoints.filter(breakpoint => scriptHandle(breakpoint) === displayedScript)
	                               .sort((breakpointA, breakpointB) => lineNumber(breakpointA) - lineNumber(breakpointB)),
	                    content(scriptSource).split("\n"),
	                    0)
	   .slice(topLine(scriptSource))
	   .reduce((formattedVisibleSource, line) => {
             return `${formattedVisibleSource === "" ? formattedVisibleSource : formattedVisibleSource + "\n"}${line}`;
	   }, "");
}

module.exports = { debugSession };
