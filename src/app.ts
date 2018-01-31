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
    width:    Number(data.videoWidth),
    height:   Number(data.videoHeight),
    start:    Number(data.videoStart),
    end:      Number(data.videoEnd),
    rate:     Number(data.videoRate),
    volume:   Number(data.videoVolume),
    autoplay: Boolean(data.videoAutoPlay),
    loop:     Boolean(data.videoLoop),
    controls: Boolean(data.videoControls),
  };
};

const createVideoPlayerControl = (videoPlayer: VideoPlayer, i: number): void => {
  // Clone the video control template and appendit to the video controller
  const videoControl = $(".template-video-control").clone();
  $("#video-controls-container")
  .append(videoControl);

  // Set id and title
  $(videoControl)
  .attr("id", `video-control-${i}`)
  .children(".video-control-title")
  .html($(videoControl)
        .attr("id")
  );

  // Define handlers to control the video playback
  const destroyHandler = (ev: MouseEvent): void => {
    videoPlayer.destroy();
    $(ev.target).remove();
    $(videoControl).remove();
  };
  $(videoControl).children(".video-control-destroy").click(destroyHandler as any); // WTF? Argument of type '(ev: MouseEvent) => void' is not assignable to parameter of type 'MouseEvent'. Property 'altKey' is missing in type '(ev: MouseEvent) => void'.

  const playHandler = (ev: MouseEvent): void => {
    videoPlayer.startVideo()
    .catch((err) => alert(err.toString()));
  };
  $(videoControl).children(".video-control-play").click(playHandler as any);

  const stopHandler = (ev: MouseEvent): void => {
    videoPlayer.stopVideo()
    .catch((err) => alert(err.toString()));
  };
  $(videoControl).children(".video-control-stop").click(stopHandler as any);

  const pauseHandler = (ev: MouseEvent): void => {
    videoPlayer.pauseVideo()
    .catch((err) => alert(err.toString()));
  };
  $(videoControl).children(".video-control-pause").click(pauseHandler as any);
};

/** Store the created video players here */
const videoPlayers: VideoPlayer[] = [];

const form: HTMLFormElement = document.getElementById("video-loading-form") as HTMLFormElement;
form.onsubmit = function(e) {
  logger.debug("Form onsubmit():> form=", form, "event=", e);

  const formDataAry: JQuery.NameValuePair[] = $(form).serializeArray();
  const formData: {[key: string]: string} = {};
  formDataAry.forEach((value: JQuery.NameValuePair, index: number, array: JQuery.NameValuePair[]) => {
    formData[value.name] = value.value;
  });
  logger.debug("Form onsubmit():> Form data=", formData);

  const videoPlayer: VideoPlayer = new VideoPlayer(dom.appendBodyElement("div", `video-player-${videoPlayers.length}`, "video-player"));
  videoPlayers.push(videoPlayer);
  createVideoPlayerControl(videoPlayer, videoPlayers.length);

  videoPlayer.loadVideoFromURL(new URL(formData["videoUrl"]), transformFormDataToIVideoAPIOptions(formData))
  .catch((err: Error) => {
    alert(`VideoPlayer.loadVideoFromURL() threw an error?\n${err.toString()}`);
  });

  return false; // Prevent submitting the form to prevent a page reload
};
