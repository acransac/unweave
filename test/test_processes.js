const { makeEnvironmentTree, makeSelectionInEnvironmentTree, refreshSelectedEnvironmentTree, visitChildEntry } = require('../src/environmenttree.js');
const { selectedEntry, selectedEntryName } = require('filetree');
const { init } = require('../src/init.js');
const { loop, parseEnvironmentTree } = require('../src/processes.js');
const { input, isDebuggerPaused, isEnvironmentTree, isEnvironmentTreeFocus, isError, isInput, makeEnvironmentTreeFocus, message, readEnvironmentTree, reason } = require('../src/protocol.js');
const { commit, continuation, floatOn, forget, later, now, value } = require('streamer');
const Test = require('tester');
const { inputIsCapture, skipToDebuggerPausedAfterStepping, userInput } = require('../src/testutils.js');

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
          userInput("l");

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
  init(["node", "app.js", "test_target_process_environment_array.js"],
       checkEnvironmentTreeFirstEntry("Array test", "String 0: \"abc\"")(check),
       finish);
}

function test_loop(finish, check) {
  const loopThenExitOnDebuggerPaused = (send, render, terminate) => {
    const sendExitOnDebuggerPaused = async (stream) => {
      if (isDebuggerPaused(message(stream))) {
        userInput("\x03");
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
	userInput("e");

        return commit(stream, failOnInputE);
      }
      else if (isInput(message(stream)) && input(message(stream)) === "e") {
        stream(); // fails
      }
      else if (isInput(message(stream))) {
        return commit(stream, failOnInputE);
      }
      else if (isError(message(stream)) && reason(message(stream)).startsWith("TypeError: stream is not a function")) {
        userInput("\x03");

        return commit(stream, failOnInputE);
      }
      else {
	check(false);

        userInput("\x03");

        return commit(stream, failOnInputE);
      }
    };

    return async (stream) => loop(terminate)(await failOnInputE(await skipToDebuggerPausedAfterStepping(send, 0)(stream)));
  }

  init(["node", "app.js", "test_target.js"], failOnInputEThenExit, finish);
}

Test.runInSequence([
  Test.makeTest(test_parseEnvironmentTreeWithObject, "Parse Environment Tree With Object"),
  Test.makeTest(test_parseEnvironmentTreeWithArray, "Parse Environment Tree With Array"),
  Test.makeTest(test_loop, "Loop With Exit"),
  Test.makeTest(test_errorHandling, "Error Handling")
]);
