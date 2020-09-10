const { breakpoints, displayedScript, runLocation, scriptSource } = require('../src/components.js');
const { ctrlCInput, tag, unpackedContent, writeScriptSource } = require('../src/helpers.js');
const { init } = require('../src/init.js');
const { performance, PerformanceObserver } = require('perf_hooks');
const { loop, pullScriptSource } = require('../src/processes.js');
const { interactionKeys } = require('../src/protocol.js');
const { atom, compose, label, show } = require('@acransac/terminal');
const Test = require('@acransac/tester');
const { makeInputSequence, repeatKey, skipToDebuggerPausedAfterStepping, userInput } = require('../src/testutils.js');

function test_scriptSourceScrollPerformance(finish, check) {
  const testSession = (send, render, terminate) => {
    const userInteraction = async (stream) => {
      userInput(makeInputSequence([
                  "",
                  ...repeatKey(interactionKeys("scrollDown"), 1000),
                  ctrlCInput()
                ], 10));

      return stream;
    };

    const startPerformanceMeasurement = async (stream) => {
      const observer = new PerformanceObserver((entries, observer) => {
        check(entries.getEntriesByName("execution time")[0].duration < 100200);
        
        observer.disconnect();
      });

      observer.observe({entryTypes: ["measure"]});

      performance.mark("begin");

      return stream;
    };

    const endPerformanceMeasurement = () => {
      performance.mark("end");

      performance.measure("execution time", "begin", "end");
    };

    const scriptSourceDisplay = (source, runLocation, breakpoints, displayedScript) => {
      return label(atom(writeScriptSource(unpackedContent(source), runLocation, breakpoints, displayedScript)), tag(source));
    };

    return async (stream) => {
      return loop(() => {
               endPerformanceMeasurement();

               terminate();
             })
               (await userInteraction
                 (await startPerformanceMeasurement
                   (await show(render)(compose(scriptSourceDisplay,
                                               scriptSource(),
                                               runLocation(),
                                               breakpoints(),
                                               displayedScript()))
                     (await pullScriptSource(send)
                       (await skipToDebuggerPausedAfterStepping(send, 0)(stream))))));
    };
  };

  init(["node", "app.js", "targets/test_target_script_source_scroll_performance.js"], testSession, finish);
}

module.exports = Test.run([
  Test.makeTest(test_scriptSourceScrollPerformance, "Script Source Scroll Performance")
], "Test Performance");
