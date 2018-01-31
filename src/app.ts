import * as $ from "jquery";
import { log4javascript, LoggerManager } from "skicker-logger-manager";
import "./app.css";

import * as dom from "../test/helpers/dom";

import { IVideoAPIOptions, VideoAPI } from "./VideoAPI";
import { VideoPlayer } from "./VideoPlayer";

const initLoggers = (): void => {
  LoggerManager.init(false);

  const rootLogger: log4javascript.Logger = LoggerManager.getLogger();
  rootLogger.removeAllAppenders();

  LoggerManager.setConfigurer("Skicker", (logger) => {
    logger.setLevel(log4javascript.Level.ALL);
    const appender = new log4javascript.BrowserConsoleAppender();
    // Change the desired configuration options
    appender.setThreshold(log4javascript.Level.ALL);
    // Define the log layout
    const layout = new log4javascript.NullLayout();
    appender.setLayout(layout);
    // Add the appender to the logger
    logger.removeAllAppenders();
    logger.addAppender(appender);
  });
  LoggerManager.getLogger("Skicker");
};
initLoggers();
const logger: log4javascript.Logger = LoggerManager.getLogger("Skicker");


const transformFormDataToIVideoAPIOptions = (data: any): IVideoAPIOptions => {
  return {
    width: data.videoWidth,
    height: data.videoHeight,
    start: data.videoStart,
    end: data.videoEnd,
    rate: data.videoRate,
    volume: data.videoVolume,
    autoplay: data.videoAutoPlay,
  };
};

/** Store the created video players here */
const videoPlayers: VideoPlayer[] = [];

const form: HTMLFormElement = document.getElementById("video-loading-form") as HTMLFormElement;
form.onsubmit = function(e) {
  logger.debug("Form onsubmit():> ", form);

  const formDataAry: JQuery.NameValuePair[] = $(form).serializeArray();
  const formData: {[key: string]: string} = {};
  formDataAry.forEach((value: JQuery.NameValuePair, index: number, array: JQuery.NameValuePair[]) => {
    formData[value.name] = value.value;
  });
  logger.debug("Form onsubmit():> Form data=", formData);

  const videoPlayer: VideoPlayer = new VideoPlayer(dom.appendBodyElement("div", `skicker-video-player-${videoPlayers.length}`, "video-player"));
  videoPlayers.push(videoPlayer);

  videoPlayer.loadVideoFromURL(new URL(formData["videoUrl"]), transformFormDataToIVideoAPIOptions(formData))
  .catch((err: Error) => {
    alert(`VideoPlayer.loadVideoFromURL() threw an error?\n${err.toString()}`);
  });

  return false; // Prevent submitting the form to prevent a page reload
};
