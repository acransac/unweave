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

# Walkthrough
Let's walk through an example debugging session with **unweave**. Consider the following script `example.js` that you can find in the `doc` directory:

```javascript
    const { multiplyBy } = require('./imports.js');

    if (multiplyBy(2)(3) === 6) {
      console.log("Success");
    }
    else {
      console.log("Failure");
    }
```

```shell
    $ node doc/example.js
    Failure
```

It seems that `multiplyBy` is not doing what is expected. Let's check this with **unweave**:

```shell
    $ unweave doc/example.js
```

![Alt text](doc/screen_capture_2.png?raw=true)

Notice that the window title _script source_ is highlighted: this is the active mode. At the bottom of the screen are the possible actions in this mode. Try to scroll down and up with "j" and "k".

Note also in the _environment_ tab the presence of the `multiplyBy` variable which is imported. It is reported as undefined. Indeed, the execution is paused before the import logic at the first line of the script as can be seen with the arrow in the _script source_ window. Step through with "n" until the execution reaches the if statement. Take note of the updated type of `multiplyBy`: this is a function and we want to check it.

To do so, we switch to the _workspace_ mode to explore the script sources. We see that the _workspace_ tab has "w" highlighted in its title. This is the key to activate this mode, let's press it:

![Alt text](doc/screen_capture_3.png?raw=true)

_workspace_ is now highlighted and the instructions have changed. We want to take a look at `imports.js` so we select the next entry ("j") and validate the selection ("Enter"):

![Alt text](doc/screen_capture_4.png?raw=true)

By typing enter, we produced the display of `imports.js` and terminated the _workspace_ mode, switching back to _script source_.
Let's place a breakpoint in `multiplyBy` by activating the _add breakoint_ mode ("b"). From now on, everything we type is displayed in the _add breakpoint_ tab. Type a few characters and delete them with "backspace". Then type "1" and press "enter", effectively placing a breakpoint at line 1 in `imports.js` and leaving the mode back to the default _script source_. Notice a star appeared on the script source, marking a breakpoint. Let's continue the execution ("c"):

![Alt text](doc/screen_capture_5.png?raw=true)

The run continued freely but eventually hit the breakpoint in `multiplyBy` and the arrow marking the execution joined the star in the script source display. Check the environment to see the value of the parameters `n` and `transform`. Note also that "transform" is highlighted in the source. This marks the next expression to be evaluated. It is a ternary operator and we can already guess that `successor` will be called as `transform` is reported undefined in the environment. Let's make sure of this by stepping into the next function call with "s":

![Alt text](doc/screen_capture_6.png?raw=true)

The execution expectedly reached the `successor` function, `n` equals 2 but the function returns `n + 1`. Step over until you are back into `multiplyBy`'s scope. Take a look at the environment and see that `multiplicator` which is part of the returned function's closure equals 3. Step out ("f") of `multiplyBy` to get back to the main function:

![Alt text](doc/screen_capture_7.png?raw=true)

Now the situation is clear: `multiplyBy` accepts a second argument which is a function to transform its first input and returns a multiplicator by the transformed value. Counter-intuitively, this second argument is not defaulted to the identity function but to the successor function. So `multiplyBy(2)(3)` equals 3 * 3, that is 9 and not 6. Step once to verify that the execution branches into the else clause. Finally, finish your session by typing "ctrl+c".

We can now fix our code. The new `example.js` is:

```javascript
    const { multiplyBy } = require('./imports.js');

    if (multiplyBy(2, n => n)(3) === 6) {
      console.log("Success");
    }
    else {
      console.log("Failure");
    }
```

```shell
    $ node doc/example.js
    Success
```
