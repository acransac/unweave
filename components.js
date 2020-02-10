const { content, describeEnvironment, displayedScriptSource, highlightOneCharacter, exploreSourceTree, focusable, focusableByDefault, makeDisplayedContent, makePackagedContent, scrollable, scrollableContent, styleText, tabs, tag, topLine, unpackedContent, writeTree } = require('./helpers.js');
const { breakpointCapture, breakpointLine, hasEnded, input, isBreakpointCapture, isDebuggerPaused, isEnvironment, isInput, isMessagesFocus, isQueryCapture, isScriptParsed, isScriptSource, isSourceTree, isSourceTreeFocus, lineNumber, makeLocation, message, messagesFocusInput, parsedScriptHandle, parsedScriptUrl, pauseLocation, query, readEnvironment, readScriptSource, scriptHandle } = require('./protocol.js');
const { makeSelectionInSourceTree, makeSourceTree } = require('./sourcetree.js');
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

function instructions() {
  return noParameters => predecessor => stream => {
    const defaultInstructions = "n: Step over  s: Step into  f: Step out  c: Continue  j: Scroll down  k: Scroll up";

    const sourceTreeInstructions = "j: Select next entry  k: Select previous entry  l: Visit directory  h: Go to parent directory  Enter: Validate selection";

    const messagesInstructions = "j: Scroll down  k: Scroll up  Enter: Leave";

    if (isSourceTreeFocus(message(stream)) && !hasEnded(message(stream))) {
      return f => f(noParameters)(makePackagedContent(tag(predecessor), sourceTreeInstructions));
    }
    else if (isMessagesFocus(message(stream)) && !hasEnded(message(stream))) {
      return f => f(noParameters)(makePackagedContent(tag(predecessor), messagesInstructions));
    }
    else if ((isBreakpointCapture(message(stream)) || isQueryCapture(message(stream))
              || isSourceTreeFocus(message(stream)) || isMessagesFocus(message(stream)))
              && hasEnded(message(stream))) {
      return f => f(noParameters)(makePackagedContent(tag(predecessor), defaultInstructions));
    }
    else {
      return predecessor ? f => f(noParameters)(predecessor)
	                 : f => f(noParameters)(makePackagedContent("instructions", defaultInstructions));
    }
  };
}

function logCapture(isCapture, readCapture, logPrefix) {
  return noParameters => predecessor => stream => {
    if (isCapture(message(stream)) && !hasEnded(message(stream))) {
      return f => f(noParameters)(`${logPrefix}: ${readCapture(message(stream))}`);
    }
    else if (isCapture(message(stream)) && hasEnded(message(stream))) {
      return f => f(noParameters)(`${logPrefix}: `);
    }
    else {
      return predecessor ? f => f(noParameters)(predecessor) : f => f(noParameters)(`${logPrefix}: `);
    }
  };
}

function focusableCaptureLog(logger, isFocus, label, alwaysHighlightedCharacter) {
  return noParameters => predecessor => stream => {
    const title = predecessor ? tag(predecessor) : highlightOneCharacter(label, alwaysHighlightedCharacter);

    return f => f(noParameters)
	          (makePackagedContent(focusable(isFocus, alwaysHighlightedCharacter)(title, stream),
			               (f => g => g)(logger()(unpackedContent(predecessor))(stream))));
  };
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

function messages(inspectedMessage, logger) {
  return noParameters => predecessor => stream => {
    const label = predecessor ? tag(predecessor) : highlightOneCharacter("messages", "m");

    const displayedContent = predecessor ? unpackedContent(predecessor) : makeDisplayedContent("Waiting");

    if (inspectedMessage(message(stream))) {
      return f => f(noParameters)
	            (makePackagedContent(label,
	                                 makeDisplayedContent(`${predecessor ? content(displayedContent) + "\n" : ""}${logger(message(stream))}`, topLine(displayedContent))));
    }
    else {
      return f => f(noParameters)
	            (makePackagedContent(focusable(isMessagesFocus, "m")(label, stream),
			                 scrollable(isMessagesFocus, messagesFocusInput)(displayedContent, stream)));
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
