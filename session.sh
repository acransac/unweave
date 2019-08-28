#!/bin/sh

node --inspect-brk=localhost:9230 plastron.js 2> LOG & sleep 1;

head -1 LOG | grep -o [-0-9a-f]*$ > session
