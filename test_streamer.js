const EventEmitter = require('events');
const readline = require('readline');
const { Source, now, later } = require('./streamer.js');

class dummyEventEmitter extends EventEmitter {
  constructor() {
    super();

    this.onevent = undefined;

    this.on('event', (event) => this.onevent(event));
  }
};

initialize();

function initialize() {
  const repl = readline.createInterface({ input: process.stdin });

  const events = new dummyEventEmitter();

  repl.on('line', (line) => events.emit('event', line));

  Source.from(events, "onevent").with(test);
}

async function test(stream) {
  if (now(stream) === 'a') {
    return console.log('GOOD');
  }

  return test(await later(stream));
}
