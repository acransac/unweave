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
