# Translate an intake command

Compare the same sensor-driven intake in v2 and v3. Follow the roller output through the sensor wait, normal completion, and cancellation.

## Compare the v2 and v3 code {#translate-the-intent}

Both commands live inside the intake class. The three robot-specific helpers below each command show where the motor and sensor code belongs.

```java Commands v2
class PracticeIntake extends SubsystemBase {
  Command collectUntilDetected() {
    return this.startEnd(() -> setRoller(0.6), this::stop)
        .until(this::hasGamePiece)
        .withName("Collect until detected");
  }

  private void setRoller(double output) {
    // Motor control omitted.
  }

  private void stop() {
    // Roller stop logic omitted.
  }

  private boolean hasGamePiece() {
    // Sensor reading omitted.
  }
}
```
```java Commands v3
class PracticeIntake implements Mechanism {
  Command collectUntilDetected() {
    return this.run(
            coroutine -> {
              setRoller(0.6);
              coroutine.waitUntil(this::hasGamePiece);
            })
        .whenExited(this::stop)
        .named("Collect until detected");
  }

  private void setRoller(double output) {
    // Motor control omitted.
  }

  private void stop() {
    // Roller stop logic omitted.
  }

  private boolean hasGamePiece() {
    // Sensor reading omitted.
  }
}
```

**Where the requirement comes from.** In `this.run(...)`, `this` means the intake object. The `run` method comes from `Mechanism` and adds that object as a requirement. The v2 call to `this.startEnd(...)` does the same for the subsystem. The scheduler uses that requirement to resolve conflicts when another command also needs to control the intake.

**Read the body and its callbacks.** The v2 lambda `() -> setRoller(0.6)` gives `startEnd` its start action. In v3, the lambda passed to `this.run(...)` sets the roller output and calls `waitUntil`. The method reference `this::hasGamePiece` is another way to write `() -> hasGamePiece()`. It lets WPILib check the sensor when it needs the value. Likewise, `this::stop` supplies the same cleanup action as `() -> stop()`. WPILib calls it when the started v3 command exits. [See how the scheduler calls a command body and an exit lambda](coroutines.html#trace-a-pause-and-resume).

**Why the last line matters.** Naming is optional in the v2 version. In the v3 version, the last line finishes building the command. [See the compile error and the fix](changes.html#finish-building-and-name-the-command).

## Trace completion and cancellation {#follow-the-command}

> **Watch for**
> Cancellation while the command is waiting skips the code after `waitUntil`. Put the motor stop in `whenExited` so it runs on both normal completion and cancellation.

1. **Start.** The command takes control of the intake and requests a roller output of 0.6.
2. **Wait.** With the sensor clear, `waitUntil` pauses the command and lets the scheduler run other commands. This command still controls the intake.
3. **Finish.** The sensor detects a piece, so the command resumes and returns. `whenExited` calls `stop()`.
4. **Cancel during the wait.** The command never resumes past `waitUntil`. The scheduler still calls `stop()` through `whenExited`. In WPILib 2027 Alpha 8, cancellation also skips any Java `finally` block inside the paused command body.

Releasing the intake requirement and sending a stop request are separate actions. Without the exit action, a cancellation in this example would leave the last roller request in place.

> **WPILib docs**
> [How Commands Use Lambda Functions](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/lambda-functions.html#how-commands-use-lambda-functions)
> [Mechanism Commands](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/mechanisms.html#mechanism-commands)

[Add a timeout and handle the result](examples-sensor-waits.html#collect-a-game-piece-with-a-time-limit)
