// Copyright (c) Adrien Cransac
// License: MIT

const { scrollableContent, tag, unpackedContent, writeScriptSource } = require('./helpers.js');
const { atom, column, cons, emptyList, indent, label, row, sizeHeight, sizeWidth, vindent } = require('@acransac/terminal');

/*
 * The template of a debug session's display with developer-friendly features such as an error log and custom Inspector queries
 * @param {Component} source - A component yielding the displayed script's source
 * @param {Component} runLocation - A component yielding the execution location
 * @param {Component} breakpoints - A component yielding an array of active breakpoints
 * @param {Component} displayedScript - A component yielding the id of the displayed script
 * @param {Component} topRightColumnDisplay - A component yielding the tabulated display of either the source tree or the environment tree
 * @param {Component} environmentTree - A component yielding the environment tree
 * @param {Component} messages - A component yielding the error log and custom log
 * @param {Component} sourceTree - A component yielding the source tree
 * @param {Component} command - A component yielding the tabulated display of either the instructions, the query capture or the breakpoint capture
 * @param {Component} instructions - A component yielding the instructions applying to the active mode
 * @param {Component} queryCapture - A component yielding the query capture
 * @param {Component} breakpointCapture - A component yielding the breakpoint capture
 * @return {Display}
 */
function developerDisplay(source,
                          runLocation,
                          breakpoints,
                          displayedScript,
                          topRightColumnDisplay,
                          environmentTree,
                          messages,
                          sourceTree,
                          command,
                          instructions,
                          queryCapture,
                          breakpointCapture) {
  return cons(
           cons(
             sizeWidth(50, label(atom(writeScriptSource(unpackedContent(source), runLocation, breakpoints, displayedScript)),
                                 tag(source))),
             cons(
               cons(
                 topRightColumnDisplay(environmentTree, sourceTree),
                 cons(
                   vindent(50, sizeHeight(50, label(atom(scrollableContent(unpackedContent(messages))), tag(messages)))),
                   indent(50, column(50)))),
               row(90))),
           cons(
             cons(
               command(instructions, queryCapture, breakpointCapture),
               vindent(90, row(10))),
             emptyList()));
}

module.exports = { developerDisplay };
