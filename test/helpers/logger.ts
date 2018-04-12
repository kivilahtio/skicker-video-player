/**
 * This module instantiates a test logger used by all test cases
 */

import { log4javascript, LoggerManager } from "skicker-logger-manager";

LoggerManager.init();

const rootLogger: log4javascript.Logger = LoggerManager.getLogger();
rootLogger.removeAllAppenders();

LoggerManager.setConfigurer("Skicker", (logger) => {
  logger.setLevel(log4javascript.Level.ALL);
  const appender = new log4javascript.BrowserConsoleAppender();
  // Change the desired configuration options
  appender.setThreshold(log4javascript.Level.ALL);
  // Define the log layout
  const layout = new log4javascript.PatternLayout("%d{HH:mm:ss}[%-5p]%c: %m{1}");
  appender.setLayout(layout);
  // Add the appender to the logger
  logger.removeAllAppenders();
  logger.addAppender(appender);
});
LoggerManager.getLogger("Skicker");

