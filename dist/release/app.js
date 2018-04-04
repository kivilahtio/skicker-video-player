"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const $ = require("jquery");
const skicker_logger_manager_1 = require("skicker-logger-manager");
require("./app.css");
const VideoPlayer_1 = require("./VideoPlayer");
/*
 * Initiate the logging subsystem. See the developer console to track what happens inside the video player.
 */
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
/* 2. Transform form submission to video player options */
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
/* 4. Create the control panel for the video player */
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
    /* 6. Destroy the video player */
    const destroyHandler = (ev) => {
        window.clearInterval(videoPlayer._intervall);
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
    // Define seeker max and min positions based on the given start/end video positions
    const seeker = $(videoControl).find(".video-control-seek input");
    seeker.attr("min", videoPlayer.getOptions().start || 0);
    seeker.attr("max", videoPlayer.getOptions().end || 0);
    const seekHandler = (ev) => {
        let val = $(ev.currentTarget).val();
        videoPlayer.seekVideo(val);
        $(videoControl).find(".video-control-seek #seekToView").html(val + "");
    };
    $(videoControl).find(".video-control-seek input").change(seekHandler);
    return videoControl[0];
};
/** Store the created video players here */
const videoPlayers = [];
/*
 * Main bread and butter of this demo! This is where it starts.
 */
const form = document.getElementById("video-loading-form");
form.onsubmit = function (e) {
    logger.debug("Form onsubmit():> form=", form, "event=", e);
    /* 1. Receive video player parameters from form submission */
    const formDataAry = $(form).serializeArray();
    const formData = {};
    formDataAry.forEach((value, index, array) => {
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
    const videoPlayer = new VideoPlayer_1.VideoPlayer(vpPlayer);
    videoPlayers.push(videoPlayer);
    videoPlayer._intervall = window.setInterval(() => {
        try {
            $(vpTime).html(videoPlayer.getVideoAPI().getPosition() + "");
        }
        catch (e) {
            //console.log(e);
        }
    }, 100);
    const controller = createVideoPlayerControl(videoPlayer, videoPlayers.length);
    /* 5. Prepare the video for display */
    videoPlayer.loadVideoFromURL(new URL(formData["videoUrl"]), transformFormDataToIVideoAPIOptions(formData))
        .then((videoAPI) => {
        const seeker = $(controller).find(".video-control-seek input");
        const max = Number.parseInt(seeker.attr("max"));
        if (max === 0) {
            seeker.attr("max", videoAPI.getDuration());
        }
    })
        .catch((err) => {
        alert(`VideoPlayer.loadVideoFromURL() threw an error?\n${err.toString()}`);
    });
    e.preventDefault();
    return false; // Prevent submitting the form to prevent a page reload
};
//# sourceMappingURL=app.js.map