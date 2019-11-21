const parseJsValue = require('./jsvalueparser.js');

function data(message) {
  return JSON.parse(message);
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

function parseInspectorQuery(line) {
  const [method, parameters] = line.match(/^([^\s]+)|[^\1]+/g);

  return [method, parseJsValue(parameters ? parameters : "")];
}

module.exports = { data, isBreakpointCapture, isInput, isMessagesFocus, isMethod, isQueryCapture, isResult, isSourceTree, isSourceTreeFocus, parseInspectorQuery };
