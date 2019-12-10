const { describeEnvironment, displayedScriptSource, exploreSourceTree, scrollable, writeTree } = require('./helpers.js');
const { breakpointCapture, breakpointLine, input, isBreakpointCapture, isDebuggerPaused, isEnvironment, isInput, isMessagesFocus, isQueryCapture, isScriptParsed, isScriptSource, isSourceTree, isSourceTreeFocus, lineNumber, makeLocation, message, parsedScriptHandle, parsedScriptUrl, readEnvironment, readPauseLocation, readScriptSource, scriptHandle } = require('./protocol.js');
const { branches, makeSourceTree, root } = require('./sourcetree.js');
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
          const runLine = lineNumber(readPauseLocation(message(stream)));

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
      return () => readPauseLocation(message(stream));
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

    if (isBreakpointCapture(message(stream)) && message(stream).ended) {
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
      return message(stream).ended ? () => defaultMessage
		                   : () => `Add breakpoint at line: ${breakpointCapture(message(stream))}`;
    }
    else if (isQueryCapture(message(stream))) {
      return message(stream).ended ? () => defaultMessage : () => `Query Inspector: ${message(stream).query}`;
    }
    else {
      return predecessor ? predecessor : () => defaultMessage;
    }
  };
}

function messages(predecessor) {
  return stream => {
    const messages = predecessor ? predecessor() : "Waiting";

    if (isDebuggerPaused(message(stream))) {
      return () => `${predecessor === undefined ? "" : messages + "\n"}id: ${scriptHandle(readPauseLocation(message(stream)))}, lineNumber: ${lineNumber(readPauseLocation(message(stream)))}`;
    }
    else if (isScriptParsed(message(stream))) {
      return () => `${predecessor === undefined ? "" : messages + "\n"}id: ${parsedScriptHandle(message(stream))}, url: ${parsedScriptUrl(message(stream))}`;
    }
    else if (isSourceTree(message(stream))) {
      const sourceTree = message(stream).sourceTree;

      return () => `${predecessor === undefined ? "" : messages + "\n"}root: ${root(sourceTree)}, tree: ${JSON.stringify(branches(sourceTree))}`;
    }
    else {
      return predecessor ? predecessor : () => "Waiting";
    }
  };
}

function messagesWindowTopAnchor(predecessor) {
  return stream => {
    const topLine = predecessor ? predecessor() : 0;

    if (isMessagesFocus(message(stream)) && message(stream).focusMessages === "j") {
      return () => topLine + 1;
    }
    else if (isMessagesFocus(message(stream)) && message(stream).focusMessages === "k") {
      return () => topLine - 1;
    }
    else {
      return predecessor ? predecessor : () => 0;
    }
  };
}

function sourceTree(predecessor) {
  return stream => {
    const sourceTree = predecessor ? predecessor().sourceTree : makeSourceTree();

    const activeBranch = predecessor ? predecessor().activeBranch : [];

    const selection = predecessor ? predecessor().selection : {name: "", id: undefined, type: "file"};

    const identity = (sourceTree, activeBranch, selection) => {
      return {sourceTree: sourceTree, activeBranch: activeBranch, selection: selection};
    };

    return () => exploreSourceTree(sourceTree, activeBranch, selection, stream, identity, identity);
  };
}

function topRightColumnDisplay(predecessor) {
  return stream => {
    const environmentAndMessagesDisplay = (environment, messages, messagesWindowTopAnchor, sourceTree) => {
      return cons(
	       sizeHeight(50, atom(environment)),
	       cons(
	         vindent(50, sizeHeight(50, atom(scrollable(messages, messagesWindowTopAnchor)))),
		 indent(50, column(50))));
    };

    const sourceTreeDisplay = (environment, messages, messagesWindowTopAnchor, sourceTree) => {
      return cons(atom(writeTree(sourceTree)), indent(50, column(50)));
    };

    if (isSourceTreeFocus(message(stream)) && !message(stream).ended) {
      return () => sourceTreeDisplay;
    }
    else if (isSourceTreeFocus(message(stream)) && message(stream).ended) {
      return () => environmentAndMessagesDisplay;
    }
    else {
      return predecessor ? predecessor : () => environmentAndMessagesDisplay;
    }
  };
}

module.exports = { breakpoints, commandLine, displayedScript, environment, messages, messagesWindowTopAnchor, runLocation, scriptSource, scriptSourceWindowTopAnchor, sourceTree, topRightColumnDisplay };
