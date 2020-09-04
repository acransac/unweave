// Copyright (c) Adrien Cransac
// License: MIT

const { breakpoints, commandLine, displayedScript, environmentTree, focusableCaptureLog, instructions, logCapture, messages, runLocation, scriptSource, sourceTree, topRightColumnDisplay } = require('./components.js');
const { addBreakpoint, changeMode, loop, parseCaptures, parseEnvironmentTree, parseSourceTree, pullScriptSource, queryInspector, step } = require('./processes.js');
const { breakpointCapture, interactionKeys, isBreakpointCapture, isDebuggerPaused, isQueryCapture, query } = require('./protocol.js');
const { developerDisplay } = require('./templates.js');
const { compose, show } = require('@acransac/terminal');

/*
 * Get a streamer process that organizes an interactive Node.js debugging session backed by Google's V8 Inspector
 * @param {function} send - A callback that sends requests over websocket to Inspector
 * @param {function} render - Terminal's render callback
 * @param {function} terminate - Terminal's tear down callback
 * @return {Process}
 */
function debugSession(send, render, terminate) {
  return async (stream) => {
    const debugLogger = () => {};

    return loop(terminate)(await show(render)(compose(developerDisplay,
                                                      scriptSource(),
                                                      runLocation(),
                                                      breakpoints(),
                                                      displayedScript(),
                                                      topRightColumnDisplay(),
                                                      environmentTree(),
                                                      messages(message => false, debugLogger),
                                                      sourceTree(),
                                                      commandLine(),
                                                      instructions(),
                                                      focusableCaptureLog(logCapture(isQueryCapture, query, "Query Inspector"),
                                                                          isQueryCapture,
                                                                          "query Inspector",
                                                                          interactionKeys("queryCapture")),
                                                      focusableCaptureLog(logCapture(isBreakpointCapture,
                                                                                     breakpointCapture,
                                                                                     "Add breakpoint at line"),
                                                                          isBreakpointCapture,
                                                                          "add breakpoint",
                                                                          interactionKeys("breakpointCapture"))))(
                                                await step(send)(
                                                  await queryInspector(send)(
                                                    await addBreakpoint(send)(
                                                      await pullScriptSource(send)(
                                                        await parseEnvironmentTree(send)(
                                                          await parseSourceTree()(
                                                            await parseCaptures()(
                                                              await changeMode(stream))))))))));
  };
}

module.exports = { debugSession };
