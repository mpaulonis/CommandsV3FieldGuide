# Commands v3 Field Guide

Learn to write and troubleshoot Commands v3 if you already know Commands v2. This guide uses Java and WPILib 2027 Alpha 8.

## Learn in three lessons {#learn-in-order}

1. [Commands v3 - Java plus a Coroutine](coroutines.html) — See how v3 lets you compose commands with ordinary Java, then trace a pause and resume driven by a Coroutine.
2. [Translate an intake command](intake.html) — Compare the v2 and v3 code and follow the motor cleanup on cancellation.
3. [Coordinate mechanisms](ownership.html) — Choose between a command group and a coroutine based on when each mechanism must be reserved.

## Find an answer while coding

- [Migration](changes.html) — Diagnose a builder that will not compile, a held button that runs once, or a default that fails to come back.
- [Examples](examples.html) — Find code for sensor waits, operator controls, and autonomous routines.
- [v2 method lookup](reference.html) — Start with the v2 name, such as `startEnd`, `deadline`, or `withName`.
- [v3 method lookup](v3-reference.html) — Browse the Alpha 8 API by topic or search a method to see how and when to use it.

> **WPILib docs**
> [Commands v3 Programming](https://docs.wpilib.org/en/latest/docs/software/commandbased/commands-v3/index.html)
