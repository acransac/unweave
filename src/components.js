const { makeEnvironmentTree, makeSelectionInEnvironmentTree, refreshSelectedEnvironmentTree } = require('./environmenttree.js');
const { makeSelectionInFileTree, makeFileTree } = require('filetree');
const { content, displayedScriptSource, highlightOneCharacter, exploreEnvironmentTreeSilently, exploreSourceTree, focusable, focusableByDefault, makeDisplayedContent, makePackagedContent, scrollable, styleText, tabs, tag, topLine, unpackedContent, writeEnvironmentTree, writeSourceTree } = require('./helpers.js');
const { breakpointLine, hasEnded, input, interactionKeys, isBreakpointCapture, isDebuggerPaused, isEnvironmentTree, isEnvironmentTreeFocus, isError, isInput, isMessagesFocus, isQueryCapture, isScriptSource, isSourceTreeFocus, lineNumber, makeLocation, message, messagesFocusInput, pauseLocation, readEnvironmentTree, readScriptSource, reason } = require('./protocol.js');
const { atom, label, sizeHeight } = require('terminal');

/*
 * Get the list of lines from all the loaded scripts where a breakpoint is set
 * @return {Component} - The component's output is an array of breakpoint locations
 */
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

/*
 * Change the active tab where the captures or mode instructions are displayed
 * @return {Component} - The component's output is a labelled atom where the active tab's content is injected
 */
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

/*
 * Track the displayed script's id
 * @return {Component} - The component's output is the id of the script whose source is currently displayed
 */
function displayedScript() {
  return displayChange => predecessor => stream => {
    const updateDisplayedScript = (displayChange, scriptId) => f => f(displayChange)(scriptId);

    return (displayChange ? displayChange : displayedScriptSource())(updateDisplayedScript, updateDisplayedScript)(stream);
  };
}

/*
 * Get the selection in the updated environment tree
 * @return {Component} - The component's output is the packaged current selection in the up-to-date environment tree
 */
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

/*
 * Update the label of a capture log
 * @param {Component} logger - A component that logs the capture (the result of calling {@link logCapture})
 * @param {function} isFocus - A function checking if the capture is active
 * @param {string} label - The label of the capture log
 * @param {string} alwaysHighlightedCharacter - A character in the label that is always highlighted and that is the key to activate the capture
 * @return {Component} - The component's output is the packaged result of the capture log with the updated label
 */
function focusableCaptureLog(logger, isFocus, label, alwaysHighlightedCharacter) {
  return noParameters => predecessor => stream => {
    const title = predecessor ? tag(predecessor) : highlightOneCharacter(label, alwaysHighlightedCharacter);

    const log = predecessor ? unpackedContent(predecessor) : undefined;

    return f => f(noParameters)(makePackagedContent(focusable(isFocus, alwaysHighlightedCharacter)(title, stream),
			                            logger()(log)(stream)(f => g => g)));
  };
}

/*
 * Get the current mode's instructions
 * @return {Component} - The component's output are the packaged instructions for the current mode
 */
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
    else if ((isSourceTreeFocus(message(stream))
                || isMessagesFocus(message(stream))
                || isEnvironmentTreeFocus(message(stream)))
               && hasEnded(message(stream))) {
      return f => f(noParameters)(makePackagedContent(tag(predecessor), defaultInstructions));
    }
    else {
      return predecessor ? f => f(noParameters)(predecessor)
	                 : f => f(noParameters)(makePackagedContent("instructions", defaultInstructions));
    }
  };
}

/*
 * Log the content of a capture
 * @param {function} isCapture - A function checking if a message carries a capture's input
 * @param {function} readCapture - A function retrieving the capture's input
 * @param {string} logPrefix - The text that is always visible in the log before the capture
 * @return {Component} - The component's output is the capture's content with the specified prefix
 */
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

/*
 * Log unweave errors and user defined information
 * @param {function} inspectedMessage - A function that checks if a message is relevant for logging
 * @param {function} logger - A function that extracts and formats relevant information from the inspected messages
 * @return {Component} - The component's output is the packaged log of errors and user defined information
 */
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

/*
 * Get the current location of the run
 * @return {Component} - The component's output is the location of the run when paused
 */
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

/*
 * Get the displayed script's source
 * @return {Component} - The component's output is the packaged source
 */
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

/*
 * Get the selection in the updated source tree
 * @return {Component} - The component's output is the packaged current selection in the up-to-date source tree
 */
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

/*
 * Change the active tab where the environment and source trees are displayed
 * @return {Component} - The component's output is a labelled atom where the active tab's content is injected
 */
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
