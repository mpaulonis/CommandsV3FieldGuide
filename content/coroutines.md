# Commands v3 - Java plus a Coroutine

Commands v3 lets you write the decisions in a robot routine with ordinary Java. A Coroutine object manages pausing the routine to let the scheduler manage everything the robot needs to do. Explore the motivation for introducing Commands v3, and then dive into the details of how the Coroutine and its methods need to be used with Java to build v3 commands correctly.

## Introduction to a v3 Command and the Coroutine {#what-is-a-coroutine}

Suppose a robot has time for two pickup attempts in autonomous. Try the first pickup with a time limit. If the sensor still shows no game piece, drive to a second pickup spot and try once more. With a piece onboard, drive to score. If both attempts come up empty, take a fallback route.

In Commands v2, a common way to express this is to assemble a `sequence`, put a `withTimeout` decorator on each pickup, and nest `either` branches for the retry and the final route. If the robot can choose among several routes, you might add `select`. Together these helpers form a **domain-specific language (DSL)** for describing how commands fit together. As the routine grows, it can get hard to tell which branch runs next, when a sensor gets checked, or which action a decorator applies to.

### V3 lets you write the routine as a lambda

A **lambda** lets you pass Java code to be run later. If you’ve handed

`() -> setRoller(0.6)`

to a v2 command as its start action, you’ve already used one. The part before `->` lists the inputs (none in this case), and the part after it is the code to run.  There is just one line in this example, but there could be more in a { ... } block.

In Commands v3, you can create and then pass the whole routine to a builder as a lambda. In this autonomous example, a `for` loop could be used to limit the number of attempts, an `if` could check whether to try the second spot, and an `if`/`else` could choose the final route. Just the power and flexibility of ordinary Java. No special methods to learn. No limitations based on methods that happen to be available.

### Pause a long routine to give other routines their chance to run

This routine takes a long time.  Driving may seem quick in the match, but it's very long when you consider that the robot controller is processing at 50 cycles per second. While the routine is waiting to see a sensor signal, the scheduler still needs to run the drive command, check triggers, and give all other robot activity a turn with the processor.

> **Key idea**
> The lambda supplies the command body. A **coroutine** lets that body pause at a specific call, hand control back to the scheduler, and later resume at the same point with its local variables intact.

When WPILib calls the body, it passes in a `Coroutine` object. In `coroutine -> { ... }`, `coroutine` is the name of the parameter that receives it. The body calls methods on that object to pause in the way it needs.

You can get a sneak peek at a [Commands v3 implementation of this routine](examples-sensor-waits.html#retry-a-pickup-and-choose-a-route). If you jump over there, please come back.  You can see Java handling program flow and the use of `coroutine.await()` to let the scheduler run the rest of the robot while this routine waits for various drive moves. When the first drive command (collectWithTimeLimit) finishes, the routine resumes after that line. The loop still has its attempt count, so it can continue with the second pickup. That’s how the code can read in the order the robot acts even when one step spans many scheduler cycles.

Commands v3 did not abandon _all_ DSL. `Command.sequence(...)` and `Command.parallel(...)` are still there for basic needs, and some wrappers such as `withTimeout(...)` are still available. Ordinary Java takes over choices that used methods such as `either` or `select` and much of the control flow that used to be expressed through decorator chains. [See when to use a group, a coroutine, or both](ownership.html#choose-a-group-or-a-coroutine).

## Trace a pause and resume within a v3 Command {#trace-a-pause-and-resume}

Calling v3 Command `traceYield()` supplies two lambdas to the builder. `noRequirements(...)` takes a multiline lambda body with one input, `coroutine`. `whenExited(...)` takes an single line body with zero inputs, shown by `()`. V3 commands must be named and that is enforced by having `.named(...)` actually build the `Command`. This example prints to the console and requires no mechanisms. Import `Command` from `org.wpilib.command3`. [Learn how naming works](changes.html#finish-building-and-name-the-command).

```java Commands v3
Command traceYield() {
  return Command.noRequirements(
          coroutine -> {
            String label = "Warmup";
            System.out.println(label + " started");
            coroutine.yield();
            System.out.println(label + " continued");
          })
      .whenExited(() -> System.out.println("Warmup exited"))
      .named("Trace yield");
}
```

| When | What happens |
| --- | --- |
| The scheduler starts the command | WPILib calls the body lambda with a `Coroutine` object. The body sets `label` to `Warmup` and prints `Warmup started`. |
| The body calls `coroutine.yield()` | The body pauses at that call and hands control back to the scheduler, which can run other commands. The local variable `label` keeps its value. |
| The scheduler resumes the command | `yield()` returns. The next line uses the same `label` to print `Warmup continued`. |
| The body returns | The command finishes normally, and the scheduler calls the `whenExited` lambda, which prints `Warmup exited`. |

If the scheduler cancels the command while it is paused at `yield()`, the console shows `Warmup started` followed by `Warmup exited`. The body never resumes, so `Warmup continued` is skipped. The scheduler runs the exit action separately from the body.

> **WPILib docs**
> [Using Lambda Functions](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/lambda-functions.html)
> [Scheduler Phases](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/how-it-works.html#scheduler-phases)

## Choose how to pause

- **`yield()`** gives the scheduler a turn. Use it in a loop when each pass does a small piece of work, such as one control update. A loop that keeps running without a pause can stall the scheduler.
- **`waitUntil(condition)`** pauses until a condition becomes true. Use it to check a sensor, such as whether the intake has a game piece.
- **`wait(Seconds.of(1.0))`** pauses for a duration while the robot continues processing commands and inputs.
- **`await(childCommand)`** lets the scheduler run a child command and pauses the parent while the child runs.

A call to `fork()` starts a child and continues without waiting for it to finish. [Compare fork and the await methods](ownership.html#start-a-child-and-keep-going-with-fork).

Pausing gives other commands a turn. A command that requires the intake still controls it while it waits. A larger routine can use child commands to release one mechanism while work on another continues.

## Keep the scheduler responsive {#put-yield-where-the-loop-repeats}

> **Key idea**
> Keep the work between pauses short. The scheduler gets control back when the command actually pauses or its body returns.

Think of each stretch of work between pauses as one turn on the scheduler thread. In v2 that turn usually ends when `execute()` returns. In v3 the coroutine can keep running Java code for as long as the body takes to reach a pause or return. If it holds the thread too long, other commands have to wait and the next trigger check and periodic update are delayed.

**Common ways to hold up the scheduler**

- **Poll in a tight loop.** `while (!atTarget()) {}` keeps checking on the same turn. If the target check depends on a sensor value refreshed by the next periodic update, that update may never get a chance to run. Use `coroutine.waitUntil(this::atTarget)` when all you need to do is wait, or do one short control update per pass and yield. With a suspended wait, the scheduler stays responsive even if the sensor never trips. [Add a timeout](examples-sensor-waits.html#collect-a-game-piece-with-a-time-limit) if the command itself needs a fallback.
- **Mistake a quick return for a pause.** In Alpha 8, `waitUntil` returns immediately if its condition is already true. If a loop keeps seeing that same true condition, the call can return on every pass without giving the scheduler a turn. Use an explicit `yield()` when each pass must give other work a turn.
- **Block inside a call.** A `Thread.sleep(...)` or a synchronous read that waits for data holds the scheduler thread, even if the next line is `yield()`. Use `coroutine.wait(...)` for a delay. Arrange for slow data to be ready before the command needs it, or let the command wait on a readiness condition.
- **Do too much work in one turn.** A calculation can take too long even if it always finishes. Compute it ahead of time or split it into short batches with pauses between batches. A quick action that returns promptly, such as setting a status flag, can finish in a single turn.

### Where to put yield in a control loop

| Where | Judgment and effect |
| --- | --- |
| After each update | **Typical.** Do the first short update immediately. Every path that repeats reaches the pause before checking the loop condition again. |
| Start of each pass | **Valid when you want to wait first.** The first update is delayed until the scheduler resumes the body. Keep the work after each pause short. |
| Once before the loop | **Dangerous for a loop that can keep running.** The initial pause gives the scheduler one turn. The loop can still hold the thread when the body resumes. |
| On one branch only | **Dangerous if another branch repeats.** A branch or `continue` that reaches the next iteration without a pause can stall the scheduler. |
| After the loop | **Too late for a loop that can keep running.** Execution must leave the loop before it reaches the pause. |

For a simple update that should repeat every cycle, `runRepeatedly` supplies the loop and yields between calls. Keep each callback short. WPILib can flag non-yielding `while` loops at compile time. Also check how long each call takes and whether a call you rely on for a pause can return immediately.

### Handling a permissive the wrong and right way

Suppose an arm should move toward a target when an permissive allows it and stop otherwise. In the buggy excerpt, `continue` in a while block sends the denied-motion path back to the condition before it reaches `yield()`. If motion stays disallowed, that path can repeat on the same turn. The corrected command, inside an arm class that implements `Mechanism`, reaches `yield()` after either a motor update or a stop request.

```java Buggy loop excerpt · for review
while (!atTarget()) {
  if (!motionAllowed()) {
    stopMotor();
    continue; // Skips the pause below.
  }
  updateMotorTowardTarget();
  coroutine.yield();
}
```
```java Corrected Commands v3 loop
Command moveArmToTarget() {
  return this.run(
          coroutine -> {
            while (!atTarget()) {
              if (motionAllowed()) {
                updateMotorTowardTarget();
              } else {
                stopMotor();
              }
              coroutine.yield();
            }
          })
      .whenExited(this::stopMotor)
      .named("Move arm to target");
}
```

> **Watch for**
> In loops, trace every path back to the loop condition. Each repeating path needs a pause of some sort. A `break` that leaves the loop or a `return` that ends the command needs no extra pause at that point.

In an application like this, it is important to test with motion allowed and denied to validate that you've written the command correctly. In both cases, check that other commands get a turn and the robot continues to operate.

> **WPILib docs**
> [Looping Commands](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/creating-commands.html#looping-commands)
> [One-Shot Commands](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/creating-commands.html#one-shot-commands)

## Use ordinary Java inside a command

Put sensor reads, loops, and route decisions inside the body lambda when they should happen during a command run. Each new run creates fresh local variables. If the body pauses, those variables and the current loop iteration are still there when it resumes. In v2 you might have stored the same state in a field shared by `initialize()` and `execute()`.

In the [current-pose example](examples-command-groups.html#build-a-command-from-the-robot-s-current-state), the body calls a factory that reads the drivetrain’s pose. The read happens when the scheduled body reaches that line, so each run can build its approach from a fresh pose.

> **WPILib docs**
> [Creating Commands](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/creating-commands.html)
