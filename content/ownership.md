# Coordinate mechanisms

Choose how to put commands together by asking what must finish before the next step and which mechanisms the routine must reserve along the way.

## Choose a group or a coroutine

Commands v3 kept the part of v2’s command-building language that describes simple groups. If you already read `Commands.sequence(a, b)` as “run a, then b,” you can read a v3 sequence the same way. Coroutines add a way to express the routine in Java when it needs to make decisions or change which mechanisms it reserves.

| What you want | Familiar v2 form | v3 group builder |
| --- | --- | --- |
| Run stages in order | `Commands.sequence(a, b)` or `a.andThen(b)` | `Command.sequence(a, b)` or `a.andThen(b)` gives a `SequentialGroupBuilder`. |
| Start together and wait for both | `Commands.parallel(a, b)` or `a.alongWith(b)` | `Command.parallel(a, b)` or `a.alongWith(b)` gives a `ParallelGroupBuilder`. |
| Start together and finish when the first finishes | `Commands.race(a, b)` or `a.raceWith(b)` | `Command.race(a, b)` or `a.raceWith(b)` gives a `ParallelGroupBuilder` with race behavior. |

Finish the builder with `.named(...)` to get a command. A v3 `ParallelGroupBuilder` can also designate which children must finish, such as a timer in the [autonomous pause example](examples-command-groups.html#keep-the-drivetrain-stopped-during-an-autonomous-pause).

> **Key idea**
> Make two decisions when you compose a routine. Choose what must finish before the next step, and choose which mechanisms must stay reserved between steps.

A fixed group lists actions and reserves all of its children’s requirements for the life of the group. That is useful when a separate command taking over an idle mechanism would disrupt the routine. Check that every mechanism has the output you intend while it is reserved.

A coroutine helps when the next action depends on a sensor, a timeout, or a retry count. It also helps with a fixed list of steps if only the active child should reserve its mechanism. A parent with no requirements can `await` each child and let it release its mechanism when it finishes. Decide whether you want a conflict to be checked up front against the whole group or later when a particular child is reached.

[Compare the same two stages below](#move-the-drivetrain-then-position-the-elevator) · [Use both styles in one routine](#use-a-group-inside-a-coroutine)

> **WPILib docs**
> [Command Groups and Coroutine Composition](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/migration-guide.html#command-groups-and-coroutine-composition)

## Move the drivetrain, then position the elevator

Suppose a routine drives to a pickup marker and then lowers the elevator to pickup height. Put these factories in your autonomous or shared-actions class. They receive your existing `Drive` and `Elevator` objects. Both implement `Mechanism`.

- `drive.moveToPickupMarker()` returns a command that requires drive, finishes when aligned, and stops drive when it ends.
- `elevator.moveToPickupHeight()` returns a command that requires the elevator and finishes when the elevator reaches the requested height. The factory creates the command. The action happens when the scheduler runs it.

```java v3 sequence
Command pickupWithReservedMechanisms(Drive drive, Elevator elevator) {
  return Command.sequence(
          drive.moveToPickupMarker(),
          elevator.moveToPickupHeight())
      .named("Pickup setup with reserved mechanisms");
}
```
```java v3 coroutine
Command pickupWithChildRequirements(Drive drive, Elevator elevator) {
  return Command.noRequirements(
          coroutine -> {
            coroutine.await(drive.moveToPickupMarker());
            coroutine.await(elevator.moveToPickupHeight());
          })
      .named("Pickup setup with child requirements");
}
```

Both versions drive first and then move the elevator. The calls to the child factories in `Command.sequence(...)` happen when you build the routine. The calls in the coroutine version sit inside the lambda. The first factory runs when that body starts, and the second runs when the body resumes after the first `await`. The timeline below shows when other commands can use each mechanism.

**The parent coordinates the work.** The coroutine uses `Command.noRequirements(...)` because the parent leaves the hardware actions to the children. Each `await` starts a child that has its own requirement. Pausing never releases a requirement declared on the parent itself. A requirement lasts until the command that declared it ends.

| Stage | Sequence group | Coroutine with child requirements |
| --- | --- | --- |
| Driving to the pickup marker | Group reserves drive and elevator. | Drive child requires drive. Elevator is available. |
| Moving the elevator | Group still reserves drive and elevator. | Elevator child requires elevator. Drive is available again. |
| Routine ends | Group releases both mechanisms. | The final child releases the elevator when it ends. The parent reserves neither mechanism. |

**Decide what can run during each stage.** If the chassis must keep its position while the elevator moves, reserve drive across both stages and make sure your drive code requests the intended hold or stop. A requirement alone sends no motor output. If a separate command can safely control drive during the elevator move, the coroutine makes drive available when the drive child finishes.

**Decide what happens on cancellation.** If the parent is canceled during the drive stage, its drive child is canceled and the elevator stage never starts. Put motor cleanup in the child’s `whenExited`. With the default Alpha 8 settings, the parent is canceled if a child cannot start. For example, a higher-priority command might already control the elevator.

## Prepare two independent mechanisms together

Use `awaitAll` when two actions can happen at the same time and both need to finish. Here `Intake.deploy()` requires the intake and finishes when it is down. `StatusLights.showCollectingForTwoSeconds()` requires the lights, shows a collecting pattern for two seconds, and restores the usual pattern through `whenExited`. Both are command factories on their own mechanism classes.

```java v3 coroutine
Command prepareToCollect(Intake intake, StatusLights lights) {
  return Command.noRequirements(
          coroutine -> {
            coroutine.awaitAll(
                intake.deploy(),
                lights.showCollectingForTwoSeconds());
          })
      .named("Prepare to collect");
}
```

If the intake finishes first, it becomes available while the lights are still running. The parent waits for both children before it returns. A `Command.parallel(...)` group also waits for both and reserves both mechanisms until the group finishes.

> **WPILib docs**
> [Parallel Work](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/migration-guide.html#parallel-work)

## Use a group inside a coroutine

A routine can use a group for one stage and Java for the decision that follows. Put this example in a shared-actions or autonomous class. Here `Intake` provides `deploy()`, a read-only `hasGamePiece()`, and the [timed collection command](examples-sensor-waits.html#collect-a-game-piece-with-a-time-limit). `StatusLights` uses the same two-second display command from the preceding example.

```java Commands v3
Command prepareThenCollect(Intake intake, StatusLights lights) {
  return Command.noRequirements(
          coroutine -> {
            Command prepare = intake.deploy()
                .alongWith(lights.showCollectingForTwoSeconds())
                .named("Deploy and show collecting pattern");

            coroutine.await(prepare);
            if (!intake.hasGamePiece()) {
              coroutine.await(intake.collectWithTimeLimit());
            }
          })
      .named("Prepare then collect if needed");
}
```

The group says “deploy and show the pattern, and wait for both.” During that stage it reserves intake and lights. When the group finishes, it releases both. Java then reads the current sensor value. If collection is needed, the collection child takes the intake again and the lights stay available. The parent itself has no requirements.

If you wanted the lights to become available as soon as their command ends, even while deployment is still running, you could use `awaitAll` for the preparation stage instead. Both approaches wait for the same two actions to finish. Their requirements are released at different points.

## Race a sensor against a timeout

Run an intake until its sensor detects a game piece or two seconds pass. Both versions use `PracticeIntake.collectUntilDetected()` from the first translation. That child owns the intake and stops the roller through `whenExited`. The timer owns no mechanisms. Import `Seconds` as a static member of `org.wpilib.units.Units`.

```java v3 race group
Command collectWithRace(PracticeIntake intake) {
  Command timeout = Command.waitFor(Seconds.of(2.0)).named("Collection timer");
  return Command.race(intake.collectUntilDetected(), timeout)
      .named("Collect until detected or timed out");
}
```
```java v3 coroutine
Command collectWithAwaitAny(PracticeIntake intake) {
  return Command.noRequirements(
          coroutine -> {
            Command timeout =
                Command.waitFor(Seconds.of(2.0)).named("Collection timer");
            coroutine.awaitAny(intake.collectUntilDetected(), timeout);
          })
      .named("Collect until detected or timed out");
}
```

If the sensor detects a piece first, the collection command finishes and the timer is canceled. If the timer finishes first, collection is canceled and its exit action stops the roller. `Command.race(...)` is the v3 group form of v2 `Commands.race(...)`. Use `awaitAny(...)` when the race is a step in a longer coroutine. The parent can continue after the race while the finished intake child releases the intake. Give concurrent children separate requirements.

If later code cares whether a piece was detected, it can read the sensor after the race. The `ForkResult` returned by `awaitAny` describes whether the children could be started. For a single sensor wait with a timeout, the [timed intake example](examples-sensor-waits.html#collect-a-game-piece-with-a-time-limit) shows how to use the wait’s explicit timeout result.

> **WPILib docs**
> [Race Work](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/migration-guide.html#race-work)

## Start a child and keep going with fork

> **Watch for**
> Children run within the parent’s lifetime. If the parent calls `fork()` and immediately returns, the scheduler cancels any child that is still running.

Use `fork` when an action should start now and the parent has other work to do before it needs to wait. Suppose the robot should display a moving light pattern for the duration of a drive to the pickup marker. `lights.showMoving()` returns a command that requires the lights, applies the pattern, and uses `park()` to stay active until canceled. Its `whenExited` restores the normal pattern. The drive child requires drive and stops when it reaches the marker or is canceled.

```java v3 coroutine
Command driveToPickupWithLights(Drive drive, StatusLights lights) {
  return Command.noRequirements(
          coroutine -> {
            coroutine.fork(lights.showMoving());
            coroutine.await(drive.moveToPickupMarker());
          })
      .named("Drive to pickup with moving lights");
}
```

1. The parent calls `fork` to start the lights child. It continues to the next line without waiting for that child to finish.
2. The parent awaits the drive child. The scheduler can run both children. Drive and lights each have their own requirement.
3. When the drive child finishes, the parent returns. The scheduler cancels the still-running lights child, which restores the normal pattern.

Canceling the parent during the drive cancels both children. In Alpha 8, a competing command outside this routine that interrupts an active child can cancel the whole routine. The parent also cancels by default if a child cannot start.

| Call | When the parent continues |
| --- | --- |
| `fork(child)` | After starting the child, without waiting for it to finish. |
| `await(child)` | After the child finishes. |
| `awaitAll(a, b)` | After both children finish. |
| `awaitAny(a, b)` | After one finishes and any still-running children are canceled. |

> **WPILib docs**
> [Concurrent Execution (Forking)](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/creating-commands.html#concurrent-execution-forking)
