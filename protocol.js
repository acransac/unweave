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
function makeLocation(scriptHandle, lineNumber, columnNumber) {
  return [scriptHandle, lineNumber, columnNumber];
}

function makeLocationFromInspectorLocation(inspectorLocation) {
  return [inspectorLocation.scriptId, inspectorLocation.lineNumber, inspectorLocation.columnNumber];
}

function scriptHandle(location) {
  return location[0];
}

function lineNumber(location) {
  return location[1];
}

function columnNumber(location) {
  return location[2];
}

// Inspector query
function makeInspectorQuery(method, parameters, requestId) {
  return JSON.stringify({method: method, params: parameters, id: requestId ? requestId : 0})
}

function parseInspectorQuery(line) {
  const [method, parameters] = line.match(/^([^\s]+)|[^\1]+/g);

  return [method, parseJsValue(parameters ? parameters : "")];
}

function sendQuery(send, message) {
  send(...parseInspectorQuery(query(message)));
}

// Execution context created message
function isExecutionContextCreated(message) {
  return isMethod(message, "Runtime.executionContextCreated");
}

function sendEnableRuntime(send) {
  send("Runtime.enable", {}); 
}

// Debugger enabled message
function isDebuggerEnabled(message) {
  return isResult(message, "debuggerId");
}

function sendEnableDebugger(send) {
  send("Debugger.enable", {}); 
}

function sendStartRun(send) {
  send("Runtime.runIfWaitingForDebugger", {}); 
}

// Debugger paused message
function isDebuggerPaused(message) {
  return isMethod(message, "Debugger.paused");
}

function pauseLocation(message) {
  return makeLocationFromInspectorLocation(message.params.callFrames[0].location);
}

function sendStepOver(send) {
  send("Debugger.stepOver", {});
}

function sendStepInto(send) {
  send("Debugger.stepInto", {});
}

function sendContinue(send) {
  send("Debugger.resume", {});
}

function sendStepOut(send) {
  send("Debugger.stepOut", {});
}

// Script parsed message
function isScriptParsed(message) {
  return isMethod(message, "Debugger.scriptParsed");
}

function isUserScriptParsed(message) {
  return isScriptParsed(message) && parsedScriptUrl(message).startsWith("file://");
}

function parsedScriptHandle(message) {
  return message.params.scriptId;
}

function parsedScriptUrl(message) {
  return message.params.url;
}

function parsedUserScriptPath(message) {
  return parsedScriptUrl(message).slice("file://".length);
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
  return message.result.scriptSource.trim();
}

function sendRequestForScriptSource(send, scriptHandle) {
  send("Debugger.getScriptSource", {scriptId: scriptHandle});
}

// Environment message
function isEnvironment(message) {
  return isResult(message, "result") && message.id === 0;
}

function isEnvironmentEntry(message) {
  return isResult(message, "result") && message.id !== 0;
}

function readEnvironment(message) {
  return message.result.result;
}

function readEnvironmentEntryUniqueId(message) {
  return message.id;
}

function name(entry) {
  return entry.name;
}

function type(entry) {
  const capitalizeName = name => name.charAt(0).toUpperCase() + name.slice(1);

  if (entry.value.type === "object" || entry.value.type === "function") {
    if (entry.value.subtype === "null" || entry.value.subtype === "proxy") {
      return capitalizeName(entry.value.subtype);
    }
    else {
      return entry.value.className;
    }
  }
  else {
    return capitalizeName(entry.value.type);
  }
}

function entryValue(entry) {
  return (entry.value.type === "string" ? value => `\"${value}\"` :  value => value)(entry.value.value)
}

function remoteHandle(entry) {
  return JSON.parse(entry.value.objectId);
}

function entryUniqueId(entry) {
  return (({injectedScriptId, id}) => Number(`${injectedScriptId}0${id}`))(remoteHandle(entry));
}

function sendRequestForEnvironmentDescription(send, message) {
  send("Runtime.getProperties", {objectId: message.params.callFrames[0].scopeChain[0].object.objectId});
}

function sendRequestForEnvironmentEntryDescription(send, entry) {
  send("Runtime.getProperties", {objectId: JSON.stringify(remoteHandle(entry))}, entryUniqueId(entry));
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

function sendSetBreakpoint(send, scriptHandle, breakpointLine) {
  send("Debugger.setBreakpoint", {location: {scriptId: scriptHandle, lineNumber: breakpointLine}});
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

// Environment tree focus message
function makeEnvironmentTreeFocus(capture) {
  return makeCapture("focusEnvironmentTree", capture ? capture : "");
}

function isEnvironmentTreeFocus(message) {
  return message.hasOwnProperty("focusEnvironmentTree");
}

function environmentTreeFocusInput(message) {
  return message.focusEnvironmentTree;
}

module.exports = {
  breakpointCapture,
  breakpointLine,
  columnNumber,
  endCapture,
  entryUniqueId,
  entryValue,
  hasEnded,
  input,
  isBreakpointCapture,
  isDebuggerEnabled,
  isDebuggerPaused,
  isEnvironment,
  isEnvironmentEntry,
  isExecutionContextCreated,
  isInput,
  isMessagesFocus,
  isQueryCapture,
  isScriptParsed,
  isScriptSource,
  isSourceTree,
  isSourceTreeFocus,
  isUserScriptParsed,
  lineNumber,
  makeBreakpointCapture,
  makeEnvironmentTreeFocus,
  makeInput,
  makeInspectorQuery,
  makeLocation,
  makeMessagesFocus,
  makeQueryCapture,
  makeSourceTreeFocus,
  makeSourceTreeMessage,
  message,
  messagesFocusInput,
  name,
  parsedScriptHandle,
  parsedScriptUrl,
  parsedUserScriptPath,
  pauseLocation,
  query,
  readEnvironment,
  readEnvironmentEntryUniqueId,
  readScriptSource,
  readSourceTree,
  scriptHandle,
  sendContinue,
  sendEnableDebugger,
  sendEnableRuntime,
  sendQuery,
  sendRequestForEnvironmentEntryDescription,
  sendRequestForEnvironmentDescription,
  sendRequestForScriptSource,
  sendSetBreakpoint,
  sendStartRun,
  sendStepInto,
  sendStepOut,
  sendStepOver,
  sourceTreeFocusInput,
  type
};
