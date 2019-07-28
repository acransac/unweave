const WebSocket = require('ws');
const readline = require('readline');

connectToInspector(process.argv[2]);

function connectToInspector(sessionHash) {
    const ws = new WebSocket(`ws://localhost:9230/${sessionHash}`);

    ws.onopen = connectionOpened;

    ws.onerror = connectionFailed;

    ws.onmessage = receive;
}

function connectionOpened() {
  console.log("Connection opened");

  const repl = readline.createInterface({ input: process.stdin });

  repl.on('line', readOneLine.bind(null, this));
}

function connectionFailed(error) {
  console.log(error);
}

function receive(message) {
  console.log(message.data);
}

function readOneLine(ws, line) {
  let method, parameters;

  [method, parameters] = parseOneLine(line);
  
  ws.send(JSON.stringify({
    method: method,
    params: parameters,
    id: 0
  }));
}

function parseOneLine(line) {
  return line.match(/^([^\s]+)|[^\1]+/g);
}
