"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const VideoAPI_1 = require("./VideoAPI");
const YouTubeVideo_1 = require("./VideoAPI/YouTubeVideo");
const BadParameter_1 = require("./Exception/BadParameter");
const UnknownVideoSource_1 = require("./Exception/UnknownVideoSource");
const skicker_logger_manager_1 = require("skicker-logger-manager");
const PromiseTimeout_1 = require("./Exception/PromiseTimeout");
const UnknownState_1 = require("./Exception/UnknownState");
const logger = skicker_logger_manager_1.LoggerManager.getLogger("Skicker.VideoPlayer");
/**
 * Front-end to interface with multiple video playing sources.
 * Most actions return a Promise. This way it is very easy to handle exceptions and take action when the Promise
 * is resolved (action has succeeded/failed).
 *
 * eg.
 * videoPlayer.startVideo().then(() => {alert("success")}).catch((err) => {alert(err.toString())})
 */
class VideoPlayer {
    /**
     *
     * @param rootElement Inject the video player here
     * @param options
     */
    constructor(rootElement, options, url) {
        /**
         * How long does each Promise created in this class take to timeout?
         * This is used to protect and catch against leaking promises that never resolve.
         * Time unit in ms
         */
        this.promiseSafetyTimeout = process.env.NODE_ENV === "testing" ? 9500 : 20000;
        /** Queue actions here, prevents for ex. multiple seeks from messing with each other */
        this.actionQueue = new Array();
        this.options = {};
        this.transition = undefined;
        this.youTubeURLParsingRegexp = /[&?]v=(\w+)(?:\?|$)/;
        logger.debug(`constructor():> params rootElement=${rootElement})`);
        this.rootElement = rootElement;
        if (options) {
            this.options = options;
        }
        if (url) {
            this.parseURL(url);
        }
    }
    /**
     * Release this player and all assets to garbage collection (hopefully)
     */
    destroy() {
        logger.debug("destroy():> ");
        this.videoAPI.destroy();
        this.videoAPI = undefined;
        if (this.rootElement) {
            this.rootElement.remove();
        }
        this.rootElement = undefined;
    }
    /**
     * Returns -1 if videoAPI has not been loaded
     */
    getDuration() {
        if (this.videoAPI) {
            return this.videoAPI.getDuration();
        }
        return undefined;
    }
    /** Returns the options given */
    getOptions() {
        return this.options;
    }
    getPlaybackRate() {
        if (this.videoAPI) {
            return this.videoAPI.getPlaybackRate();
        }
        return undefined;
    }
    /**
     * Returns -1 if videoAPI has not been loaded
     */
    getPosition() {
        if (this.videoAPI) {
            return this.videoAPI.getPosition();
        }
        return undefined;
    }
    /** Get the container for this VideoPlayer */
    getRootElement() {
        return this.rootElement;
    }
    /**
     * Gets the status of the current video player implementation or the current transition.
     * Remeber to check for both the status and the transition,
     * eg. started || starting
     */
    getStatus() {
        if (this.transition !== undefined) {
            return this.transition;
        }
        if (this.videoAPI) {
            return this.videoAPI.getStatus();
        }
        return VideoAPI_1.VideoPlayerStatus.notLoaded;
    }
    getTransition() {
        return this.transition;
    }
    /**
     * Returns the video API implementation
     */
    getVideoAPI() {
        return this.videoAPI;
    }
    /**
     * Returns the ID of the video being played
     */
    getVideoId() {
        logger.debug(`getVideoId():> returning ${this.videoId}`);
        return this.videoId;
    }
    /**
     * Prepares a video for playing.
     * @param id Video id of the remote service
     * @param api A supported video source API name. You can try casting a dynamic variable using "let api: SupportedVideoAPIs = SupportedVideoAPIs['YouTube'];"
     * @param options Options to pass to the video player implementation
     */
    loadVideo(id, api, options) {
        logger.debug(`loadVideo():> params videoId=${id}, api=${api}, options=${options || {}}`);
        if (options) {
            Object.assign(this.options, options);
        }
        if (id) {
            this.videoId = id;
        }
        if (this.videoId === undefined) {
            Promise.reject(new BadParameter_1.BadParameterException("videoId is undefined. You must pass it here or in the constructor."));
        }
        if (api) {
            this.api = api;
        }
        if (this.api === undefined) {
            Promise.reject(new BadParameter_1.BadParameterException("video API is undefined. You must pass it here or in the constructor." +
                "This is typically parsed from the base of the video url."));
        }
        if (this.videoAPI === undefined) {
            this.videoAPI = this.createVideoAPI();
            return this.queueAction("loadVideo", this.videoAPI.loadVideo, this.videoId, this.options);
        }
        else {
            logger.debug(`loadVideo():> Video already loaded, not loading it again, for videoId=${this.videoId}, api=${this.api}`);
            return Promise.resolve(this.videoAPI);
        }
    }
    /**
     * Prepares a video for playing. The video source and id is parsed from the URL.
     *
     * @param url Full URL to the video source.
     * @param options Options to pass to the video player implementation
     * @throws UnknownVideoSourceException if the video source is not supported
     * @throws BadParameterException if the URL is missing some important parameter
     */
    loadVideoFromURL(url, options) {
        logger.debug(`loadVideoFromURL():> params url=${url}, options=${options || {}}`);
        this.parseURL(url); // Parses the url and stores the videoId and api type to this object.
        return this.loadVideo(this.videoId, this.api, options);
    }
    pauseVideo() {
        if (this.videoAPI === undefined) {
            this.loadVideo();
        }
        return this.queueAction("pauseVideo", this.videoAPI.pauseVideo);
    }
    playOrPauseVideo() {
        if (this.getStatus() === VideoAPI_1.VideoPlayerStatus.started || this.transition === VideoAPI_1.VideoPlayerStatus.starting) {
            return this.pauseVideo();
        }
        else {
            return this.startVideo();
        }
    }
    seekVideo(position) {
        if (this.videoAPI === undefined) {
            this.loadVideo();
        }
        return this.queueAction("seekVideo", this.videoAPI.seekVideo, position);
    }
    setPlaybackRate(rate) {
        if (this.videoAPI === undefined) {
            this.loadVideo();
        }
        return this.queueAction("setPlaybackRate", this.videoAPI.setPlaybackRate, rate);
    }
    startVideo() {
        if (this.videoAPI === undefined) {
            this.loadVideo(); //Queue load action
        }
        return this.queueAction("startVideo", this.videoAPI.startVideo);
    }
    stopVideo() {
        if (this.videoAPI === undefined) {
            this.loadVideo();
        }
        return this.queueAction("stopVideo", this.videoAPI.stopVideo);
    }
    createVideoAPI() {
        logger.debug("selectVideoAPI():> ");
        if (this.api === VideoAPI_1.SupportedVideoAPIs.YouTube) {
            return new YouTubeVideo_1.YouTubeVideo(this.rootElement, this.options);
            //    else if (api === SupportedVideoAPIs.Vimeo) {
            //      return new VimeoVideo();
        }
        else {
            throw new UnknownVideoSource_1.UnknownVideoSourceException(`Video source '${this.api}' is not supported`);
        }
    }
    /**
     * given the URL of the video, decides which VideoAPI to use and extracts other available information
     * such as the video id
     *
     * @param url The URL of the video to be played
     * @throws UnknownVideoSourceException if the video source is not supported
     * @throws BadParameterException if the URL is missing some important parameter
     */
    parseURL(url) {
        logger.debug(`parseURL():> params url=${url}`);
        if (url.hostname === "www.youtube.com") {
            this.api = VideoAPI_1.SupportedVideoAPIs.YouTube;
            const videoId = url.searchParams.get("v");
            if (!videoId) {
                throw new BadParameter_1.BadParameterException(`URL '${url.toString()}' doesn't include the video id. Using video source '${this.api}'. Expected the URL to look like 'https://www.youtube.com/watch?v=d1mX_MBz0HU'`);
            }
            else {
                this.videoId = videoId;
            }
            return this.api;
            //    } else if (url.hostname === "www.vimeo.com") {
            //      return new VimeoVideo();
        }
        else if (url.hostname === "youtu.be") {
            this.api = VideoAPI_1.SupportedVideoAPIs.YouTube;
            const videoId = url.pathname.substr(1); // Omit the first character which is a '/'
            if (!videoId) {
                throw new BadParameter_1.BadParameterException(`URL '${url.toString()}' doesn't include the video id. Using video source '${this.api}'. Expected the URL to look like 'https://youtu.be/d1mX_MBz0HU'`);
            }
            this.videoId = videoId;
        }
        else {
            throw new UnknownVideoSource_1.UnknownVideoSourceException(`Couldn't identify a known video source from URL '${url.toString()}'`);
        }
    }
    getTransitionStatus(funcName) {
        if (funcName in VideoPlayer.actionToTransitionMap) {
            return VideoPlayer.actionToTransitionMap[funcName];
        }
        else {
            throw new BadParameter_1.BadParameterException(`Function '${funcName}' not found in the VideoPlayer.actionToTransitionMap`);
        }
    }
    logCtx(promiseId, ctx, message) {
        let sb = "";
        if (promiseId !== undefined) {
            sb += `Promise:${promiseId}:`;
        }
        if (ctx !== undefined) {
            sb += `${ctx}():> `;
        }
        if (message) {
            sb += message;
        }
        return sb;
    }
    /** Get a random string intended to track down individual promises */
    getPromiseId() {
        return (Math.random() + 1).toString(36).substring(4); // A poor man's random string generator
    }
    queueAction(funcName, callback, ...callbackParams) {
        const promiseId = this.getPromiseId();
        const actionId = `${funcName}:${promiseId}`; //A bit of sugar-coating to make the actionQueue easier to track
        const logFormat = this.logCtx(promiseId, funcName);
        const timeouts = {
            actionQueueInterval: undefined,
            promiseTimeout: undefined,
        };
        const promiseResolvedHandler = (p) => {
            this.transition = undefined; // No longer transitioning anywhere
            window.clearTimeout(timeouts.promiseTimeout);
            const index = this.actionQueue.findIndex((storedActionId) => storedActionId === actionId);
            if (index !== 0) {
                throw new UnknownState_1.UnknownStateException(this.logCtx(promiseId, funcName, "callback that was resolved was not the first action in the queue! index=" + index));
            }
            this.actionQueue.splice(index, 1); //Remove the action matching the current action, this should be the first action
            if (p instanceof Error) {
                logger.trace(`${logFormat}Rejected!`);
                throw p;
            }
            logger.trace(`${logFormat}Resolved`);
            return p;
        };
        // Queue the action
        this.actionQueue.push(actionId);
        return new Promise((resolve, reject) => {
            logger.trace((`${logFormat}New Promise, timeout=${this.promiseSafetyTimeout}`));
            timeouts.promiseTimeout = window.setTimeout(() => {
                const err = new PromiseTimeout_1.PromiseTimeoutException(`${logFormat}Timeouts`);
                logger.error(err, err.stack);
                reject(err);
            }, this.promiseSafetyTimeout);
            //Create a interval to poll the actionQueue
            if (this.actionQueue.length > 1) {
                logger.trace(`${logFormat}Queueing in actionQueue.length=${this.actionQueue.length}`);
                timeouts.actionQueueInterval = window.setInterval(() => {
                    //Check every 50ms if this action is next in queue
                    if (this.actionQueue[0] === actionId) {
                        this.transition = this.getTransitionStatus(funcName); //Start transitioning
                        callback.call(this.videoAPI, promiseId, ...callbackParams).then(resolve, reject);
                        window.clearInterval(timeouts.actionQueueInterval); // Kill itself from within.
                    }
                }, 50);
            }
            else {
                this.transition = this.getTransitionStatus(funcName); //Start transitioning
                callback.call(this.videoAPI, promiseId, ...callbackParams).then(resolve, reject);
            }
        })
            .then(promiseResolvedHandler, promiseResolvedHandler);
    }
}
/** Given actions always trigger then matching transition statuses temporarily, until the Action has been resolved */
VideoPlayer.actionToTransitionMap = {
    loadVideo: VideoAPI_1.VideoPlayerStatus.cueing,
    pauseVideo: VideoAPI_1.VideoPlayerStatus.pausing,
    seekVideo: VideoAPI_1.VideoPlayerStatus.seeking,
    setPlaybackRate: undefined,
    startVideo: VideoAPI_1.VideoPlayerStatus.starting,
    stopVideo: VideoAPI_1.VideoPlayerStatus.stopping,
};
exports.VideoPlayer = VideoPlayer;
//# sourceMappingURL=VideoPlayer.js.map