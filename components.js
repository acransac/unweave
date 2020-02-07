const { content, describeEnvironment, displayedScriptSource, highlightOneCharacter, exploreSourceTree, focusable, focusableByDefault, makeDisplayedContent, makePackagedContent, scrollable, scrollableContent, styleText, tabs, tag, topLine, unpackedContent, writeTree } = require('./helpers.js');
const { breakpointCapture, breakpointLine, hasEnded, input, isBreakpointCapture, isDebuggerPaused, isEnvironment, isInput, isMessagesFocus, isQueryCapture, isScriptParsed, isScriptSource, isSourceTree, isSourceTreeFocus, lineNumber, makeLocation, message, messagesFocusInput, parsedScriptHandle, parsedScriptUrl, pauseLocation, query, readEnvironment, readScriptSource, scriptHandle } = require('./protocol.js');
const { branches, makeSelectionInSourceTree, makeSourceTree, root } = require('./sourcetree.js');
const { atom, label, sizeHeight } = require('terminal');

function scriptSource() {
  return (displayChange, scriptId) => predecessor => stream => {
    const label = predecessor ? tag(predecessor) : styleText("script source", "bold");

    const displayedContent = predecessor ? unpackedContent(predecessor) : makeDisplayedContent("Loading script source");

    const focusableScriptSource = focusableByDefault(message => {
      return (isBreakpointCapture(message)
	       || isQueryCapture(message)
	       || isMessagesFocus(message)
	       || isSourceTreeFocus(message));
    });

    const onSelectionChange = (displayChange, scriptId) => {
      if (isScriptSource(message(stream))) {
        return f => f(displayChange, scriptId)
                      (makePackagedContent(label, makeDisplayedContent(readScriptSource(message(stream)),
			                                               topLine(displayedContent))));
      }
      else {
        return f => f(displayChange, scriptId)
	              (makePackagedContent(focusableScriptSource(label, stream),
			                   scrollable(isInput, input)(displayedContent, stream)));
      }
    };

    const onDisplayChange = (displayChange, newScriptId) => {
      if (isDebuggerPaused(message(stream))) {
        return f => f(displayChange, newScriptId)
		      (makePackagedContent(label,
			                   makeDisplayedContent(content(displayedContent),
				                                Math.max(lineNumber(pauseLocation(message(stream))) - 3, 0))));
      }
      else {
        return f => f(displayChange, newScriptId)
	              (makePackagedContent(focusableScriptSource(label, stream),
			                   makeDisplayedContent(content(displayedContent), 0)));
      }
    };

    return (displayChange ? displayChange : displayedScriptSource())(onSelectionChange, onDisplayChange)(stream);
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
      return f => f(noParameters)(makePackagedContent("environment", describeEnvironment(readEnvironment(message(stream)))));
    }
    else {
      return predecessor ? f => f(noParameters)(predecessor)
		         : f => f(noParameters)(makePackagedContent("environment", "Loading environment"));
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
    const label = predecessor ? tag(predecessor) : highlightOneCharacter("workspace", "w");

    const selection = predecessor ? unpackedContent(predecessor) : makeSelectionInSourceTree(makeSourceTree());

    const identity = selection => selection;

    return f => f(noParameters)(makePackagedContent(focusable(isSourceTreeFocus, "w")(label, stream),
	                                            exploreSourceTree(selection, stream, identity, identity)));
  };
}

function topRightColumnDisplay() {
  return noParameters => predecessor => stream => {
    const environmentDisplay = (environment, sourceTree) => {
      return sizeHeight(50, label(atom(unpackedContent(environment)), tabs(0, environment, sourceTree)));
    };

    const sourceTreeDisplay = (environment, sourceTree) => {
      return sizeHeight(50, label(atom(writeTree(unpackedContent(sourceTree))), tabs(1, environment, sourceTree)));
    };

    if (isSourceTreeFocus(message(stream)) && !hasEnded(message(stream))) {
      return f => f(noParameters)(sourceTreeDisplay);
    }
    else if (isSourceTreeFocus(message(stream)) && hasEnded(message(stream))) {
      return f => f(noParameters)(environmentDisplay);
    }
    else {
      return predecessor ? f => f(noParameters)(predecessor) : f => f(noParameters)(environmentDisplay);
    }
  };
}

module.exports = { breakpoints, commandLine, displayedScript, environment, messages, runLocation, scriptSource, sourceTree, topRightColumnDisplay };
