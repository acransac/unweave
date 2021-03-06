// Copyright (c) Adrien Cransac
// License: MIT

const { init } = require('../src/init.js');
const { isDebuggerEnabled, isDebuggerPaused, isScriptParsed, message } = require('../src/protocol.js');
const { floatOn, later, now, value } = require('@acransac/streamer');
const Test = require('@acransac/tester');

function test_init(finish, check) {
  const testSession = (send, render, terminate) => {
    const sessionStarted = async (stream) => {
      if (isDebuggerPaused(message(stream))) {
        return floatOn(stream, true);
      }
      else if (isScriptParsed(message(stream))) {
        return sessionStarted(await later(stream));
      }
      else if (isDebuggerEnabled(message(stream))) {
        return sessionStarted(await later(stream));
      }
      // Inspector's empty response to RunIfWaitingForDebugger
      else if (Object.entries(message(stream).result).length === 0) {
        return sessionStarted(await later(stream));
      }
      else {
        return floatOn(stream, false);
      }
    };

    return async (stream) => {
      return terminate(check(value(now(await sessionStarted(stream)))));
    };
  };

  init(["node", "app.js", "targets/test_target.js"], testSession, finish);
}

module.exports = Test.run([
  Test.makeTest(test_init, "Session Initialization")
], "Test Init");
