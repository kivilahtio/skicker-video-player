/**
 * In this demo!
 *
 * Creates new video players from form submissions (see. ./index.html.lodash)
 * 1. Receives constructor parameters from form submissions
 * 2. Transforms them to valid video player options
 * 3. Creates the video player from the valid options
 * 4. Creates a control panel to test video player supported actions.
 * 5. Load the video to the video player.
 *    (You can start playing by manually clicking the video, or by checking the autoplay-checkbox)
 * 6. Destroys video player instances on demand.
 */



/*
 * Initiate the logging subsystem. See the developer console to track what happens inside the video player.
 * It is important to init is here before initing anything else, because when other modules are imported, they too require the
 * Logging service to be available.
 */
import { log4javascript, LoggerManager } from "skicker-logger-manager";
const initLoggers = (): void => {
  LoggerManager.init();

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


import * as $ from "jquery";
import "./app.css";

const exampleVideos: any = {
  local1: "http://localhost:5000/"+require("../test/helpers/aarnilasku.mp4"),
  local2: "http://localhost:5000/"+require("../test/helpers/aarnilammas.mp4"),
  yt1: "https://www.youtube.com/watch?v=duQ9_578RKw",
};

import { IVideoAPIOptions, VideoAPI } from "./VideoAPI";
import { VideoPlayer } from "./VideoPlayer";



/* 2. Transform form submission to video player options */
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

/* 4. Create the control panel for the video player */
const createVideoPlayerControl = (videoPlayer: VideoPlayer, i: number): HTMLElement => {
  // Clone the video control template and appendit to the video controller
  const videoControl = $(".template-video-control")
  .clone()
  .removeClass("template-video-control");

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
  /* 6. Destroy the video player */
  const destroyHandler = (ev: MouseEvent): void => {
    window.clearInterval((videoPlayer as any)._intervall);
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

  // Define seeker max and min positions based on the given start/end video positions
  const seeker = $(videoControl).find(".video-control-seek input");
  seeker.attr("min", videoPlayer.getOptions().start || 0);
  seeker.attr("max", videoPlayer.getOptions().end || 0);
  const seekHandler = (ev: Event): void => {
    let val: number = $(ev.currentTarget).val() as number;
    videoPlayer.seekVideo(val);
    $(videoControl).find(".video-control-seek #seekToView").html(val+"");
  };
  $(videoControl).find(".video-control-seek input").change(seekHandler as any);

  return videoControl[0];
};

/** Store the created video players here */
const videoPlayers: VideoPlayer[] = [];

/*
 * Main bread and butter of this demo! This is where it starts.
 */
const form: HTMLFormElement = document.getElementById("video-loading-form") as HTMLFormElement;
form.onsubmit = function(e) {
  logger.debug("Form onsubmit():> form=", form, "event=", e);

  /* 1. Receive video player parameters from form submission */
  const formDataAry: JQuery.NameValuePair[] = $(form).serializeArray();
  const formData: {[key: string]: string} = {};
  formDataAry.forEach((value: JQuery.NameValuePair, index: number, array: JQuery.NameValuePair[]) => {
    formData[value.name] = value.value;
  });
  logger.debug("Form onsubmit():> Form data=", formData);

  /* 3. Create the video player container and the video player */
  // Clone the video player template and append it
  const vpContainer = $(".template-video-container")
  .clone()
  .removeClass("template-video-container");
  $(vpContainer).appendTo("body");
  $(vpContainer).find(".video-player").attr("id", `video-player-${videoPlayers.length}`);
  const vpTime = $(vpContainer).find(".video-getPosition")[0];
  const vpPlayer = vpContainer.find(".video-player")[0];

  const videoPlayer: VideoPlayer = new VideoPlayer(vpPlayer);
  videoPlayers.push(videoPlayer);
  (videoPlayer as any)._intervall = window.setInterval(() => {
    try {
      $(vpTime).html( videoPlayer.getStatus()+" : "+videoPlayer.getPosition() );
    } catch (e) {
      //console.log(e);
    }
  }, 100);
  const controller: HTMLElement = createVideoPlayerControl(videoPlayer, videoPlayers.length);

  /* 5. Prepare the video for display */
  videoPlayer.loadVideoFromURL(new URL(formData["videoUrl"]), transformFormDataToIVideoAPIOptions(formData))
  .then((vipa: VideoPlayer) => {
    const seeker: JQuery<HTMLElement> = $(controller).find(".video-control-seek input");
    const max: number = Number.parseInt(seeker.attr("max"));
    if (max === 0) {
      seeker.attr("max", vipa.getDuration());
    }
  })
  .catch((err: Error) => {
    alert(`VideoPlayer.loadVideoFromURL() threw an error?\n${err.toString()}`);
  });

  e.preventDefault();
  return false; // Prevent submitting the form to prevent a page reload
};

const injectExampleVideoSelector = (key: string, url: string) => {
  const jel = $(`<div id="example-${key}">${url}</div>`);
  jel.on("click", () => {
    $("#video-loading-form input[name='videoUrl']").val(jel.html());
  });
  $("#video-loading-form-container").prepend(jel);
  exampleVideos.local1
};
const injectExampleVideoSelectors = () => {
  for (const key in exampleVideos) {
    if (exampleVideos.hasOwnProperty(key)) {
      const url = exampleVideos[key];
      injectExampleVideoSelector(key, url);
    }
  }
};
injectExampleVideoSelectors();
