const parseJsValue = require('./jsvalueparser.js');
const { now, value } = require('streamer');

// Helpers --
// Extract message from stream
function message(stream) {
  return JSON.parse(value(now(stream)));
}

// Classify Inspector message 
function isMethod(message, methodName) {
  return message.hasOwnProperty("method") && message.method === methodName;
}

function isResult(message, resultName) {
  return message.hasOwnProperty("result") && message.result.hasOwnProperty(resultName);
}

// Types --
// Location
function makeLocation(scriptHandle, lineNumber) {
  return [scriptHandle, lineNumber];
}

function makeLocationFromInspectorLocation(inspectorLocation) {
  return [inspectorLocation.scriptId, inspectorLocation.lineNumber];
}

function scriptHandle(location) {
  return location[0];
}

function lineNumber(location) {
  return location[1];
}

// Inspector query
function makeInspectorQuery(method, parameters) {
  return JSON.stringify({method: method, params: parameters, id: 0})
}

function parseInspectorQuery(line) {
  const [method, parameters] = line.match(/^([^\s]+)|[^\1]+/g);

  return [method, parseJsValue(parameters ? parameters : "")];
}

// Execution context created message
function isExecutionContextCreated(message) {
  return isMethod(message, "Runtime.executionContextCreated");
}

// Debugger enabled message
function isDebuggerEnabled(message) {
  return isResult(message, "debuggerId");
}

// Debugger paused message
function isDebuggerPaused(message) {
  return isMethod(message, "Debugger.paused");
}

function pauseLocation(message) {
  return makeLocationFromInspectorLocation(message.params.callFrames[0].location);
}

function environmentRemoteObjectId(message) {
  return message.params.callFrames[0].scopeChain[0].object.objectId;
}

// Script parsed message
function isScriptParsed(message) {
  return isMethod(message, "Debugger.scriptParsed");
}

function parsedScriptHandle(message) {
  return message.params.scriptId;
}

function parsedScriptUrl(message) {
  return message.params.url;
}

// Input message
function makeInput(key) {
  return JSON.stringify({input: key});
}
function isInput(message) {
  return message.hasOwnProperty("input");
}

function input(message) {
  return message.input;
}

// Script source message
function isScriptSource(message) {
  return isResult(message, "scriptSource");
}

function readScriptSource(message) {
  return message.result.scriptSource;
}

// Environment message
function isEnvironment(message) {
  return isResult(message, "result");
}

function readEnvironment(message) {
  return message.result.result;
}

// Source tree message
function makeSourceTreeMessage(sourceTree) {
  return JSON.stringify({sourceTree: sourceTree});
}

function isSourceTree(message) {
  return message.hasOwnProperty("sourceTree");
}

function readSourceTree(message) {
  return message.sourceTree;
}

// Capture message
function makeCapture(category, value) {
  return JSON.stringify(Object.fromEntries([[category, value], ["ended", false]]));
}

function hasEnded(message) {
  return message.hasOwnProperty("ended") && message.ended;
}

function endCapture(captureString) {
  return (capture => {
    capture.ended = true;
   
    return JSON.stringify(capture);
  })(JSON.parse(captureString));
}

// Breakpoint capture message
function makeBreakpointCapture(capture) {
  return makeCapture("breakpoint", capture ? capture : "");
}

function isBreakpointCapture(message) {
  return message.hasOwnProperty("breakpoint");
}

function breakpointCapture(message) {
  return message.breakpoint;
}

function breakpointLine(message) {
  return Number(breakpointCapture(message));
}

// Query capture message
function makeQueryCapture(capture) {
  return makeCapture("query", capture ? capture : "");
}

function isQueryCapture(message) {
  return message.hasOwnProperty("query");
}

function query(message) {
  return message.query;
}

// Messages focus message
function makeMessagesFocus(capture) {
  return makeCapture("focusMessages", capture ? capture : "");
}

function isMessagesFocus(message) {
  return message.hasOwnProperty("focusMessages");
}

function messagesFocusInput(message) {
  return message.focusMessages;
}

// Source tree focus message
function makeSourceTreeFocus(capture) {
  return makeCapture("focusSourceTree", capture ? capture : "");
}

function isSourceTreeFocus(message) {
  return message.hasOwnProperty("focusSourceTree");
}

function sourceTreeFocusInput(message) {
  return message.focusSourceTree;
}

module.exports = {
  breakpointCapture,
  breakpointLine,
  endCapture,
  environmentRemoteObjectId,
  hasEnded,
  input,
  isBreakpointCapture,
  isDebuggerEnabled,
  isDebuggerPaused,
  isEnvironment,
  isExecutionContextCreated,
  isInput,
  isMessagesFocus,
  isQueryCapture,
  isScriptParsed,
  isScriptSource,
  isSourceTree,
  isSourceTreeFocus,
  lineNumber,
  makeBreakpointCapture,
  makeInput,
  makeInspectorQuery,
  makeLocation,
  makeMessagesFocus,
  makeQueryCapture,
  makeSourceTreeFocus,
  makeSourceTreeMessage,
  message,
  messagesFocusInput,
  parsedScriptHandle,
  parsedScriptUrl,
  parseInspectorQuery,
  pauseLocation,
  query,
  readEnvironment,
  readScriptSource,
  readSourceTree,
  scriptHandle,
  sourceTreeFocusInput
};
