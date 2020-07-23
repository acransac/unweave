#!/usr/bin/env node

// Copyright (c) Adrien Cransac
// License: MIT

const { debugSession } = require('./debugsession.js');
const { init } = require('./init.js');

init(process.argv, debugSession, () => {});
