# Operator controls and repeating actions

Tie manual control to a button and decide what should happen if the command ends while the operator is still holding it.

For scheduler and control-loop examples, see [keep other commands running during a loop](coroutines.html#put-yield-where-the-loop-repeats) and [let alignment take over from joystick drive](changes.html#set-priorities-and-defaults).

## Run a roller while a button is held

**Problem.** The operator needs to run the intake manually. Releasing the button should stop it.

**Where this goes.** Add `runRoller()` to the intake class in the framework you are using. It uses that class’s `setRoller` and `stop` methods from the first lesson.

```java Commands v2
Command runRoller() {
  return this.startEnd(() -> setRoller(0.6), this::stop)
      .withName("Run intake roller");
}
```
```java Commands v3
Command runRoller() {
  return this.run(
          coroutine -> {
            setRoller(0.6);
            coroutine.park();
          })
      .whenExited(this::stop)
      .named("Run intake roller");
}
```

Where you set up driver controls, bind an intake button with `intakeButton.whileTrue(intake.runRoller())`. Here `intakeButton` is the trigger for the chosen button and `intake` is your intake object. Pressing schedules the command, and releasing cancels it. `park()` keeps the command waiting until cancellation, so it retains control of the intake and the exit calls `stop()`. This pattern assumes the roller controller keeps its last requested output. If the action needs to be recalculated each scheduler cycle, use `runRepeatedly`.

## Choose a binding for a held button

With the binding above, press the button, keep holding it, and let another command interrupt the roller. `whenExited` stops the roller on interruption. The same hold makes no new schedule request. Release the button and press again to let `whileTrue` schedule the roller again.

For a short command that should keep trying while held, bind it with `intakeButton.retryWhileTrue(intakePulse)`, where `intakePulse` is a command that can finish on its own. Both bindings cancel their command on release. The difference shows up if the command finishes or is interrupted before release.

| Test while holding the button | `whileTrue` | `retryWhileTrue` |
| --- | --- | --- |
| The short command finishes | Waits for another press. | Attempts to start it again. |
| Another command takes the intake | Waits for another press. | Keeps attempting to schedule. The scheduler still applies priority and requirements. |
| The operator releases the button | Cancels the command if it is active. | Cancels the command if it is active and stops retrying. |

Pick the behavior you want after an interruption. For example, waiting for a fresh press gives the operator an explicit way to restart a manual action after an automatic routine takes over.

> **WPILib docs**
> [State-Based Bindings](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/triggers.html#state-based-bindings)
> [Continuous/Retry Bindings](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/triggers.html#continuous-retry-bindings)

[See how to combine a button with a sensor or switch](examples-advanced.html#bind-buttons-and-sensors).
