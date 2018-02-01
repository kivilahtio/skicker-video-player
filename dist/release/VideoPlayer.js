"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const VideoAPI_1 = require("./VideoAPI");
const YouTubeVideo_1 = require("./VideoAPI/YouTubeVideo");
const BadParameter_1 = require("./Exception/BadParameter");
const UnknownVideoSource_1 = require("./Exception/UnknownVideoSource");
const $ = require("jquery");
const skicker_logger_manager_1 = require("skicker-logger-manager");
const logger = skicker_logger_manager_1.LoggerManager.getLogger("Skicker.VideoPlayer");
class VideoPlayer {
    constructor(rootElement, options) {
        this.options = {};
        this.youTubeURLParsingRegexp = /[&?]v=(\w+)(?:\?|$)/;
        logger.debug(`constructor():> params rootElement=${rootElement})`);
        this.rootElement = rootElement;
        if (options) {
            this.options = options;
        }
    }
    /**
     * Release this player and all assets to garbage collection (hopefully)
     */
    destroy() {
        logger.debug("destroy():> ");
        this.videoAPI.destroy();
        this.videoAPI = undefined;
        $(this.rootElement)
            .remove();
        this.rootElement = undefined;
    }
    getStatus() {
        logger.debug(`getStatus():> returning ${this.videoAPI.getStatus()}`);
        return this.videoAPI.getStatus();
    }
    getVideoAPI() {
        logger.debug(`getVideoAPI():> returning ${this.videoAPI}`);
        return this.videoAPI;
    }
    getVideoId() {
        logger.debug(`getVideoId():> returning ${this.videoId}`);
        return this.videoId;
    }
    /**
     * @param id Video id of the remote service
     * @param api A supported video source API name. You can try casting a dynamic variable using "let api: SupportedVideoAPIs = SupportedVideoAPIs['YouTube'];"
     * @param options Options to pass to the video player implementation
     */
    loadVideo(id, api, options) {
        logger.debug(`loadVideo():> params videoId=${id}, api=${api}, options=${options || {}}`);
        if (options) {
            $.extend(true, this.options, options);
        }
        this.videoId = id;
        this.api = api;
        this.videoAPI = this.createVideoAPI();
        return this.videoAPI.loadVideo(this.videoId, this.options);
    }
    /**
     * Loads a video into the given root element from a remote service.
     *
     * @param url Full URL to the video source.
     * @param options Options to pass to the video player implementation
     */
    loadVideoFromURL(url, options) {
        logger.debug(`loadVideoFromURL():> params url=${url}, options=${options || {}}`);
        this.parseURL(url); // Parses the url and stores the videoId and api type to this object.
        return this.loadVideo(this.videoId, this.api, options);
    }
    pauseVideo() {
        return this.videoAPI.pauseVideo();
    }
    setPlaybackRate(rate) {
        return this.videoAPI.setPlaybackRate(rate);
    }
    startVideo() {
        logger.debug("startVideo()");
        return this.videoAPI.startVideo();
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
     * given the URL of the video, decides which VideoAPI to use and extracts other available information
     * such as the video id
     *
     * @param url The URL of the video to be played
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