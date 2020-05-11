const { scrollableContent, tag, unpackedContent, writeScriptSource } = require('./helpers.js');
const { atom, column, cons, emptyList, indent, label, row, sizeHeight, sizeWidth, vindent } = require('terminal');

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
