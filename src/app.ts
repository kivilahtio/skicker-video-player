import * as log4javascript from "log4javascript"; // Import log level constants
import { LoggerManager } from "skicker-logger-manager";
import "./app.css";

const loggerManager: LoggerManager = new LoggerManager(true);
loggerManager.setConfigurer("Skicker.Stepper", (logger) => {
  logger.setLevel(log4javascript.Level.ERROR);
});
const logger = loggerManager.getLogger("Skicker.Stepper");
logger.fatal("Skicker.Stepper here logging fatally");
logger.error("Skicker.Stepper here logging errorly");
logger.warn("Skicker.Stepper here logging warning");


$(() => {

  $(document.body).html("Hello World");

  const element = document.createElement("div");
  element.innerHTML = "Hello, webpack";
  element.classList.add("hello");
  document.body.appendChild(element);

});
