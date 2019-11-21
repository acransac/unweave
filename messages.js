const parseJsValue = require('./jsvalueparser.js');
const Readline = require('readline');

function inputCapture() {
  Readline.emitKeypressEvents(process.stdin);

  process.stdin.setRawMode(true);

  process.stdin.on('keypress', key => process.stdin.emit('input', JSON.stringify({input: key})));

  return process.stdin;
}

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

function parseOneLine(line) {
  const [method, parameters] = line.match(/^([^\s]+)|[^\1]+/g);

  return [method, parseJsValue(parameters ? parameters : "")];
}

module.exports = { inputCapture, parseOneLine, data, isMethod, isResult, isInput, isBreakpointCapture, isQueryCapture, isMessagesFocus, isSourceTreeFocus, isSourceTree };
