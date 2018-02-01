"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const $ = require("jquery");
const skicker_logger_manager_1 = require("skicker-logger-manager");
require("./app.css");
const VideoPlayer_1 = require("./VideoPlayer");
const initLoggers = () => {
    skicker_logger_manager_1.LoggerManager.init(false);
    const rootLogger = skicker_logger_manager_1.LoggerManager.getLogger();
    rootLogger.removeAllAppenders();
    skicker_logger_manager_1.LoggerManager.setConfigurer("Skicker", (logger) => {
        logger.setLevel(skicker_logger_manager_1.log4javascript.Level.ALL);
        const appender = new skicker_logger_manager_1.log4javascript.BrowserConsoleAppender();
        // Change the desired configuration options
        appender.setThreshold(skicker_logger_manager_1.log4javascript.Level.ALL);
        // Define the log layout
        const layout = new skicker_logger_manager_1.log4javascript.NullLayout();
        appender.setLayout(layout);
        // Add the appender to the logger
        logger.removeAllAppenders();
        logger.addAppender(appender);
    });
    skicker_logger_manager_1.LoggerManager.getLogger("Skicker");
};
initLoggers();
const logger = skicker_logger_manager_1.LoggerManager.getLogger("Skicker");
const transformFormDataToIVideoAPIOptions = (data) => {
    return {
        width: Number(data.videoWidth),
        height: Number(data.videoHeight),
        start: Number(data.videoStart),
        end: Number(data.videoEnd),
        rate: Number(data.videoRate),
        volume: Number(data.videoVolume),
        autoplay: Boolean(data.videoAutoPlay),
        loop: Boolean(data.videoLoop),
        controls: Boolean(data.videoControls),
    };
};
const createVideoPlayerControl = (videoPlayer, i) => {
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
        .attr("id"));
    // Define handlers to control the video playback
    const destroyHandler = (ev) => {
        videoPlayer.destroy();
        $(ev.target).remove();
        $(videoControl).remove();
    };
    $(videoControl).children(".video-control-destroy").click(destroyHandler); // WTF? Argument of type '(ev: MouseEvent) => void' is not assignable to parameter of type 'MouseEvent'. Property 'altKey' is missing in type '(ev: MouseEvent) => void'.
    const playHandler = (ev) => {
        videoPlayer.startVideo()
            .catch((err) => alert(err.toString()));
    };
    $(videoControl).children(".video-control-play").click(playHandler);
    const stopHandler = (ev) => {
        videoPlayer.stopVideo()
            .catch((err) => alert(err.toString()));
    };
    $(videoControl).children(".video-control-stop").click(stopHandler);
    const pauseHandler = (ev) => {
        videoPlayer.pauseVideo()
            .catch((err) => alert(err.toString()));
    };
    $(videoControl).children(".video-control-pause").click(pauseHandler);
};
/** Store the created video players here */
const videoPlayers = [];
const form = document.getElementById("video-loading-form");
form.onsubmit = function (e) {
    logger.debug("Form onsubmit():> form=", form, "event=", e);
    const formDataAry = $(form).serializeArray();
    const formData = {};
    formDataAry.forEach((value, index, array) => {
        formData[value.name] = value.value;
    });
    logger.debug("Form onsubmit():> Form data=", formData);
    // Create the video player container and the video player
    const vpElement = $("<div/>", {
        class: "video-player",
        id: `video-player-${videoPlayers.length}`,
    })[0];
    $(vpElement).appendTo("body");
    const videoPlayer = new VideoPlayer_1.VideoPlayer(vpElement);
    videoPlayers.push(videoPlayer);
    createVideoPlayerControl(videoPlayer, videoPlayers.length);
    videoPlayer.loadVideoFromURL(new URL(formData["videoUrl"]), transformFormDataToIVideoAPIOptions(formData))
        .catch((err) => {
        alert(`VideoPlayer.loadVideoFromURL() threw an error?\n${err.toString()}`);
    });
    return false; // Prevent submitting the form to prevent a page reload
};
//# sourceMappingURL=app.js.map