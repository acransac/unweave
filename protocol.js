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

function isInput(message) {
  return message.hasOwnProperty("input");
}

function isBreakpointCapture(message) {
  return message.hasOwnProperty("breakpoint");
}

function isQueryCapture(message) {
  return message.hasOwnProperty("query");
}

function isMessagesFocus(message) {
  return message.hasOwnProperty("focusMessages");
}

function isSourceTree(message) {
  return message.hasOwnProperty("sourceTree");
}

function isSourceTreeFocus(message) {
  return message.hasOwnProperty("focusSourceTree");
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

module.exports = { isBreakpointCapture, isDebuggerPaused, isInput, isMessagesFocus, isMethod, isQueryCapture, isResult, isScriptParsed, isScriptSource, isSourceTree, isSourceTreeFocus, lineNumber, makeLocation, message, parsedScriptHandle, parsedScriptUrl, parseInspectorQuery, readEnvironmentRemoteObjectId, readPauseLocation, readScriptSource, scriptHandle };
