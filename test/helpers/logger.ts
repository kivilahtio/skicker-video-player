/**
 * This module instantiates a test logger used by all test cases
 */

import * as log4javascript from "log4javascript"; // Import log level constants
import { LoggerManager } from "skicker-logger-manager";

export function initLoggingSubsystem() {
  const loggerManager: LoggerManager = new LoggerManager(true);
  loggerManager.setConfigurer("Skicker.Stepper", (logger) => {
    logger.setLevel(log4javascript.Level.ERROR);
  });
  const logger = loggerManager.getLogger("Skicker.Stepper");
  logger.fatal("Skicker.Stepper here logging fatally");
  logger.error("Skicker.Stepper here logging errorly");
  logger.warn("Skicker.Stepper here logging warning");
}

