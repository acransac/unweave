# Introduction
**unweave** is a terminal interface to Google's V8 Inspector for Node.js applications. It aims to provide a comfortable debugging experience when no graphical display is available.

Below is a screen capture of a debug session with **unweave**:
![Alt text](doc/screen_capture_1.png?raw=true)

As shown above, **unweave** provides essential information to analyze a piece of running software:
* scrollable script source (_script source_ window, top left above)
* variables in scope with their types and values (_environment_ window, top right above)
* explorable directory of the sources of all imported modules (_workspace_ inactive tab, top right above)
* customizable log which also alerts about any errors **unweave** might have encountered (_messages_ window, center right above)
* available actions in any state **unweave** might be (_instructions_ window, bottom above)
* user defined queries to Inspector (_query Inspector_ inactive tab, bottom above)
* breakpoint placement (_add breakpoint_ inactive tab, bottom above)

# Installation
**unweave** is delivered as a npm package and is more convenient to use if installed globally:

```shell
    $ npm install --global unweave
```

An operation which can be reverted with:

```shell
    $ npm uninstall --global unweave
```

Alternatively, **unweave** can be added to a npm project with local visibility only, for example to help with debugging during development:

```shell
    $ npm install --save-dev unweave
```

And inversely:

```shell
    $ npm uninstall --save-dev unweave
```

Both of the last two commands are executed in the npm project's root directory.

**unweave** requires Node.js version 12.0.0 or greater to work, and tests require Node.js version 12.9.0 at least to run. It works as designed on Linux, with a few caveats on Windows (cmd.exe and Powershell) and hasn't been tested on macOS. It doesn't workon Windows with MSYS2 or Mingw64 and hasn't been tested with Cygwin. Tests only run on Linux.

# Usage
## Start
**unweave** can either start the Inspector session, connect to it and set it up or attach to an existing session. The first approach requires to point to the script to debug:

```shell
    $ unweave example.js
```

or with a local install, in the project's directory:

```shell
    $ npx unweave example.js
```

The second approach has two steps. Firstly, Inspector is started with the target script. Secondly, **unweave** is run with the Inspector session's hash as argument, and if necessary with its address or port (the latter default to localhost and 9229, which are Inspector's defaults):

```shell
    $ node --inspect-brk example.js
    Debugger listening on ws://127.0.0.1:9229/e21bc327-68e0-4d87-a470-b5f9640e22dc
    For help, see: https://nodejs.org/en/docs/inspector
```

And then:

```shell
    $ unweave --session e21bc327-68e0-4d87-a470-b5f9640e22dc
```

Or again with all possible options:

```shell
    $ unweave --address 127.0.0.1 --port 9229 --session e21bc327-68e0-4d87-a470-b5f9640e22dc
```

Or in short form:

```shell
    $ unweave -a 127.0.0.1 -p 9229 -s e21bc327-68e0-4d87-a470-b5f9640e22dc
```

If this is a local install, replace `unweave` with `npx unweave` above.

## Interact
**unweave** is modal, which means that a thematic set of actions is available after a mode is activated and until it is superseded by another one. Available modes correspond to the windows and tabs on the screen whose titles show an highlighted character that is the activating key. Once a mode is activated, the possible actions are listed in the _instructions_ window at the bottom of the screen, one of which terminates the mode and focuses back on the default _script source_ mode. In any state, the active mode's window title is entirely highlighted.

The modes are:
| Mode            | Activating Key | Terminating Key | Special Behaviour                                                |
|-----------------|----------------|-----------------|------------------------------------------------------------------|
| script source   | None           | Ctrl+C          | Activated first and when any other mode terminates. Terminating this mode closes **unweave** |
| environment     | e              | Enter           | None                                                             |
| workspace       | w              | Enter           | Terminating this mode displays the source of the selected script |
| messages        | m              | Enter           | None                                                             |
| query Inspector | q              | Enter           | Hides the instructions and captures all subsequent inputs with backspace erasing recorded characters. Terminating this mode sends the typed query to Inspector. The query has the form `MethodName ParametersObject`, such as for example `Debugger.continueToLocation {scriptId: \"50\", lineNumber: 3}`. See the Inspector protocol |
| add breakpoint  | b              | Enter           | Hides the instructions and captures all subsequent inputs with backspace erasing recorded characters. Terminating this mode sets a breakpoint on the displayed script at the line whose number is typed |
