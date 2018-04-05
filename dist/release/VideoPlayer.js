"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const VideoAPI_1 = require("./VideoAPI");
const YouTubeVideo_1 = require("./VideoAPI/YouTubeVideo");
const BadParameter_1 = require("./Exception/BadParameter");
const UnknownVideoSource_1 = require("./Exception/UnknownVideoSource");
const skicker_logger_manager_1 = require("skicker-logger-manager");
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
        this.options = {};
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
        if (this.rootElement.parentNode) {
            this.rootElement.parentNode.removeChild(this.rootElement);
        }
        this.rootElement = undefined;
    }
    /** Returns the options given */
    getOptions() {
        return this.options;
    }
    /**
     * Gets the status of the current video player implementation
     */
    getStatus() {
        logger.debug(`getStatus():> returning ${this.videoAPI.getStatus()}`);
        return this.videoAPI.getStatus();
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
            return this.videoAPI.loadVideo(this.videoId, this.options);
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
        return this.videoAPI.pauseVideo();
    }
    playOrPauseVideo() {
        return this.loadIfNotYetLoaded()
            .then(() => this.videoAPI.playOrPauseVideo());
    }
    seekVideo(position) {
        return this.loadIfNotYetLoaded()
            .then(() => this.videoAPI.seekVideo(position));
    }
    setPlaybackRate(rate) {
        return this.loadIfNotYetLoaded()
            .then(() => this.videoAPI.setPlaybackRate(rate));
    }
    startVideo() {
        return this.loadIfNotYetLoaded()
            .then(() => this.videoAPI.startVideo());
    }
    stopVideo() {
        logger.debug("stopVideo()");
        return this.videoAPI.stopVideo();
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
     * Loads the VideoPlayer instance for the known URL if missing
     */
    loadIfNotYetLoaded() {
        if (this.videoAPI === undefined) {
            return this.loadVideo();
        }
        return Promise.resolve(this.videoAPI);
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
        else {
            throw new UnknownVideoSource_1.UnknownVideoSourceException(`Couldn't identify a known video source from URL '${url.toString()}'`);
        }
    }
}
exports.VideoPlayer = VideoPlayer;
//# sourceMappingURL=VideoPlayer.js.map