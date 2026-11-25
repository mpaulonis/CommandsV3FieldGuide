package frc.lab;

import java.util.Set;
import org.wpilib.command3.Scheduler;
import org.wpilib.hardware.hal.HAL;
import org.wpilib.simulation.DriverStationSim;
import org.wpilib.simulation.SimHooks;

public final class LabCheck {
  private LabCheck() {}

  public static void main(String[] args) {
    HAL.initialize();
    SimHooks.pauseTiming();
    Scheduler scheduler = Scheduler.createIndependentScheduler();
    PracticeIntake intake = new PracticeIntake(scheduler);
    var collect = intake.collectUntilDetected();

    try {
      if (!collect.requirements().equals(Set.of(intake))) {
        throw new AssertionError("The command must require exactly this intake.");
      }
      setEnabled(true);
      scheduler.schedule(collect);
      tick(scheduler);
      expectOutput(intake, 0.6, "The roller starts with the sensor clear.");

      tick(scheduler);
      expectOutput(intake, 0.6, "The roller stays on while the command waits.");

      intake.setGamePiecePresent(true);
      tick(scheduler);
      expectOutput(intake, 0.0, "The roller stops when the sensor trips.");

      intake.setGamePiecePresent(false);
      scheduler.schedule(collect);
      tick(scheduler);
      expectOutput(intake, 0.6, "The same command starts again with the sensor clear.");

      scheduler.cancel(collect);
      tick(scheduler);
      expectOutput(intake, 0.0, "The roller stops when canceled during the wait.");

      scheduler.schedule(collect);
      tick(scheduler);
      expectOutput(intake, 0.6, "The command can be reused after cancellation.");

      setEnabled(false);
      tick(scheduler);
      expectOutput(intake, 0.0, "The roller stops when disabled during the wait.");

      setEnabled(true);
      tick(scheduler);
      expectOutput(intake, 0.0, "Re-enable alone leaves this manually scheduled command stopped.");
    } finally {
      scheduler.cancelAll();
      setEnabled(false);
      SimHooks.resumeTiming();
    }
  }

  private static void setEnabled(boolean enabled) {
    DriverStationSim.setEnabled(enabled);
    DriverStationSim.notifyNewData();
  }

  private static void tick(Scheduler scheduler) {
    SimHooks.stepTiming(0.02);
    scheduler.run();
  }

  private static void expectOutput(PracticeIntake intake, double expected, String message) {
    double actual = intake.rollerOutput();
    if (actual != expected) {
      throw new AssertionError(message + " Expected " + expected + ", got " + actual);
    }
    System.out.printf("PASS %.1f  %s%n", actual, message);
  }
}
