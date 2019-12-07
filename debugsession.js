const { breakpoints, commandLine, displayedScript, environment, messages, messagesWindowTopAnchor, runLocation, scriptSource, scriptSourceWindowTopAnchor, sourceTree, topRightColumnDisplay } = require('./components.js');
const { addBreakpoint, changeMode, parseCaptures, parseSourceTree, pullEnvironment, pullScriptSource, queryInspector, step } = require('./processes.js');
const { continuation, forget, later, now } = require('streamer');
const { atom, compose, cons, emptyList, row, show, sizeWidth, vindent } = require('terminal');

function debugSession(send, render) {
  return async (stream) => {
    return loop(await show(render)(compose(developerSession,
			                   scriptSource,
			                   scriptSourceWindowTopAnchor,
			                   runLocation,
			                   breakpoints,
			                   displayedScript,
		                           topRightColumnDisplay,
			                   environment,
			                   messages,
			                   messagesWindowTopAnchor,
		                           sourceTree,
			                   commandLine))(
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

async function loop(stream) {
  return loop(await continuation(now(stream))(forget(await later(stream))));
}

function developerSession(source,
	                  sourceWindowTopAnchor,
	                  runLocation,
	                  breakpoints,
	                  displayedScript,
	                  topRightColumnDisplay,
	                  environment,
	                  messages,
	                  messagesWindowTopAnchor,
	                  sourceTree,
	                  command) {
  return cons(
	   cons(
	     sizeWidth(50, atom(scriptSourceWithLocationAndBreakpoints(source,
		                                                       sourceWindowTopAnchor,
		                                                       runLocation,
		                                                       breakpoints,
		                                                       displayedScript))),
	     cons(
	       topRightColumnDisplay(environment, messages, messagesWindowTopAnchor, sourceTree),
	       row(90))),
	   cons(
	     cons(
	       atom(command),
 	       vindent(90, row(10))),
	     emptyList()));
}

function scriptSourceWithLocationAndBreakpoints(scriptSource, 
	                                        scriptSourceWindowTopAnchor,
	                                        runLocation,
	                                        breakpointLocations,
	                                        displayedScript) {
  const formatScriptSource = (formattedLines, breakpoints, originalLines, originalLineId) => {
    if (originalLines.length === 0) {
      return formattedLines;
    }
    else {
      const hasBreakpoint = !(breakpoints.length === 0) && breakpoints[0].lineNumber === originalLineId;

      const isCurrentExecutionLocation = runLocation.scriptId === displayedScript.id 
		                           && runLocation.lineNumber === originalLineId;

      return formatScriptSource(
        [...formattedLines, `${hasBreakpoint ? "*" : " "}${isCurrentExecutionLocation ? "> " : "  "}${originalLines[0]}`],
        hasBreakpoint ? breakpoints.slice(1) : breakpoints,
        originalLines.slice(1),
        originalLineId + 1);
    }
  };

  return formatScriptSource([],
	                    breakpointLocations.breakpoints.filter(({scriptId, lineNumber}) => {
			      return scriptId === displayedScript.id;
	                    })
	                                                   .sort(({scriptIdA, lineNumberA}, {scriptIdB, lineNumberB}) => {
			      return lineNumberA - lineNumberB;
			    }),
	                    scriptSource.split("\n"),
	                    0)
	   .slice(scriptSourceWindowTopAnchor.topLine)
	   .reduce((formattedVisibleSource, line) => {
             return `${formattedVisibleSource === "" ? formattedVisibleSource : formattedVisibleSource + "\n"}${line}`;
	   }, "");
}

module.exports = { debugSession };