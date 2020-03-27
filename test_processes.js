const { init } = require('./init.js');
const { parseEnvironmentTree } = require('./processes.js');
const { isDebuggerPaused, makeEnvironmentTreeFocus, message } = require('./protocol.js');
const { continuation, later, now, value } = require('streamer');
const Test = require('tester');
const { inputIsCapture, skipToDebuggerPausedAfterStepping } = require('./testutils.js');

function test_parseEnvironmentTree(finish, check) {
  const testSession = (send, render, terminate) => {
    const controlSelection = message => refreshSelectedEnvironmentTree(makeSelectionInEnvironmentTree(makeEnvironmentTree()),
	                                                               readEnvironmentTree(message));

    const firstCheck = async (stream) => {
      if (isDebuggerPaused(message(stream))) {
        return firstCheck(await continuation(stream)(await later(stream)));
      }
      else if (isEnvironmentTree(message(stream))
	         && (selection => selectedEntryName(selectedEntry(selection)) === "/Object test")
	              (controlSelection(message(stream)))) {
        process.stdin.write("l");

        return secondCheck(await continuation(stream)(await later(stream)));
      }
      else {
        return floatOn(stream, false);
      }
    };

    const secondCheck = async (stream) => {
      if (isEnvironmentTreeFocus(message(stream))) {
        return secondCheck(await continuation(stream)(await later(stream)));
      }
      else if (isEnvironmentTree(message(stream))
	         && (selection => selectedEntryName(selectedEntry(selection)) === "/Object test/String a: \"abc\"")
	              (visitChildEntry(controlSelection(message(stream))))) {
        return floatOn(stream, true);
      }
      else {
        return floatOn(stream, false);
      }
    };

    return async (stream) => {
      return finish(terminate(check(value(now(await firstCheck
	                                       (await parseEnvironmentTree()
	                                         (await inputIsCapture(makeEnvironmentTreeFocus)
					           (await skipToDebuggerPausedAfterStepping(send, 1)(stream)))))))));
    };
  };

  init(["node", "app.js", "test_target.js"], testSession);
}

Test.run([
  Test.makeTest(test_parseEnvironmentTree, "Parse Environment Tree")
]);
