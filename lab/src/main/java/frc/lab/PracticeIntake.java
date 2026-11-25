package frc.lab;

import org.wpilib.command3.Command;
import org.wpilib.command3.Mechanism;
import org.wpilib.command3.Scheduler;

/** A modeled motor and game-piece switch for desktop practice. */
// BEGIN practice-intake-class
final class PracticeIntake implements Mechanism {
  // END practice-intake-class
  private final Scheduler scheduler;
  private boolean gamePiecePresent;
  private double rollerOutput;

  PracticeIntake(Scheduler scheduler) {
    this.scheduler = scheduler;
  }

  @Override
  public Scheduler getRegisteredScheduler() {
    return scheduler;
  }

  // BEGIN collect-until-detected
  Command collectUntilDetected() {
    return this.run(coroutine -> {
          setRoller(0.6);
          coroutine.waitUntil(this::hasGamePiece);
        })
        .whenExited(this::stop)
        .named("Collect until detected");
  }
  // END collect-until-detected

  boolean hasGamePiece() {
    return gamePiecePresent;
  }

  void setGamePiecePresent(boolean present) {
    gamePiecePresent = present;
  }

  double rollerOutput() {
    return rollerOutput;
  }

  // BEGIN roller-helpers
  private void setRoller(double output) {
    rollerOutput = output;
  }

  private void stop() {
    setRoller(0);
  }
  // END roller-helpers
}
