# Commands v3 intake lab

This desktop-only Java project uses WPILib 2027.0.0-alpha-8, Java 25, and the
Commands v3 vendordep. Select the matching WPILib JDK in your terminal and extract
the entire project before running it. The matching Alpha 8 artifacts may be in
an installer directory named `2027_alpha7`.

Run from this directory on Windows:

```powershell
.\gradlew.bat run
```

On macOS or Linux:

```sh
sh ./gradlew run
```

Read `PracticeIntake.java` and predict the roller output while waiting, on the
tick the sensor trips, and after cancel or disable. Then compare with the PASS
lines. The program drives a simulated sensor and Driver Station state through
the real Commands v3 scheduler. The roller output is a variable you can inspect
without robot hardware.

Try the failure exercise. Move `stop()` to the line after `waitUntil` and remove
the call to `whenExited`. Run again and find the first failed check. Restore `whenExited`
to make all checks pass. Optional extension: try the timed `waitUntil` overload
and add a sensor-never-trips case.

`LabCheck.java` defines the scripted scenarios. `PracticeIntake.java` contains the
worked solution and the file you edit for the exercise.
