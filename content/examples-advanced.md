# Triggers, scheduling, and advanced commands

Combine operator inputs, inspect how a command runs, or build a state machine or SysId routine.

Use the trigger example to check the input that requests a command. Use the scheduler trace to see whether the request was queued, started, or canceled. Those are separate events, and the difference is useful when an input looks right but the mechanism never moves.

## Bind buttons and sensors

Configure these bindings once during setup for the intended mode. The arguments are commands built by your robot code. `hasPiece` and `enableOverride` are suppliers that read the current sensor and switch. `CommandGamepad` and `CommandGenericHID` come from `org.wpilib.command3.button`. Import `Seconds` as a static member of `org.wpilib.units.Units`.

At the call site, pass a supplier as a lambda such as `() -> intake.hasGamePiece()` or the equivalent method reference `intake::hasGamePiece`. The trigger’s event loop calls it to read the sensor on each poll.

> **Watch for**
> In Alpha 8, an `onFalse` binding can schedule its command on the first poll if the button starts low. Make the release action safe to run before any press.

```java Commands v3 · Bind and read operator controls
void bindControls(
    BooleanSupplier hasPiece, BooleanSupplier enableOverride,
    Command collect, Command markPiece, Command releaseAction) {
  var gamepad = new CommandGamepad(0);
  var panel = CommandGenericHID.getCommandGenericHID(1);

  gamepad.faceDown().and(enableOverride).whileTrue(collect);
  new Trigger(hasPiece).debounce(Seconds.of(0.05)).onTrue(markPiece);
  panel.button(2).onFalse(releaseAction);
  panel.button(3).multiPress(2, Seconds.of(0.4)).onTrue(markPiece);
}
```

The main face button runs collection while both the button and the override are active. The debounced sensor schedules `markPiece` once when its signal rises. Use `gamepad.getLeftY()` or `panel.getRawAxis(0)` for a numeric input, such as an axis value read inside a drive default.

In a test using the default scheduler, a software input can stand in for hardware. Create `var button = new InternalButton()`, bind `button.onTrue(markPiece)`, then call `button.setPressed(true)` and run a scheduler cycle. Calling `button.setPressed(false)` and running another cycle lets the trigger observe release.

> **WPILib docs**
> [Combining Triggers](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/triggers.html#combining-triggers)
> [Modifying Trigger Behavior](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/triggers.html#modifying-trigger-behavior)

## Schedule and inspect a command

Use this pattern in a desktop test after initializing WPILib simulation. The independent scheduler lets you advance commands one cycle at a time. Use the default scheduler in normal robot setup.

```java Commands v3 · Observe a scheduled command
void traceScheduler() {
  Scheduler scheduler = Scheduler.createIndependentScheduler();
  scheduler.addPeriodic(() -> System.out.println("Scheduler cycle"));
  scheduler.addEventListener(event -> {
    if (event instanceof SchedulerEvent.Interrupted interrupted) {
      System.out.println(interrupted.interrupter().name());
    }
  });

  Command trace = Command.noRequirements(coroutine -> coroutine.yield())
      .whenExited(() -> System.out.println("Trace exited"))
      .named("Scheduler trace");
  if (!scheduler.isSchedulable(trace).successful()) {
    return;
  }
  var result = scheduler.schedule(trace);
  if (result instanceof Scheduler.ScheduleResult.Successful scheduled) {
    System.out.println(scheduled.runId());
    System.out.println(scheduler.isScheduled(trace));
    scheduler.run();
    System.out.println(scheduler.isRunning(trace));
    System.out.println(scheduler.lastRuntimeMs());
    scheduler.cancel(trace);
  }
}
```

The command has no mechanisms and yields on its first run. The first scheduler cycle leaves it paused and active. `cancel(trace)` ends it and runs its exit action without resuming the body. The listener observes interruptions by a competing command. It is separate from the explicit cancellation in this example.

> **Key idea**
> A scheduled command is still in the queue. A running command has started and is still active, including while its coroutine is paused at `yield()`.

> **WPILib docs**
> [Manually Running a Command](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/making-commands-run.html#manually-running-a-command)
> [Scheduler Phases](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/how-it-works.html#scheduler-phases)

## Switch between collection and ready

Put this factory in your shared-actions class. Pass in the [timed collection command](examples-sensor-waits.html#collect-a-game-piece-with-a-time-limit) and a sensor supplier. The machine takes the ready branch only if the collection command finishes with a piece present. An operator abort can exit either state.

```java Commands v3 · Compose a state machine
Command collectThenSignalReady(
    Command collectWithTimeLimit, BooleanSupplier hasPiece, BooleanSupplier abort) {
  var machine = new StateMachine("Collect and signal ready");
  var collecting = machine.addState(collectWithTimeLimit);
  var ready = machine.addState(Command.noRequirements(coroutine -> coroutine.park())
      .named("Wait in ready state"));
  ready.onEnter(() -> System.out.println("Ready"));
  ready.onExit(() -> System.out.println("Leaving ready"));

  collecting.switchTo(ready).whenCompleteAnd(hasPiece);
  collecting.exitStateMachine().whenComplete();
  machine.switchFromAny().toExitStateMachine().when(abort);
  machine.setInitialState(collecting);
  return machine;
}
```

At collection completion, `whenCompleteAnd(hasPiece)` gets first chance to choose the ready state. If the condition is false, `whenComplete()` exits the machine. The global abort rule is added after all the states. The state callbacks report readiness, and the intake command’s own `whenExited` stops the roller.

When collection succeeds, the intake command has already exited and released the intake. The ready command parks with no requirements, so the machine can wait for the abort input without reserving the intake.

> **WPILib docs**
> [State Machine Transitions](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/state-machines.html#transitions)

## Build SysId test commands

In your mechanism class, provide `setVoltage(Voltage)` to apply the test output and `logSysId(SysIdRoutineLog)` to record the mechanism’s measurements. Import `SysIdRoutine` from `org.wpilib.command3.sysid`.

```java Commands v3 · Configure a SysId routine
SysIdRoutine createSysIdRoutine() {
  return new SysIdRoutine(
      SysIdRoutine.Config.defaults(),
      new SysIdRoutine.SysIdMechanism(this::setVoltage, this::logSysId, this));
}
```

Call `routine.quasistatic(SysIdRoutine.Direction.FORWARD)` or pass `REVERSE` for the voltage ramp in the opposite direction. Use `routine.dynamic(...)` in both directions for the step-voltage tests. Each call builds a command that reserves the mechanism supplied to the routine. Use `SysIdRoutine.Config.useDataLog(rampRate, stepVoltage, timeout)` to customize the test values while retaining the standard state logging.

> **WPILib docs**
> [Creating an Identification Routine](https://docs.wpilib.org/en/latest/docs/software/advanced-controls/system-identification/creating-routine.html)
