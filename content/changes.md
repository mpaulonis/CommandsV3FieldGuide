# Migrating from Commands v2

Use these checks when porting a v2 robot or diagnosing behavior that changed after a port. The details are for WPILib 2027 Alpha 8.

## The builder does not compile {#finish-building-and-name-the-command}

> **Key idea**
> A builder holds the command’s settings. Calling `.named(...)` finishes it so the result can be scheduled or bound to a button.

In v2, a factory such as `Commands.runOnce(...)` returns a command and `withName(...)` is optional. In v3, factories such as `Command.noRequirements(...)`, `this.run(...)`, and `this.runRepeatedly(...)` return builders.

```java Commands v2
Command announceReady() {
  return Commands.runOnce(() -> System.out.println("Ready"));
}
```
```java Commands v3
Command announceReady() {
  return Command.noRequirements(coroutine -> System.out.println("Ready"))
      .named("Announce ready");
}
```

If you delete `.named("Announce ready")`, Java reports that `NeedsNameBuilderStage` cannot be converted to `Command`. With `var`, the assignment can compile because the variable holds the builder. The error then appears where you pass it to something that expects a `Command`.

Both versions pass the print statement as a lambda to run later. The v2 lambda takes zero inputs. The v3 body takes a `Coroutine` input and returns as soon as the print finishes. A body can use the same input to pause if it has more work to do later. [Trace a body that yields](coroutines.html#trace-a-pause-and-resume).

Apply settings such as `.withPriority(...)` and `.whenExited(...)` before `.named(...)`. If another method already returns a `Command`, change the name in the factory that builds it. A finished `Command` exposes `name()` to read the existing name. Some group builders also offer `.withAutomaticName()`. In a log or scheduler view, a name like “Align to pickup marker” helps you identify which action is running.

**One wrapper detail worth checking.** In Alpha 8, `command.until(condition)` returns a group builder that needs a name or an automatic name. `command.withTimeout(Seconds.of(2.0))` returns an already named command and takes a typed duration. Both calls wrap an existing command.

> **WPILib docs**
> [One-Shot Commands](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/creating-commands.html#one-shot-commands)

## Code or a held button runs only once {#choose-when-to-run-code-again}

v2 `run(action)` repeats the action. In v3, use `runRepeatedly(action)` for that intent. A v3 `run(coroutine -> action())` body with no pause runs the action once and returns. A loop in a coroutine can keep its own local counter or state across calls to `yield()`, which is useful when the repeated work has more than one step. [Trace a command through a pause](coroutines.html#trace-a-pause-and-resume) and [see where to put the pause in a loop](coroutines.html#put-yield-where-the-loop-repeats).

For buttons, both versions have `whileTrue`. A command that finishes while the button stays held will wait for another press. v3 adds `retryWhileTrue` for an action that should be retried while held. Try the thought experiment with a short intake pulse. Holding the button gives one pulse with `whileTrue`, and repeated pulses with `retryWhileTrue`. In Alpha 8, a trigger’s first observed low value can fire `onFalse`. Write release actions so they make sense even before the first press.

> **WPILib docs**
> [Continuous/Retry Bindings](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/triggers.html#continuous-retry-bindings)

## Cleanup or timeout handling gets skipped {#handle-completion-timeout-and-cancellation}

In v2, `end(boolean interrupted)` lets you choose cleanup based on how a command ended. In v3, register `whenExited` for work that must happen after a started command ends either way. Register `whenCanceled` for cancellation-only work. For example, stop the intake on every exit and record a cancellation only if the scheduler canceled it. In Alpha 8, a canceled coroutine can be dropped at its pause point, skipping code after the wait and any Java `finally` block in its body. [Follow the intake through cancellation](intake.html#follow-the-command).

For a routine that needs to handle a timeout, `coroutine.waitUntil(condition, duration)` returns a result. A Java `if` can decide what to do with that result in the same command. For example, report when a piece was never detected, then move on. [See the timed intake example](examples-sensor-waits.html#collect-a-game-piece-with-a-time-limit).

## A command cannot take over a mechanism {#set-priorities-and-defaults}

v2 expresses interruption with `kCancelSelf` and `kCancelIncoming`. v3 compares priorities when two ordinary commands need the same mechanism. An incoming command can interrupt an equal- or lower-priority command. A lower-priority request is rejected.

> **Watch for**
> Two commands at `HIGHEST_PRIORITY` can still interrupt each other. When porting `kCancelIncoming`, check which other commands can request the same mechanism at that priority.

A default command must require exactly the mechanism it belongs to. Give a joystick default a priority below ordinary drive commands so an alignment command can take over. This method belongs on a `Drive` class that implements `Mechanism`. Its `arcadeDrive` method sends the requested motion. `DoubleSupplier` comes from `java.util.function`.

```java Commands v3
Command joystickDrive(DoubleSupplier forward, DoubleSupplier turn) {
  return this.runRepeatedly(
          () -> arcadeDrive(forward.getAsDouble(), turn.getAsDouble()))
      .withPriority(Command.LOWEST_PRIORITY)
      .named("Joystick drive");
}
```

Install the result with `drive.setDefaultCommand(...)` in the intended setup code. The scheduler starts it when drive is free. If an alignment command takes drive, the default can return after alignment ends when drive is free again and the default is still in effect.

> **WPILib docs**
> [Priorities](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/migration-guide.html#priorities)
> [Default Commands](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/making-commands-run.html#default-commands)

## A default disappears or a routine ends early {#tie-work-to-the-right-lifetime}

A **scope** tells the scheduler how long a command, binding, or default should stay in effect. In a robot using OpModes, put Teleop-only bindings and defaults in Teleop setup. Place the joystick default outside a running command when you want it to last for the mode. A default installed inside a running command belongs to that command’s scope. In Alpha 8, interrupting that default can cancel the parent and remove the binding you expected to reuse.

Child commands give you a way to keep requirements local to each action. If you await a drive child and then an elevator child, the drive requirement can be released before the whole routine ends. A sequence group keeps both requirements for the whole run. In Alpha 8, if a higher-priority command prevents a child from starting, the parent cancels by default and skips later steps. [Compare the two ownership patterns](ownership.html).

> **WPILib docs**
> [The OpMode Scope](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/scopes.html#the-opmode-scope)

## Periodic updates or disabled actions stop running {#move-periodic-work-and-check-disabled-behavior}

A v2 subsystem’s `periodic()` is called by the scheduler. A v3 `Mechanism` has no equivalent automatic method. If the robot needs fresh sensor readings each cycle, arrange to call your update method from the robot’s periodic loop, for example before the scheduler runs. A default command is for work the mechanism should do when free. It can be interrupted, so updates that must always happen need their own place in the robot loop.

In Alpha 8, mechanisms are unavailable during disabled by default. A command with no requirements can run while disabled if its trigger or scheduling scope allows it. Use that for work such as reporting status. A command that controls a motor should still declare that mechanism.

[Method lookup](reference.html)

> **WPILib docs**
> [Migrating from Commands v2](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/migration-guide.html)
