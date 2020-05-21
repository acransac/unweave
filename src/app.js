#!/usr/bin/env node

const { debugSession } = require('./debugsession.js');
const { init } = require('./init.js');

init(process.argv, debugSession, () => {});
