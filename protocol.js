const parseJsValue = require('./jsvalueparser.js');
const { now, value } = require('streamer');

function message(stream) {
  return JSON.parse(value(now(stream)));
}

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

function isMethod(message, methodName) {
  return message.hasOwnProperty("method") && message.method === methodName;
}

function isResult(message, resultName) {
  return message.hasOwnProperty("result") && message.result.hasOwnProperty(resultName);
}

function hasEnded(message) {
  return message.hasOwnProperty("ended") && message.ended;
}

// Input message
function isInput(message) {
  return message.hasOwnProperty("input");
}

function input(message) {
  return message.input;
}

// Breakpoint capture message
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
function isQueryCapture(message) {
  return message.hasOwnProperty("query");
}

function query(message) {
  return message.query;
}

// Focus on log message
function isMessagesFocus(message) {
  return message.hasOwnProperty("focusMessages");
}

function messagesFocusInput(message) {
  return message.focusMessages;
}

function isSourceTree(message) {
  return message.hasOwnProperty("sourceTree");
}

// Focus on source tree message
function isSourceTreeFocus(message) {
  return message.hasOwnProperty("focusSourceTree");
}

function sourceTreeFocusInput(message) {
  return message.focusSourceTree;
}

// Execution context created message
function isExecutionContextCreated(message) {
  return isMethod(message, "Runtime.executionContextCreated");
}

// Debugger enabled message
function isDebuggerEnabled(message) {
  return isResult(message, "debuggerId");
}

// Script source message
function isScriptSource(message) {
  return isResult(message, "scriptSource");
}

function readScriptSource(message) {
  return message.result.scriptSource;
}

// Debugger paused message
function isDebuggerPaused(message) {
  return isMethod(message, "Debugger.paused");
}

function readPauseLocation(message) {
  return makeLocationFromInspectorLocation(message.params.callFrames[0].location);
}

function readEnvironmentRemoteObjectId(message) {
  return message.params.callFrames[0].scopeChain[0].object.objectId;
}

// Environment message
function isEnvironment(message) {
  return isResult(message, "result");
}

function readEnvironment(message) {
  return message.result.result;
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

function parseInspectorQuery(line) {
  const [method, parameters] = line.match(/^([^\s]+)|[^\1]+/g);

  return [method, parseJsValue(parameters ? parameters : "")];
}

module.exports = { breakpointCapture, breakpointLine, hasEnded, input, isBreakpointCapture, isDebuggerEnabled, isDebuggerPaused, isEnvironment, isExecutionContextCreated, isInput, isMessagesFocus, isQueryCapture, isScriptParsed, isScriptSource, isSourceTree, isSourceTreeFocus, lineNumber, makeLocation, message, messagesFocusInput, parsedScriptHandle, parsedScriptUrl, parseInspectorQuery, query, readEnvironment, readEnvironmentRemoteObjectId, readPauseLocation, readScriptSource, scriptHandle, sourceTreeFocusInput };
