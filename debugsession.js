const { breakpoints, commandLine, displayedScript, environmentTree, focusableCaptureLog, instructions, logCapture, messages, runLocation, scriptSource, sourceTree, topRightColumnDisplay } = require('./components.js');
const { content, loop, makeDisplayedContent, scrollableContent, styleText, tag, topLine, unpackedContent } = require('./helpers.js');
const { addBreakpoint, changeMode, parseCaptures, parseEnvironmentTree, parseSourceTree, pullScriptSource, queryInspector, step } = require('./processes.js');
const { breakpointCapture, columnNumber, isBreakpointCapture, isDebuggerPaused, isQueryCapture, lineNumber, message, pauseLocation, query, scriptHandle } = require('./protocol.js');
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
	     sizeWidth(50, label(atom(scriptSourceWithLocationAndBreakpoints(unpackedContent(source),
		                                                             runLocation,
		                                                             breakpoints,
		                                                             displayedScript)),
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

      const lineNumberPrefix = lineNumber => {
        if (lineNumber.toString().length < 4) {
	  return `${lineNumber.toString().padEnd(3, ' ')}|`;
	}
	else {
          return `${lineNumber.toString()}|`;
	}
      };

      const runLocationHighlights = line => {
	const highlightCurrentExpression = line => {
	  const highlightCurrentExpressionImpl = (beforeHighlight, line) => {
	    const isOneOf = (characterSelection, character) => {
	      if (characterSelection.length === 0) {
	        return false;
	      }
	      else if (characterSelection[0] === character) {
	        return true;
	      }
	      else {
	        return isOneOf(characterSelection.slice(1), character);
	      }
	    };

	    if (line.length === 0) {
	      return beforeHighlight;
	    }
	    else if (isOneOf("[({ })]=>\r\n;", line[0])) {
	      return highlightCurrentExpressionImpl(`${beforeHighlight}${line[0]}`, line.slice(1));
	    }
	    else {
	      return (expression => `${beforeHighlight}${styleText(expression, "bold")}${line.slice(expression.length)}`)
	               (line.match(/^[a-zA-Z0-9\"\']+/g)[0]);
	    }
	  };

	  return highlightCurrentExpressionImpl("", line);
	};

        if (scriptHandle(runLocation) === displayedScript && lineNumber(runLocation) === originalLineNumber) {
	  return `> ${line.slice(0, columnNumber(runLocation))}${highlightCurrentExpression(line.slice(columnNumber(runLocation)))}`;
        }
	else {
          return `  ${line}`;
        }
      };

      return formatScriptSource([...formattedLines,`${lineNumberPrefix(originalLineNumber)}${hasBreakpoint ? "*" : " "}${runLocationHighlights(originalLines[0])}`],
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
