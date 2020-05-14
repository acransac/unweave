const { makeEnvironmentTree, makeSelectionInEnvironmentTree, refreshSelectedEnvironmentTree, visitChildEntry } = require('../src/environmenttree.js');
const { selectedEntry, selectedEntryName } = require('filetree');
const { backspaceInput, ctrlCInput, enterInput } = require('../src/helpers.js');
const { init } = require('../src/init.js');
const { changeMode, loop, parseCaptures, parseEnvironmentTree } = require('../src/processes.js');
const { breakpointCapture, environmentTreeFocusInput, hasEnded, input, interactionKeys, isBreakpointCapture, isDebuggerPaused, isEnvironmentTree, isEnvironmentTreeFocus, isError, isInput, isMessagesFocus, isQueryCapture, isSourceTreeFocus, makeEnvironmentTreeFocus, message, messagesFocusInput, query, readEnvironmentTree, reason, sourceTreeFocusInput } = require('../src/protocol.js');
const { commit, continuation, floatOn, forget, later, now, value } = require('streamer');
const Test = require('tester');
const { inputIsCapture, makeInputSequence, repeatKey, skipToDebuggerPausedAfterStepping, userInput } = require('../src/testutils.js');

function controlSequence(check, ...isExpected) {
  const fail = () => {
    check(false);

    userInput(makeInputSequence([ctrlCInput()]));

    const consumeAllEvents = async (stream) => commit(stream, consumeAllEvents);

    return consumeAllEvents;
  };

  const control = (isExpected, continuation) => async (stream) => {
    if (isExpected(message(stream))) {
      return commit(stream, continuation);
    }
    else {
      return commit(stream, fail());
    }
  };

  const sequence = (...isExpected) => async (stream) => {
    if (isExpected.length === 0) {
      return stream;
    }
    else {
      return control(isExpected[0], sequence(...isExpected.slice(1)))(stream);
    }
  };

  return sequence(...isExpected);
}

function checkEnvironmentTreeFirstEntry(entryDescription, firstChildEntryDescription) {
  return check => {
    return (send, render, terminate) => {
      const controlSelection = message => refreshSelectedEnvironmentTree(makeSelectionInEnvironmentTree(makeEnvironmentTree()),
                                                                         readEnvironmentTree(message));

      const firstCheck = async (stream) => {
        if (isDebuggerPaused(message(stream))) {
          return firstCheck(await continuation(now(stream))(forget(await later(stream))));
        }
        else if (isEnvironmentTree(message(stream))
                   && (selection => selectedEntryName(selectedEntry(selection)) === `/${entryDescription}`)
                        (controlSelection(message(stream)))) {
          userInput(makeInputSequence([interactionKeys("selectChild")]));

          return secondCheck(await continuation(now(stream))(forget(await later(stream))));
        }
        else {
          return floatOn(stream, false);
        }
      };

      const secondCheck = async (stream) => {
        if (isEnvironmentTreeFocus(message(stream))) {
          return secondCheck(await continuation(now(stream))(forget(await later(stream))));
        }
        else if (isEnvironmentTree(message(stream))
                   && (selection => selectedEntryName(selectedEntry(selection))
          		            === `/${entryDescription}${firstChildEntryDescription ? "/" + firstChildEntryDescription
          		                                                                  : ""}`)
                        (visitChildEntry(controlSelection(message(stream))))) {
          return floatOn(stream, true);
        }
        else {
          return floatOn(stream, false);
        }
      };

      return async (stream) => {
        return terminate(check(value(now(await firstCheck
                                          (await parseEnvironmentTree(send)
                                            (await inputIsCapture(makeEnvironmentTreeFocus)
          				      (await skipToDebuggerPausedAfterStepping(send, 1)(stream))))))));
      };
    };
  };
}

function test_parseEnvironmentTreeWithObject(finish, check) {
  init(["node", "app.js", "test_target.js"],
       checkEnvironmentTreeFirstEntry("Object test", "String a: \"abc\"")(check),
       finish);
}

function test_parseEnvironmentTreeWithArray(finish, check) {
  init(["node", "app.js", "test_target_array.js"],
       checkEnvironmentTreeFirstEntry("Array test", "String 0: \"abc\"")(check),
       finish);
}

function test_loop(finish, check) {
  const loopThenExitOnDebuggerPaused = (send, render, terminate) => {
    const sendExitOnDebuggerPaused = async (stream) => {
      if (isDebuggerPaused(message(stream))) {
        userInput(makeInputSequence([ctrlCInput()]));
      }

      return commit(stream, sendExitOnDebuggerPaused);
    };

    return async (stream) => loop(terminate)(await sendExitOnDebuggerPaused(stream));
  }

  init(["node", "app.js", "test_target.js"], loopThenExitOnDebuggerPaused, finish);
}

function test_errorHandling(finish, check) {
  const failOnInputEThenExit = (send, render, terminate) => {
    const failOnInputE = async (stream) => {
      if (isDebuggerPaused(message(stream))) {
	userInput(makeInputSequence(["e"]));

        return commit(stream, failOnInputE);
      }
      else if (isInput(message(stream)) && input(message(stream)) === "e") {
        stream(); // fails
      }
      else if (isInput(message(stream))) {
        return commit(stream, failOnInputE);
      }
      else if (isError(message(stream)) && reason(message(stream)).startsWith("TypeError: stream is not a function")) {
        userInput(makeInputSequence([ctrlCInput()]));

        return commit(stream, failOnInputE);
      }
      else {
	check(false);

        userInput(makeInputSequence([ctrlCInput()]));

        return commit(stream, failOnInputE);
      }
    };

    return async (stream) => loop(terminate)(await failOnInputE(await skipToDebuggerPausedAfterStepping(send, 0)(stream)));
  }

  init(["node", "app.js", "test_target.js"], failOnInputEThenExit, finish);
}

function test_changeMode(finish, check) {
  const changeModeTest = (send, render, terminate) => {
    const userInteraction = async (stream) => {
      userInput(makeInputSequence([interactionKeys("breakpointCapture"), "1", enterInput()], 1000),
                makeInputSequence([interactionKeys("queryCapture"), "a", enterInput()], 1000),
                makeInputSequence([interactionKeys("sourceTreeFocus"), "j", enterInput()], 1000),
                makeInputSequence([interactionKeys("environmentTreeFocus"), "j", enterInput()], 1000),
                makeInputSequence([interactionKeys("messagesFocus"), "j", enterInput()], 1000),
                makeInputSequence(["d", ctrlCInput()], 1000));

      return await later(stream);
    };

    const controlModeOpen = isMode => message => isMode(message) && !hasEnded(message);

    const controlModalInput = (isMode, readInput, controlInput) => message => {
      return isMode(message) && !hasEnded(message) && readInput(message) === controlInput
    };

    const controlModeClose = isMode => message => isMode(message) && hasEnded(message);

    const controlDefaultInput = controlInput => message => isInput(message) && input(message) === controlInput;

    return async (stream) => loop(terminate)
                               (await controlSequence(check,
				                      controlModeOpen(isBreakpointCapture),
				                      controlModalInput(isBreakpointCapture, breakpointCapture, "1"),
				                      controlModeClose(isBreakpointCapture),
                                                      controlModeOpen(isQueryCapture),
				                      controlModalInput(isQueryCapture, query, "a"),
				                      controlModeClose(isQueryCapture),
                                                      controlModeOpen(isSourceTreeFocus),
				                      controlModalInput(isSourceTreeFocus, sourceTreeFocusInput, "j"),
				                      controlModeClose(isSourceTreeFocus),
                                                      controlModeOpen(isEnvironmentTreeFocus),
				                      controlModalInput(isEnvironmentTreeFocus, environmentTreeFocusInput, "j"),
				                      controlModeClose(isEnvironmentTreeFocus),
                                                      controlModeOpen(isMessagesFocus),
				                      controlModalInput(isMessagesFocus, messagesFocusInput, "j"),
				                      controlModeClose(isMessagesFocus),
                                                      controlDefaultInput("d"))
				 (await changeMode
	                           (await userInteraction
			             (await skipToDebuggerPausedAfterStepping(send, 0)(stream)))));
  };

  init(["node", "app.js", "test_target.js"], changeModeTest, finish);
}

function test_parseCaptures(finish, check) {
  const parseCapturesTest = (send, render, terminate) => {
    const userInteraction = async (stream) => {
      userInput(makeInputSequence([
        interactionKeys("breakpointCapture"),
	"1",
	...repeatKey(backspaceInput(), 2),
	"1",
	"2",
	enterInput(),
      ], 1000),
                makeInputSequence([
        interactionKeys("queryCapture"),
	"a",
	...repeatKey(backspaceInput(), 2),
	"a",
	"b",
	enterInput(),
	"d",
	ctrlCInput()
      ], 1000));

      return await later(stream);
    };

    const controlCurrentCapture = (isCapture, readCapture, controlCapture) => message => {
      return isCapture(message) && !hasEnded(message) && readCapture(message) === controlCapture;
    };

    const controlEndedCapture = (isCapture, readCapture, controlCapture) => message => {
      return isCapture(message) && hasEnded(message) && readCapture(message) === controlCapture;
    };

    const controlDefaultInput = controlInput => message => isInput(message) && input(message) === controlInput;

    return async (stream) => loop(terminate)
                               (await controlSequence(check,
                                                      controlCurrentCapture(isBreakpointCapture, breakpointCapture, ""),
                                                      controlCurrentCapture(isBreakpointCapture, breakpointCapture, "1"),
                                                      controlCurrentCapture(isBreakpointCapture, breakpointCapture, ""),
                                                      controlCurrentCapture(isBreakpointCapture, breakpointCapture, ""),
                                                      controlCurrentCapture(isBreakpointCapture, breakpointCapture, "1"),
                                                      controlCurrentCapture(isBreakpointCapture, breakpointCapture, "12"),
                                                      controlEndedCapture(isBreakpointCapture, breakpointCapture, "12"),
                                                      controlCurrentCapture(isQueryCapture, query, ""),
                                                      controlCurrentCapture(isQueryCapture, query, "a"),
                                                      controlCurrentCapture(isQueryCapture, query, ""),
                                                      controlCurrentCapture(isQueryCapture, query, ""),
                                                      controlCurrentCapture(isQueryCapture, query, "a"),
                                                      controlCurrentCapture(isQueryCapture, query, "ab"),
                                                      controlEndedCapture(isQueryCapture, query, "ab"),
                                                      controlDefaultInput("d"))
				 (await parseCaptures()
				   (await changeMode
	                             (await userInteraction
			               (await skipToDebuggerPausedAfterStepping(send, 0)(stream))))));
  };

  init(["node", "app.js", "test_target.js"], parseCapturesTest, finish);
}

module.exports = Test.runInSequence([
  Test.makeTest(test_parseEnvironmentTreeWithObject, "Parse Environment Tree With Object"),
  Test.makeTest(test_parseEnvironmentTreeWithArray, "Parse Environment Tree With Array"),
  Test.makeTest(test_loop, "Loop With Exit"),
  Test.makeTest(test_errorHandling, "Error Handling"),
  Test.makeTest(test_changeMode, "Change Mode"),
  Test.makeTest(test_parseCaptures, "Parse Captures")
], "Test Processes");
