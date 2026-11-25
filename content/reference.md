# Commands v2 method lookup

Find the v3 equivalent of a v2 method. The index is sorted by the first method in each entry. If you already know the v3 name, use the [v3 method lookup](v3-reference.html).

## A–H {#a-h}

- **`addRequirements`** — Call `this.run(...)` inside a mechanism to require that mechanism. Use `Command.requiring(...)` when listing requirements explicitly. [See where the intake requirement comes from](intake.html#translate-the-intent).
- **`asProxy` / `ProxyCommand`** — Let each child require its mechanism only while it runs. [Compare a v2 proxy sequence with v3 await](examples-command-groups.html#give-a-child-its-mechanism-only-while-it-runs).
- **`deadline`** — A deadline child determines when the group finishes. The group needs the mechanisms required by all its children. [Keep drive stopped during a pause](examples-command-groups.html#keep-the-drivetrain-stopped-during-an-autonomous-pause).
- **`defer` / `DeferredCommand`** — Call the factory inside the coroutine body to build the child from the robot’s state at that point. [Build a command from the current pose](examples-command-groups.html#build-a-command-from-the-robot-s-current-state).
- **`deferredProxy`** — Build the child when you reach the stage and let it acquire its own requirement. [Combine deferred construction and child requirements](examples-command-groups.html#build-a-child-later-and-reserve-its-mechanism-only-then).
- **`either` / `select`** — Use an `if` or `switch` inside a coroutine to make a choice while the command runs. [See a retry loop and route decision](examples-sensor-waits.html#retry-a-pickup-and-choose-a-route).
- **`end` / `finallyDo`** — Use `whenExited` for cleanup whenever the command ends and `whenCanceled` for cancellation-only work. [Follow an intake command through cancellation](intake.html#follow-the-command).

## I–R {#i-r}

- **`initialize` / `execute` / `isFinished`** — Put setup at the start of the body, repeating work in a loop that pauses each cycle, and completion at the return. [Follow an intake command from start to finish](intake.html#follow-the-command).
- **`parallel`** — Use `Command.parallel(...)` or `awaitAll(...)` to wait for all children to finish. [See two actions run together](ownership.html#prepare-two-independent-mechanisms-together) · [WPILib parallel examples](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/migration-guide.html#parallel-work).
- **`periodic`** — Call required sensor updates from the robot loop. [See where to move periodic updates](changes.html#move-periodic-work-and-check-disabled-behavior).
- **`race`** — Use `Command.race(...)` or `awaitAny(...)` to continue after the first child finishes and cancel the remaining children. [Race a sensor against a timer](ownership.html#race-a-sensor-against-a-timeout) · [WPILib race examples](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/migration-guide.html#race-work).
- **`run` / `runOnce` / `runEnd`** — Use `runRepeatedly` for work every cycle or a `run` body that returns immediately for a one-time action. Use `whenExited` to stop an output when needed. [See a repeating drive stop](examples-command-groups.html#keep-the-drivetrain-stopped-during-an-autonomous-pause).

## S–W {#s-w}

- **`sequence`** — Use a native sequence for a fixed order that keeps its combined requirements. A coordinating coroutine can await each child and let that child control its own mechanisms. [Decide when to use a group or a coroutine](ownership.html#choose-a-group-or-a-coroutine).
- **`setDefaultCommand`** — Decide where the default should be active and what priority it should have. [See joystick drive and alignment](changes.html#set-priorities-and-defaults) · [WPILib section on default commands](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/making-commands-run.html#default-commands).
- **`startEnd`** — Start the action, pause the command as needed, and use `whenExited` to stop the action when the command ends. [Compare the two intake classes](intake.html#translate-the-intent).
- **`until` / `waitUntil` / `waitSeconds` / `withTimeout`** — Decide which condition or duration ends the work and what happens when time runs out. [Collect with a time limit](examples-sensor-waits.html#collect-a-game-piece-with-a-time-limit).
- **`whileTrue`** — Check press, completion while held, and release. A retry binding can restart the command while the button stays held. [Run a roller while a button is held](examples-operator-controls.html#run-a-roller-while-a-button-is-held).
- **`withInterruptBehavior`** — Use command priorities to decide which action can take over. [See priority and default behavior](changes.html#set-priorities-and-defaults).
- **`withName`** — Finish a v3 builder with `.named(...)`. [See the difference between a builder and a command](changes.html#finish-building-and-name-the-command).

> **WPILib docs**
> [Migrating from Commands v2](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/migration-guide.html)
