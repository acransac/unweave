const { insertInEnvironmentTree, makeEnvironmentTree, makePendingEntriesRegister, makeSelectionInEnvironmentTree, refreshSelectedEnvironmentTree, resolvePendingEntry } = require('./environmenttree.js');
const { insertInFileTree, makeFileEntry, makeFileTree, parseFilePath } = require('@acransac/filetree');
const { ctrlCInput, displayedScriptSource, enterInput, exploreEnvironmentTree, parseUserInput } = require('./helpers.js');
const { breakpointCapture, breakpointLine, endCapture, hasEnded, input, interactionKeys, isBreakpointCapture, isDebuggerPaused, isEnvironment, isEnvironmentEntry, isInput, isQueryCapture, isUserScriptParsed, makeBreakpointCapture, makeEnvironmentTreeFocus, makeEnvironmentTreeMessage, makeError, makeMessagesFocus, makeQueryCapture, makeSourceTreeFocus, makeSourceTreeMessage, message, parsedScriptHandle, parsedUserScriptPath, query, readEnvironment, sendContinue, sendQuery, sendRequestForEnvironmentDescription, sendRequestForScriptSource, sendSetBreakpoint, sendStepInto, sendStepOut, sendStepOver } = require('./protocol.js');
const { commit, continuation, floatOn, forget, now, later } = require('@acransac/streamer');

/*
 * Record a breakpoint
 * @param {function} send - The callback to send requests over websocket to Inspector
 * @return {Process}
 */
function addBreakpoint(send) {
  const breakpointSetter = scriptId => breakpointLine => {
    sendSetBreakpoint(send, scriptId, breakpointLine);
  };

  const breakpointAdder = (setBreakpoint, displayChange) => async (stream) => {
    const updateBreakpointSetter = (displayChange, scriptId) => {
      return commit(stream, breakpointAdder(breakpointSetter(scriptId), displayChange));
    };

    if (isBreakpointCapture(message(stream)) && hasEnded(message(stream))) {
      setBreakpoint(breakpointLine(message(stream)));

      return commit(stream, breakpointAdder(setBreakpoint, displayChange));
    }
    else {
      return displayChange(updateBreakpointSetter, updateBreakpointSetter)(stream);
    }
  };

  return breakpointAdder(breakpointSetter(undefined), displayedScriptSource());
}

/*
 * Start and end captures and focuses, and mark one input character as a capture or focus when they are active
 * @param {Stream} stream - The stream
 * @return {Stream} - The process outputs capture and focus messages with one character on user input messages 
 */
async function changeMode(stream) {
  const modalCapture = (makeCapture, continuation) => {
    const modeSetter = async (stream) => {
      if (isInput(message(stream))) {
        if (input(message(stream)) === enterInput()) {
          return floatOn(commit(stream, continuation), endCapture(makeCapture(input(message(stream)))));
        }
        else {
          return floatOn(commit(stream, modeSetter), makeCapture(input(message(stream))));
        }
      }
      else {
        return commit(stream, modeSetter);
      }
    };

    return modeSetter;
  };

  if (isInput(message(stream))) {
    if (input(message(stream)) === interactionKeys("queryCapture")) {
      return floatOn(commit(stream, modalCapture(makeQueryCapture, changeMode)), makeQueryCapture());
    }
    else if (input(message(stream)) === interactionKeys("breakpointCapture")) {
      return floatOn(commit(stream, modalCapture(makeBreakpointCapture, changeMode)), makeBreakpointCapture());
    }
    else if (input(message(stream)) === interactionKeys("messagesFocus")) {
      return floatOn(commit(stream, modalCapture(makeMessagesFocus, changeMode)), makeMessagesFocus());
    }
    else if (input(message(stream)) === interactionKeys("sourceTreeFocus")) {
      return floatOn(commit(stream, modalCapture(makeSourceTreeFocus, changeMode)), makeSourceTreeFocus());
    }
    else if (input(message(stream)) === interactionKeys("environmentTreeFocus")) {
      return floatOn(commit(stream, modalCapture(makeEnvironmentTreeFocus, changeMode)), makeEnvironmentTreeFocus());
    }
    else {
      return commit(stream, changeMode);
    }
  }
  else {
    return commit(stream, changeMode);
  }
}

/*
 * Trigger the stream's continuation until the user terminates the session. Also, on exception, revert the complete process to the last successful pass and input an error message with the exception details
 * @param {function} terminate - The terminate function handed over by Terminal
 * @return {Process}
 */
function loop(terminate) {
  const looper = async (stream) => {
    if (isInput(message(stream)) && input(message(stream)) === ctrlCInput()) {
      return terminate();
    }
    else {
      const afterwards = await later(stream);

      try {
        return looper(await continuation(now(stream))(forget(afterwards)));
      }
      catch (error) {
        return looper(await continuation(now(stream))(forget(await floatOn(afterwards, makeError(error.stack)))));
      }
    }
  };

  return looper;
}

/*
 * Concatenate or delete user inputs in capture mode
 * @return {Process} - The process outputs capture messages with concatenated inputs on single-character capture messages
 */
function parseCaptures() {
  const parser = capture => async (stream) => {
    const parse = (makeCapture, readCapture) => {
      if (hasEnded(message(stream))) {
        return floatOn(commit(stream, parser("")), endCapture(makeCapture(capture)));
      }
      else {
	const newCapture = parseUserInput(capture, readCapture(message(stream)));

        return floatOn(commit(stream, parser(newCapture)), makeCapture(newCapture));
      }
    };
   
    if (isBreakpointCapture(message(stream))) {
      return parse(makeBreakpointCapture, breakpointCapture);
    }
    else if (isQueryCapture(message(stream))) {
      return parse(makeQueryCapture, query);
    }
    else {
      return commit(stream, parser(capture));
    }
  };

  return parser("");
}

/*
 * Make and update the environment tree, and query for the environment and its deferred entries
 * @param {function} send - The callback to send requests over websocket to Inspector
 * @return {Process} - The process outputs environment tree messages on environment and environment entry messages
 */
function parseEnvironmentTree(send) {
  const builder = (environmentTree, selection, pendingEntriesRegister) => async (stream) => {
    if (isDebuggerPaused(message(stream))) {
      sendRequestForEnvironmentDescription(send, message(stream));

      return commit(stream, builder(makeEnvironmentTree(),
	                            makeSelectionInEnvironmentTree(makeEnvironmentTree()),
	                            makePendingEntriesRegister()));
    }
    else if (isEnvironment(message(stream))) {
      const [newEnvironmentTree, newSelection] = (environmentTree => {
        return [environmentTree, refreshSelectedEnvironmentTree(selection, environmentTree)];
      })(insertInEnvironmentTree(environmentTree, "/env", readEnvironment(message(stream)), send));

      return floatOn(commit(stream, builder(newEnvironmentTree, newSelection, pendingEntriesRegister)),
	             makeEnvironmentTreeMessage(newEnvironmentTree));
    }
    else if (isEnvironmentEntry(message(stream))) {
      return resolvePendingEntry(environmentTree,
		                 selection,
		                 pendingEntriesRegister,
		                 message(stream),
		                 entries => entries.filter(entry => entry.isOwn),
		                 send,
		                 (environmentTree, selection, pendingEntriesRegister) => {
			           return floatOn(commit(stream, builder(environmentTree, selection, pendingEntriesRegister)),
					          makeEnvironmentTreeMessage(environmentTree));
                                 });
    }
    else {
      return exploreEnvironmentTree(selection, pendingEntriesRegister, stream, (selection, pendingEntriesRegister) => {
        return commit(stream, builder(environmentTree, selection, pendingEntriesRegister));
      });
    }
  };

  return builder(makeEnvironmentTree(), makeSelectionInEnvironmentTree(makeEnvironmentTree()), makePendingEntriesRegister());
}

/*
 * Make and update the source tree
 * @return {Process} - The process outputs source tree messages on user script parsed messages
 */
function parseSourceTree() {
  const builder = sourceTree => async (stream) => {
    if (isUserScriptParsed(message(stream))) {
      const [path, fileName] = parseFilePath(parsedUserScriptPath(message(stream)));

      const newSourceTree = insertInFileTree(sourceTree,
	                                     path,
	                                     makeFileEntry(fileName, parsedScriptHandle(message(stream))));

      return floatOn(commit(stream, builder(newSourceTree)), makeSourceTreeMessage(newSourceTree));
    }
    else {
      return commit(stream, builder(sourceTree));
    }
  };

  return builder(makeFileTree());
}

/*
 * Query the displayed script source when it changes
 * @param {function} send - The callback to send requests over websocket to Inspector
 * @return {Process}
 */
function pullScriptSource(send) {
  const scriptChecker = displayChange => async (stream) => {
    const onDisplayChange = (displayChange, newDisplayScriptId) => {
      sendRequestForScriptSource(send, newDisplayScriptId);

      return commit(stream, scriptChecker(displayChange));
    };

    const onSelectionChange = (displayChange, scriptId) => {
      return commit(stream, scriptChecker(displayChange));
    };
	  
    return displayChange(onSelectionChange, onDisplayChange)(stream);
  };

  return scriptChecker(displayedScriptSource());
}

/*
 * Send user defined queries to Inspector
 * @param {function} send - The callback to send requests over websocket to Inspector
 * @return {Process}
 */
function queryInspector(send) {
  const requester = async (stream) => {
    if (isQueryCapture(message(stream)) && hasEnded(message(stream))) {
      sendQuery(send, message(stream));

      return commit(stream, requester);
    }
    else {
      return commit(stream, requester);
    }
  };

  return requester;
}

/*
 * Step through the execution
 * @param {function} send - The callback to send requests over websocket to Inspector
 * @return {Process}
 */
function step(send) {
  const stepper = async (stream) => {
    if (isInput(message(stream)) && input(message(stream)) === interactionKeys("stepOver")) {
      sendStepOver(send);
    }
    else if (isInput(message(stream)) && input(message(stream)) === interactionKeys("stepInto")) {
      sendStepInto(send);
    }
    else if (isInput(message(stream)) && input(message(stream)) === interactionKeys("continue")) {
      sendContinue(send);
    }
    else if (isInput(message(stream)) && input(message(stream)) === interactionKeys("stepOut")) {
      sendStepOut(send);
    }

    return commit(stream, stepper);
  };

  return stepper;
}

module.exports = {
  addBreakpoint,
  changeMode,
  loop,
  parseCaptures,
  parseEnvironmentTree,
  parseSourceTree,
  pullScriptSource,
  queryInspector,
  step
};
