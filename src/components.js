const { makeEnvironmentTree, makeSelectionInEnvironmentTree, refreshSelectedEnvironmentTree } = require('./environmenttree.js');
const { makeSelectionInFileTree, makeFileTree } = require('filetree');
const { content, displayedScriptSource, highlightOneCharacter, exploreEnvironmentTreeSilently, exploreSourceTree, focusable, focusableByDefault, makeDisplayedContent, makePackagedContent, scrollable, scrollableContent, styleText, tabs, tag, topLine, unpackedContent, writeEnvironmentTree, writeSourceTree } = require('./helpers.js');
const { breakpointLine, hasEnded, input, interactionKeys, isBreakpointCapture, isDebuggerPaused, isEnvironmentTree, isEnvironmentTreeFocus, isError, isInput, isMessagesFocus, isQueryCapture, isScriptParsed, isScriptSource, isSourceTree, isSourceTreeFocus, lineNumber, makeLocation, message, messagesFocusInput, parsedScriptHandle, parsedScriptUrl, pauseLocation, readEnvironmentTree, readScriptSource, reason, scriptHandle } = require('./protocol.js');
const { atom, label, sizeHeight } = require('terminal');

function scriptSource() {
  return (displayChange, scriptId) => predecessor => stream => {
    const label = predecessor ? tag(predecessor) : styleText("script source", "bold");

    const displayedContent = predecessor ? unpackedContent(predecessor) : makeDisplayedContent("Loading script source");

    const focusableScriptSource = focusableByDefault(message => {
      return (isBreakpointCapture(message)
	       || isQueryCapture(message)
	       || isMessagesFocus(message)
	       || isSourceTreeFocus(message)
	       || isEnvironmentTreeFocus(message));
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

function environmentTree() {
  return noParameters => predecessor => stream => {
    const label = predecessor ? tag(predecessor) : highlightOneCharacter("environment",
	                                                                 interactionKeys("environmentTreeFocus"));

    const selection = predecessor ? unpackedContent(predecessor) : makeSelectionInEnvironmentTree(makeEnvironmentTree());

    if (isDebuggerPaused(message(stream))) {
      return f => f(noParameters)(makePackagedContent(label, makeSelectionInEnvironmentTree(makeEnvironmentTree())));
    }
    else if (isEnvironmentTree(message(stream))) {
      return f => f(noParameters)
	            (makePackagedContent(label, refreshSelectedEnvironmentTree(selection,
			                                                       readEnvironmentTree(message(stream)))));
    }
    else {
      return exploreEnvironmentTreeSilently(selection, stream, newSelection => {
        return f => f(noParameters)
	              (makePackagedContent(focusable(isEnvironmentTreeFocus, interactionKeys("environmentTreeFocus"))
			                     (label, stream),
			                   newSelection));
      });
    }
  };
}

function instructions() {
  return noParameters => predecessor => stream => {
    const defaultInstructions = `${interactionKeys("stepOver")}: Step over  `
	                          + `${interactionKeys("stepInto")}: Step into  `
	                          + `${interactionKeys("stepOut")}: Step out  `
	                          + `${interactionKeys("continue")}: Continue  `
	                          + `${interactionKeys("scrollDown")}: Scroll down  `
	                          + `${interactionKeys("scrollUp")}: Scroll up  `
	                          + "Ctrl+C: Quit";

    const sourceTreeInstructions = `${interactionKeys("selectNext")}: Select next entry  `
	                             + `${interactionKeys("selectPrevious")}: Select previous entry  `
	                             + `${interactionKeys("selectChild")}: Visit directory  `
	                             + `${interactionKeys("selectParent")}: Go to parent directory  `
	                             + "Enter: Validate selection";

    const environmentTreeInstructions = `${interactionKeys("selectNext")}: Select next entry  `
	                                  + `${interactionKeys("selectPrevious")}: Select previous entry  `
	                                  + `${interactionKeys("selectChild")}: Visit entry  `
	                                  + `${interactionKeys("selectParent")}: Go to parent entry  `
                                          + "Enter: Leave";

    const messagesInstructions = `${interactionKeys("scrollDown")}: Scroll down  `
	                           + `${interactionKeys("scrollUp")}: Scroll up  `
                                   + "Enter: Leave";

    if (isSourceTreeFocus(message(stream)) && !hasEnded(message(stream))) {
      return f => f(noParameters)(makePackagedContent(tag(predecessor), sourceTreeInstructions));
    }
    else if (isMessagesFocus(message(stream)) && !hasEnded(message(stream))) {
      return f => f(noParameters)(makePackagedContent(tag(predecessor), messagesInstructions));
    }
    else if (isEnvironmentTreeFocus(message(stream)) && !hasEnded(message(stream))) {
      return f => f(noParameters)(makePackagedContent(tag(predecessor), environmentTreeInstructions));
    }
    else if ((isSourceTreeFocus(message(stream)) || isMessagesFocus(message(stream))) && hasEnded(message(stream))) {
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

    const log = predecessor ? unpackedContent(predecessor) : undefined;

    return f => f(noParameters)(makePackagedContent(focusable(isFocus, alwaysHighlightedCharacter)(title, stream),
			                            logger()(log)(stream)(f => g => g)));
  };
}

function commandLine() {
  return noParameters => predecessor => stream => {
    const tabbedDisplays = displayPosition => (...contents) => {
      return label(atom(unpackedContent(contents[displayPosition])), tabs(displayPosition, ...contents));
    };

    if (isQueryCapture(message(stream)) && !hasEnded(message(stream))) {
      return f => f(noParameters)(tabbedDisplays(1));
    }
    else if (isBreakpointCapture(message(stream)) && !hasEnded(message(stream))) {
      return f => f(noParameters)(tabbedDisplays(2));
    }
    else if ((isQueryCapture(message(stream)) || isBreakpointCapture(message(stream))) && hasEnded(message(stream))) {
      return f => f(noParameters)(tabbedDisplays(0));
    }
    else {
      return predecessor ? f => f(noParameters)(predecessor) : f => f(noParameters)(tabbedDisplays(0));
    }
  };
}

function messages(inspectedMessage, logger) {
  return noParameters => predecessor => stream => {
    const label = predecessor ? tag(predecessor) : highlightOneCharacter("messages", interactionKeys("messagesFocus"));

    const displayedContent = predecessor ? unpackedContent(predecessor) : makeDisplayedContent("Waiting");

    if (inspectedMessage(message(stream))) {
      return f => f(noParameters)
	            (makePackagedContent(label,
	                                 makeDisplayedContent(`${predecessor ? content(displayedContent) + "\n" : ""}${logger(message(stream))}`, topLine(displayedContent))));
    }
    else if (isError(message(stream))) {
      return f => f(noParameters)
	            (makePackagedContent(label,
	                                 makeDisplayedContent(`${predecessor ? content(displayedContent) + "\n" : ""}${reason(message(stream))}`, topLine(displayedContent))));
    }
    else {
      return f => f(noParameters)
	            (makePackagedContent(focusable(isMessagesFocus, interactionKeys("messagesFocus"))(label, stream),
			                 scrollable(isMessagesFocus, messagesFocusInput)(displayedContent, stream)));
    }
  };
}

function sourceTree() {
  return noParameters => predecessor => stream => {
    const label = predecessor ? tag(predecessor) : highlightOneCharacter("workspace", interactionKeys("sourceTreeFocus"));

    const selection = predecessor ? unpackedContent(predecessor) : makeSelectionInFileTree(makeFileTree());

    const identity = selection => selection;

    return f => f(noParameters)(makePackagedContent(focusable(isSourceTreeFocus, interactionKeys("sourceTreeFocus"))
	                                              (label, stream),
	                                            exploreSourceTree(selection, stream, identity, identity)));
  };
}

function topRightColumnDisplay() {
  return noParameters => predecessor => stream => {
    const environmentTreeDisplay = (environmentTree, sourceTree) => {
      return sizeHeight(50, label(atom(writeEnvironmentTree(unpackedContent(environmentTree))),
	                          tabs(0, environmentTree, sourceTree)));
    };

    const sourceTreeDisplay = (environmentTree, sourceTree) => {
      return sizeHeight(50, label(atom(writeSourceTree(unpackedContent(sourceTree))), tabs(1, environmentTree, sourceTree)));
    };

    if (isSourceTreeFocus(message(stream)) && !hasEnded(message(stream))) {
      return f => f(noParameters)(sourceTreeDisplay);
    }
    else if (isSourceTreeFocus(message(stream)) && hasEnded(message(stream))) {
      return f => f(noParameters)(environmentTreeDisplay);
    }
    else {
      return predecessor ? f => f(noParameters)(predecessor) : f => f(noParameters)(environmentTreeDisplay);
    }
  };
}

module.exports = {
  breakpoints,
  commandLine,
  displayedScript,
  environmentTree,
  focusableCaptureLog,
  instructions,
  logCapture,
  messages,
  runLocation,
  scriptSource,
  sourceTree,
  topRightColumnDisplay
};