# Sensor waits and retries

Use a sensor to finish an action, set a time limit, and decide whether to try again.

For the basic pattern, see [stop the intake after a sensor wait](intake.html#translate-the-intent). To time out an existing child command, see [race a sensor against a timer](ownership.html#race-a-sensor-against-a-timeout).

## Collect a game piece with a time limit

**Problem.** Autonomous needs to continue if the sensor stays clear, and you want to record that collection timed out.

**Where this goes.** Put this method in `PracticeIntake` from the first lesson. Add a `reportIntakeTimeout()` method on that class that records a timeout in your robot’s log or dashboard.

```java Commands v3
Command collectWithTimeLimit() {
  return this.run(
          coroutine -> {
            setRoller(0.6);
            var result =
                coroutine.waitUntil(this::hasGamePiece, Seconds.of(2.0));
            if (result.timedOut()) {
              reportIntakeTimeout();
            }
          })
      .whenExited(this::stop)
      .named("Collect with time limit");
}
```

Import `Seconds` as a static member of `org.wpilib.units.Units`. A successful sensor read skips the report. A timeout runs the report. All exit paths call `stop()` through `whenExited`.

> **Key idea**
> A timed `waitUntil` returns a result the same command can act on. If another command interrupts the intake while it waits, the body never reaches the timeout report.

Test with the sensor already active, with the sensor going active during the wait, and with the sensor staying clear until timeout. In the first case, the code still calls `setRoller(0.6)` before checking the sensor, and the wait returns immediately. If collection should leave the roller alone when it starts with a piece, check the sensor before requesting roller output. Also cancel during the wait and confirm the roller stops without reporting a timeout.

[See the intake class and its helper methods](intake.html#translate-the-intent)

> **WPILib docs**
> [Timeouts and WaitResult](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/creating-commands.html#timeouts-and-waitresult)

## Retry a pickup and choose a route

**Problem.** Try to collect a game piece. If the first attempt times out, move to a second pickup position and try once more. Drive to score if you have a piece. Drive to a safe position if both attempts end with the sensor clear.

**Where this goes.** Put `collectThenChooseRoute` in your autonomous or shared-actions class. It uses the [timed intake command](#collect-a-game-piece-with-a-time-limit). Make the intake’s read-only `hasGamePiece()` method accessible to this class. Each drive method returns a command that requires only drive and finishes when it reaches its destination. Each intake attempt requires only the intake.

```java Commands v3
Command collectThenChooseRoute(Drive drive, PracticeIntake intake) {
  return Command.noRequirements(
          coroutine -> {
            boolean hasPiece = intake.hasGamePiece();
            for (int attempt = 1; attempt <= 2 && !hasPiece; attempt++) {
              coroutine.await(intake.collectWithTimeLimit());
              hasPiece = intake.hasGamePiece();
              if (!hasPiece && attempt == 1) {
                coroutine.await(drive.moveToSecondPickup());
              }
            }

            if (hasPiece) {
              coroutine.await(drive.moveToScoringPosition());
            } else {
              coroutine.await(drive.moveToSafePosition());
            }
          })
      .named("Collect then choose a route");
}
```

| Java in the command body | What it decides |
| --- | --- |
| `boolean hasPiece` | Keeps the latest sensor reading for this run. |
| `for` | Allows at most two collection attempts. A piece already present skips collection. |
| `if (!hasPiece && attempt == 1)` | Drives to the second pickup only after an unsuccessful first attempt. |
| `if (hasPiece) ... else ...` | Chooses the scoring or fallback route using the latest reading. |

In v2 you could assemble a sequence with conditional commands and lay out each attempt as a separate stage. Here the sensor read and retry loop live inside the lambda passed to `noRequirements`. That puts both in the scheduled run. Each `await` pauses the parent while the scheduler runs the child, preserving `attempt` and `hasPiece` until the body resumes. When that child finishes, it releases its requirement. If the parent is canceled during a pickup, the active child is canceled and the routine skips the remaining Java statements. [See how requirements change during a routine](ownership.html).
