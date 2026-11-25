# Command groups and mechanism requirements

Decide when an autonomous group should finish and how long each mechanism should stay reserved.

When you read a routine, trace when each child starts and what ends the stage. Then trace which mechanisms another command can take at that point. The timed group below ends when the timer finishes. During the wait, the group reserves the drivetrain because its hold command requires drive.

Lesson 3 shows how to [run two actions and wait for both](ownership.html#prepare-two-independent-mechanisms-together), [use a preparation group in a conditional routine](ownership.html#use-a-group-inside-a-coroutine), and [keep lights running while a drive command runs](ownership.html#start-a-child-and-keep-going-with-fork).

## Keep the drivetrain stopped during an autonomous pause

**Problem.** Let the drivetrain settle for one second before the next autonomous step. Keep drive under control for the whole pause.

**Where this goes.** Put the method on your drive class, which implements `Mechanism`. Its `stop()` method requests zero motion from the drivetrain. Import `ParallelGroupBuilder` from `org.wpilib.command3` and `Seconds` from `org.wpilib.units.Units`.

```java Commands v3
Command pauseWithDriveStopped() {
  Command timer = Command.waitFor(Seconds.of(1.0)).named("Pause timer");
  Command holdDrive =
      this.runRepeatedly(this::stop)
          .whenExited(this::stop)
          .named("Hold drive stopped");

  return new ParallelGroupBuilder()
      .requiring(timer)
      .optional(holdDrive)
      .named("Pause with drive stopped");
}
```

This is the same completion rule as a v2 `Commands.deadline(timer, holdDrive)`. The timer determines when the group finishes. The group keeps control of the drivetrain because the hold command requires it. Here `requiring(timer)` means **the timer must finish**. The timer itself requires no mechanism. When time is up, the group cancels the hold command, which requests a stop once more. Canceling the group early also cancels the hold.

If you put only a timer between two commands, check what controls the drivetrain during the wait. With a fixed sequence, the sequence keeps its combined requirements throughout. A coordinating coroutine can instead let each child acquire and release its own requirements.

## Build a command from the robot’s current state

**Problem.** The driver presses a button to approach a target just ahead of the robot’s current position. Read the starting pose on every press, even if the binding was created at startup.

**Where this goes.** `Drive.approachFromHere()` reads the current pose when called, calculates a nearby target, and returns a fresh command that requires drive. That command moves the robot when scheduled and stops drive when it ends. In v2, `Drive` is a subsystem and `Set` comes from `java.util`. In v3, `Drive` implements `Mechanism`.

```java Commands v2
Command approachWhenPressed(Drive drive) {
  return Commands.defer(drive::approachFromHere, Set.of(drive))
      .withName("Approach from current pose");
}
```
```java Commands v3
Command approachWhenPressed(Drive drive) {
  return Command.requiring(drive)
      .executing(coroutine -> {
        coroutine.await(drive.approachFromHere());
      })
      .named("Approach from current pose");
}
```

In v2, `defer` gives `DeferredCommand` a supplier. The supplier runs when the wrapper starts, and `Set.of(drive)` declares the requirement up front. In v3, the call inside the coroutine runs when the scheduler reaches that line. The parent explicitly requires drive to preserve the v2 reservation. The child can share that requirement because the scheduler knows it belongs to the parent.

> **Watch for**
> Keep `drive.approachFromHere()` inside the lambda passed to `.executing(...)` to read the pose each time the parent runs. Calling it before you pass the lambda to the builder would read the pose during setup.

Delaying construction and deciding when to reserve drive are separate choices.

## Give a child its mechanism only while it runs

**Problem.** Drive to the pickup marker, then move the elevator to pickup height. Other elevator commands may run during the drive stage. During the elevator move, drive can become available if your robot can safely allow it.

```java Commands v2
Command pickupSetup(Drive drive, Elevator elevator) {
  return Commands.sequence(
          drive.moveToPickupMarker().asProxy(),
          elevator.moveToPickupHeight().asProxy())
      .withName("Pickup setup");
}
```

The drive command requires drive and finishes at the marker. The elevator command requires the elevator and finishes at pickup height. In v2, `asProxy()` creates a `ProxyCommand` that schedules the real command separately. The wrapping sequence does not inherit the real command’s requirements. The factory calls still happen when `pickupSetup()` builds the sequence.

In the [v3 coroutine version](ownership.html#move-the-drivetrain-then-position-the-elevator), the parent requires neither mechanism. Each `await` starts a scheduler-tracked child. The child acquires its requirement and releases it when it ends. The drive requirement becomes free during the elevator move.

**Check what happens if a child cannot start.** A v2 proxy can finish and let the sequence advance if the underlying command never schedules. With the default settings in Alpha 8, an awaited child that cannot start cancels its v3 parent. For example, if a higher-priority homing command controls the elevator, the routine stops at that stage. Canceling the v3 parent also cancels its active child. Use a [sequence that reserves both mechanisms](ownership.html#move-the-drivetrain-then-position-the-elevator) if the routine needs to keep drive throughout.

## Build a child later and reserve its mechanism only then

In v2, `Commands.deferredProxy(drive::approachFromHere)` combines both choices. The supplier runs when that stage is reached, and the real command’s drive requirement stays out of the enclosing group. In v3, call the factory inside the `await` of a parent with no requirements. Here the approach is built from the pose after the elevator reaches pickup height, and drive becomes required at that stage.

```java Commands v2
Command lowerThenApproach(Drive drive, Elevator elevator) {
  return Commands.sequence(
          elevator.moveToPickupHeight().asProxy(),
          Commands.deferredProxy(drive::approachFromHere))
      .withName("Lower elevator then approach");
}
```
```java Commands v3
Command lowerThenApproach(Drive drive, Elevator elevator) {
  return Command.noRequirements(
          coroutine -> {
            coroutine.await(elevator.moveToPickupHeight());
            coroutine.await(drive.approachFromHere());
          })
      .named("Lower elevator then approach");
}
```

This routine and the [current-pose example](#build-a-command-from-the-robot-s-current-state) both read the pose when the approach command is built. Here the parent has no requirements, so other commands can use drive while the elevator lowers. At the approach step the child must acquire drive, so a higher-priority drive command can prevent it from starting.

> **WPILib docs**
> [Scheduling Other Commands in v2](https://docs.wpilib.org/en/stable/docs/software/commandbased/command-compositions.html#scheduling-other-commands)
> [Proxy Commands and Smart Requirements](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/migration-guide.html#proxy-commands-and-smart-requirements)
