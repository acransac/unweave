const { content, describeEnvironment, displayedScriptSource, exploreSourceTree, makeDisplayedContent, scrollable, scrollableContent, topLine, writeTree } = require('./helpers.js');
const { breakpointCapture, breakpointLine, hasEnded, input, isBreakpointCapture, isDebuggerPaused, isEnvironment, isInput, isMessagesFocus, isQueryCapture, isScriptParsed, isScriptSource, isSourceTree, isSourceTreeFocus, lineNumber, makeLocation, message, messagesFocusInput, parsedScriptHandle, parsedScriptUrl, pauseLocation, query, readEnvironment, readScriptSource, scriptHandle } = require('./protocol.js');
const { branches, makeSelectionInSourceTree, makeSourceTree, root } = require('./sourcetree.js');
const { atom, column, cons, indent, sizeHeight, vindent } = require('terminal');

function scriptSource(predecessor) {
  return stream => {
    if (isScriptSource(message(stream))) {
      return () => readScriptSource(message(stream));
    }
    else {
      return predecessor ? predecessor : () => "Loading script source";
    }
  }
}

function scriptSourceWindowTopAnchor(predecessor) {
  return stream => {
    const displayChange = predecessor ? predecessor().displayChange : displayedScriptSource();

    const scriptId = predecessor ? predecessor().scriptId : undefined;

    const topLine = predecessor ? predecessor().topLine : 0;

    if (isInput(message(stream)) && input(message(stream)) === "j") {
      return () => { return {displayChange: displayChange, scriptId: scriptId, topLine: topLine + 1}; };
    }
    else if (isInput(message(stream)) && input(message(stream)) === "k") {
      return () => { return {displayChange: displayChange, scriptId: scriptId, topLine: topLine - 1}; };
    }
    else {
      const onSelectionChange = (displayChange, scriptId) => {
        return () => { return {displayChange: displayChange, scriptId: scriptId, topLine: topLine}; };
      };

      const onDisplayChange = (displayChange, newScriptId) => {
        if (isDebuggerPaused(message(stream))) {
          const runLine = lineNumber(pauseLocation(message(stream)));

          return () => { return {displayChange: displayChange, scriptId: newScriptId, topLine: Math.max(runLine - 3, 0)}; };
        }
        else {
          return () => { return {displayChange: displayChange, scriptId: newScriptId, topLine: 0}; };
        }
      };

      return displayChange(onSelectionChange, onDisplayChange)(stream);
    }
  };
}

function runLocation(predecessor) {
  return stream => {
    if (isDebuggerPaused(message(stream))) {
      return () => pauseLocation(message(stream));
    }
    else {
      return predecessor ? predecessor : () => makeLocation();
    }
  };
}

function displayedScript(predecessor) {
  return stream => {
    const displayChange = predecessor ? predecessor().displayChange : displayedScriptSource();

    const id = predecessor ? predecessor().id : undefined;

    const updateDisplayedScript = (displayChange, scriptId) => {
      return () => { return {displayChange: displayChange, id: scriptId}; };
    };

    return displayChange(updateDisplayedScript, updateDisplayedScript)(stream);
  };
}

function breakpoints(predecessor) {
  return stream => {
    const displayChange = predecessor ? predecessor().displayChange : displayedScriptSource();

    const scriptId = predecessor ? predecessor().scriptId : undefined;

    const breakpoints = predecessor ? predecessor().breakpoints : [];

    const updateBreakpointRecorder = (displayChange, scriptId) => {
      return () => { return {displayChange: displayChange, scriptId: scriptId, breakpoints: breakpoints}; };
    };

    if (isBreakpointCapture(message(stream)) && hasEnded(message(stream))) {
      return () => {
        return {
	  displayChange: displayChange,
	  scriptId: scriptId,
	  breakpoints: [...breakpoints, makeLocation(scriptId, breakpointLine(message(stream)))]
	};
      };
    }
    else {
      return displayChange(updateBreakpointRecorder, updateBreakpointRecorder)(stream);
    }
  };
}

function environment(predecessor) {
  return stream => {
    if (isEnvironment(message(stream))) {
      return () => describeEnvironment(readEnvironment(message(stream)));
    }
    else {
      return predecessor ? predecessor : () => "Loading environment";
    }
  }
}

function commandLine(predecessor) {
  return stream => {
    const defaultMessage = "q: Query Inspector  b: Add breakpoint  n: Step over  s: Step into  f: Step out  c: Continue  j: Scroll down  k: Scroll up";

    if (isBreakpointCapture(message(stream))) {
      return hasEnded(message(stream)) ? () => defaultMessage
		                       : () => `Add breakpoint at line: ${breakpointCapture(message(stream))}`;
    }
    else if (isQueryCapture(message(stream))) {
      return hasEnded(message(stream)) ? () => defaultMessage : () => `Query Inspector: ${query(message(stream))}`;
    }
    else {
      return predecessor ? predecessor : () => defaultMessage;
    }
  };
}

function messages(predecessor) {
  return stream => {
    const displayedContent = predecessor ? predecessor() : makeDisplayedContent("Waiting");

    if (isDebuggerPaused(message(stream))) {
      return () => makeDisplayedContent(`${predecessor ? content(displayedContent) + "\n" : ""}id: ${scriptHandle(pauseLocation(message(stream)))}, lineNumber: ${lineNumber(pauseLocation(message(stream)))}`, topLine(displayedContent));
    }
    else if (isScriptParsed(message(stream))) {
      return () => makeDisplayedContent(`${predecessor ? content(displayedContent) + "\n" : ""}id: ${parsedScriptHandle(message(stream))}, url: ${parsedScriptUrl(message(stream))}`, topLine(displayedContent));
    }
    else if (isSourceTree(message(stream))) {
      const sourceTree = message(stream).sourceTree;

      return () => makeDisplayedContent(`${predecessor ? content(displayedContent) + "\n" : ""}root: ${root(sourceTree)}, tree: ${JSON.stringify(branches(sourceTree))}`, topLine(displayedContent));
    }
    else {
      return scrollable(isMessagesFocus, messagesFocusInput)(displayedContent, stream);
    }
  };
}

function sourceTree(predecessor) {
  return stream => {
    const selection = predecessor ? predecessor() : makeSelectionInSourceTree(makeSourceTree());

    const identity = selection => selection;

    return () => exploreSourceTree(selection, stream, identity, identity);
  };
}

function topRightColumnDisplay(predecessor) {
  return stream => {
    const environmentAndMessagesDisplay = (environment, messages, sourceTree) => {
      return cons(
	       sizeHeight(50, atom(environment)),
	       cons(
	         vindent(50, sizeHeight(50, atom(scrollableContent(messages)))),
		 indent(50, column(50))));
    };

    const sourceTreeDisplay = (environment, messages, sourceTree) => {
      return cons(atom(writeTree(sourceTree)), indent(50, column(50)));
    };

    if (isSourceTreeFocus(message(stream)) && !hasEnded(message(stream))) {
      return () => sourceTreeDisplay;
    }
    else if (isSourceTreeFocus(message(stream)) && hasEnded(message(stream))) {
      return () => environmentAndMessagesDisplay;
    }
    else {
      return predecessor ? predecessor : () => environmentAndMessagesDisplay;
    }
  };
}

module.exports = { breakpoints, commandLine, displayedScript, environment, messages, runLocation, scriptSource, scriptSourceWindowTopAnchor, sourceTree, topRightColumnDisplay };
