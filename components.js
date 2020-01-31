const { content, describeEnvironment, displayedScriptSource, exploreSourceTree, makeDisplayedContent, scrollable, scrollableContent, topLine, writeTree } = require('./helpers.js');
const { breakpointCapture, breakpointLine, hasEnded, input, isBreakpointCapture, isDebuggerPaused, isEnvironment, isInput, isMessagesFocus, isQueryCapture, isScriptParsed, isScriptSource, isSourceTree, isSourceTreeFocus, lineNumber, makeLocation, message, messagesFocusInput, parsedScriptHandle, parsedScriptUrl, pauseLocation, query, readEnvironment, readScriptSource, scriptHandle } = require('./protocol.js');
const { branches, makeSelectionInSourceTree, makeSourceTree, root } = require('./sourcetree.js');
const { atom, column, cons, indent, sizeHeight, vindent } = require('terminal');

function scriptSource() {
  return noParameters => predecessor => stream => {
    if (isScriptSource(message(stream))) {
      return f => f(noParameters)(readScriptSource(message(stream)));
    }
    else {
      return predecessor ? f => f(noParameters)(predecessor) : f => f(noParameters)("Loading script source");
    }
  }
}

function scriptSourceWindowTopAnchor() {
  return noParameters => predecessor => stream => {
    const displayChange = predecessor ? predecessor.displayChange : displayedScriptSource();

    const scriptId = predecessor ? predecessor.scriptId : undefined;

    const topLine = predecessor ? predecessor.topLine : 0;

    if (isInput(message(stream)) && input(message(stream)) === "j") {
      return f => f(noParameters)({displayChange: displayChange, scriptId: scriptId, topLine: topLine + 1});
    }
    else if (isInput(message(stream)) && input(message(stream)) === "k") {
      return f => f(noParameters)({displayChange: displayChange, scriptId: scriptId, topLine: topLine - 1});
    }
    else {
      const onSelectionChange = (displayChange, scriptId) => {
        return f => f(noParameters)({displayChange: displayChange, scriptId: scriptId, topLine: topLine});
      };

      const onDisplayChange = (displayChange, newScriptId) => {
        if (isDebuggerPaused(message(stream))) {
          const runLine = lineNumber(pauseLocation(message(stream)));

          return f => f(noParameters)({displayChange: displayChange, scriptId: newScriptId, topLine: Math.max(runLine - 3, 0)});
        }
        else {
          return f => f(noParameters)({displayChange: displayChange, scriptId: newScriptId, topLine: 0});
        }
      };

      return displayChange(onSelectionChange, onDisplayChange)(stream);
    }
  };
}

function runLocation() {
  return noParameters => predecessor => stream => {
    if (isDebuggerPaused(message(stream))) {
      return f => f(noParameters)(pauseLocation(message(stream)));
    }
    else {
      return predecessor ? f => f(noParameters)(predecessor) : f => f(noParameters)(makeLocation());
    }
  };
}

function displayedScript() {
  return displayChange => predecessor => stream => {
    const updateDisplayedScript = (displayChange, scriptId) => f => f(displayChange)(scriptId);

    return (displayChange ? displayChange : displayedScriptSource())(updateDisplayedScript, updateDisplayedScript)(stream);
  };
}

function breakpoints() {
  return (displayChange, scriptId) => predecessor => stream => {
    const checkDisplayChange = displayChange ? displayChange : displayedScriptSource();

    const breakpoints = predecessor ? predecessor : [];

    if (isBreakpointCapture(message(stream)) && hasEnded(message(stream))) {
      return f => f(checkDisplayChange, scriptId)([...breakpoints, makeLocation(scriptId, breakpointLine(message(stream)))]);
    }
    else {
      const updateBreakpointRecorder = (displayChange, scriptId) => f => f(displayChange, scriptId)(breakpoints);

      return checkDisplayChange(updateBreakpointRecorder, updateBreakpointRecorder)(stream);
    }
  };
}

function environment() {
  return noParameters => predecessor => stream => {
    if (isEnvironment(message(stream))) {
      return f => f(noParameters)(describeEnvironment(readEnvironment(message(stream))));
    }
    else {
      return predecessor ? f => f(noParameters)(predecessor) : f => f(noParameters)("Loading environment");
    }
  }
}

function commandLine() {
  return noParameters => predecessor => stream => {
    const defaultMessage = "q: Query Inspector  b: Add breakpoint  n: Step over  s: Step into  f: Step out  c: Continue  j: Scroll down  k: Scroll up";

    if (isBreakpointCapture(message(stream))) {
      return hasEnded(message(stream)) ? f => f(noParameters)(defaultMessage)
		                       : f => f(noParameters)(`Add breakpoint at line: ${breakpointCapture(message(stream))}`);
    }
    else if (isQueryCapture(message(stream))) {
      return hasEnded(message(stream)) ? f => f(noParameters)(defaultMessage)
		                       : f => f(noParameters)(`Query Inspector: ${query(message(stream))}`);
    }
    else {
      return predecessor ? f => f(noParameters)(predecessor) : f => f(noParameters)(defaultMessage);
    }
  };
}

function messages() {
  return noParameters => predecessor => stream => {
    const displayedContent = predecessor ? predecessor : makeDisplayedContent("Waiting");

    if (isDebuggerPaused(message(stream))) {
      return f => f(noParameters)(makeDisplayedContent(`${predecessor ? content(displayedContent) + "\n" : ""}id: ${scriptHandle(pauseLocation(message(stream)))}, lineNumber: ${lineNumber(pauseLocation(message(stream)))}`, topLine(displayedContent)));
    }
    else if (isScriptParsed(message(stream))) {
      return f => f(noParameters)(makeDisplayedContent(`${predecessor ? content(displayedContent) + "\n" : ""}id: ${parsedScriptHandle(message(stream))}, url: ${parsedScriptUrl(message(stream))}`, topLine(displayedContent)));
    }
    else if (isSourceTree(message(stream))) {
      const sourceTree = message(stream).sourceTree;

      return f => f(noParameters)(makeDisplayedContent(`${predecessor ? content(displayedContent) + "\n" : ""}root: ${root(sourceTree)}, tree: ${JSON.stringify(branches(sourceTree))}`, topLine(displayedContent)));
    }
    else {
      return f => f(noParameters)(scrollable(isMessagesFocus, messagesFocusInput)(displayedContent, stream));
    }
  };
}

function sourceTree() {
  return noParameters => predecessor => stream => {
    const selection = predecessor ? predecessor : makeSelectionInSourceTree(makeSourceTree());

    const identity = selection => selection;

    return f => f(noParameters)(exploreSourceTree(selection, stream, identity, identity));
  };
}

//function sourceTreeWindowHeader() {
//  return noParameters => predecessor => stream => {
//    if (isSourceTreeFocus(message(stream)) && !hasEnded(message(stream))) {
//      return f => f(noParameters)("\u001b[7mworkspace\u001b[0m");
//    }
//    else if (isSourceTreeFocus(message(stream)) && hasEnded(message(stream))) {
//      return f => f(noParameters)("\u001b[4mw\u001b[0morkspace");
//    }
//    else {
//      return predecessor ? f => f(noParameters)(predecessor) : f => f(noParameters)("\u001b[4mw\u001b[0morkspace");
//    }
//  };
//}

function topRightColumnDisplay() {
  return noParameters => predecessor => stream => {
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
      return f => f(noParameters)(sourceTreeDisplay);
    }
    else if (isSourceTreeFocus(message(stream)) && hasEnded(message(stream))) {
      return f => f(noParameters)(environmentAndMessagesDisplay);
    }
    else {
      return predecessor ? f => f(noParameters)(predecessor) : f => f(noParameters)(environmentAndMessagesDisplay);
    }
  };
}

module.exports = { breakpoints, commandLine, displayedScript, environment, messages, runLocation, scriptSource, scriptSourceWindowTopAnchor, sourceTree, topRightColumnDisplay };
