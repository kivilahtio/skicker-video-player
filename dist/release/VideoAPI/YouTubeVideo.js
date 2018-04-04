"use strict";
/**
 * https://developers.google.com/youtube/iframe_api_reference
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/youtube/index.d.ts is in tsconfig.json to make typings available
 */
Object.defineProperty(exports, "__esModule", { value: true });
const VideoAPI_1 = require("../VideoAPI");
const BadPlaybackRate_1 = require("../Exception/BadPlaybackRate");
const UnknownState_1 = require("../Exception/UnknownState");
const $ = require("jquery");
const skicker_logger_manager_1 = require("skicker-logger-manager");
const logger = skicker_logger_manager_1.LoggerManager.getLogger("Skicker.VideoAPI.YouTubeVideo");
/**
 * Implements the YouTube IFrame Video Player API, wrapping it into nice promises
 */
class YouTubeVideo extends VideoAPI_1.VideoAPI {
    /**
     *
     * @param rootElement Where to inject the IFrame Player?
     * @param ytPlayerOptions id must be given to satisfy Typing, but can be later overloaded with loadVideo()
     */
    constructor(rootElement, options) {
        super();
        this.options = {};
        this.stateChangeHandlers = {};
        logger.debug(`constructor():> params rootElement=${rootElement}, options=`, options);
        this.rootElement = rootElement;
        if (options) {
            this.options = options;
        }
    }
    /**
     * Delete this instance and kill all pending actions
     */
    destroy() {
        // Try to delete as much about anything that could lead to memory leaks.
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management
        this.ytPlayer.destroy();
        this.ytPlayer = undefined;
        $(this.rootElement)
            .remove();
        this.rootElement = undefined;
        this.ytPlayerOptions = undefined;
        this.options = undefined;
    }
    getDuration() {
        if (this.ytPlayer) {
            return this.ytPlayer.getDuration();
        }
        return undefined;
    }
    getPlaybackRate() {
        return this.ytPlayer.getPlaybackRate();
    }
    getPosition() {
        if (this.ytPlayer) {
            return this.ytPlayer.getCurrentTime();
        }
        return undefined;
    }
    getStatus() {
        const stateName = this.translatePlayerStateEnumToString(this.ytPlayer.getPlayerState());
        return stateName;
    }
    getVolume() {
        return this.ytPlayer.getVolume();
    }
    loadVideo(videoId, options) {
        logger.debug(`loadVideo():> params videoId=${videoId}, options=`, options);
        if (options) {
            $.extend(true, this.options, options); // Merge options from the constructor with the new options, atleast the videoId must be given.
        }
        return this.initIFrameAPI()
            .then((res) => this.createPlayer(videoId))
            .then((res) => {
            if (this.options.volume) {
                this.setVolume(this.options.volume);
            }
            return this.setPlaybackRate();
        });
    }
    /**
     * https://developers.google.com/youtube/iframe_api_reference#pauseVideo
     */
    pauseVideo() {
        logger.debug("pauseVideo():> ");
        if (this.getStatus() === VideoAPI_1.VideoPlayerStatus.ended ||
            this.getStatus() === VideoAPI_1.VideoPlayerStatus.paused) {
            logger.info(`pauseVideo():> Video play already ${this.getStatus()}`);
            return Promise.resolve(this);
        }
        return new Promise((resolve, reject) => {
            this.stateChangeHandlers.paused = (ytv, event) => {
                logger.debug("stateChangeHandlers.paused():> Play paused");
                resolve(this);
            };
            this.ytPlayer.pauseVideo();
        });
    }
    /**
     *  Seeking is a bit tricky since we need to be in the proper state. Otherwise we get strange errors and behaviour from YouTube Player.
     *  If not in playing or paused -states, forcibly move there.
     */
    seekVideo(position) {
        const status = this.getStatus();
        logger.debug("seekVideo():> position:", position, "status:", status);
        if (status === VideoAPI_1.VideoPlayerStatus.paused || status === VideoAPI_1.VideoPlayerStatus.playing || status === VideoAPI_1.VideoPlayerStatus.buffering) {
            //These statuses are ok to seek from
            return this._seekVideo(position);
        }
        else {
            if (this.ytPlayer === undefined) {
                return Promise.reject("YouTube player not loaded with a video yet. Cannot seek before loading a video.");
            }
            //These statuses are not ok. Mute+Play+Pause to get into the desired position to be able to seek.
            const oldVol = this.getVolume();
            this.setVolume(0);
            return this.startVideo()
                .then((player) => this.pauseVideo())
                .then((player) => {
                this.setVolume(oldVol);
                return this._seekVideo(position);
            });
        }
    }
    /**
     * Sets the playback rate to the nearest available rate YouTube player supports.
     *
     * @param playbackRate Desired playback rate, if not given, value in this.options.rate is used.
     */
    setPlaybackRate(playbackRate) {
        const rate = playbackRate || this.options.rate;
        if (rate) {
            logger.debug(`setPlaybackRate():> params playbackRate=${playbackRate}, this.options.rate=${this.options.rate}`);
            const oldRate = this.ytPlayer.getPlaybackRate();
            if (rate === oldRate) {
                logger.debug(`setPlaybackRate():> rate=${playbackRate} is the same as the current playback rate.`);
                return Promise.resolve(this);
            }
            return new Promise((resolve, reject) => {
                this.checkPlaybackRate(rate);
                this.stateChangeHandlers.onPlaybackRateChange = (ytv, event) => {
                    const newRate = this.ytPlayer.getPlaybackRate();
                    logger.debug(`stateChangeHandlers.onPlaybackRateChange():> Playback rate changed from ${oldRate} to ${newRate}. Requested ${rate}`);
                    resolve(this);
                };
                this.ytPlayer.setPlaybackRate(rate);
            });
        }
        else {
            return Promise.resolve(this);
        }
    }
    /**
     * @param volume Volume level. 0 sets the player muted
     */
    setVolume(volume) {
        logger.debug(`setVolume():> param volume=${volume}`);
        if (volume === 0) {
            this.ytPlayer.mute();
        }
        else {
            if (this.ytPlayer.isMuted()) {
                this.ytPlayer.unMute();
            }
            this.ytPlayer.setVolume(volume);
        }
    }
    startVideo() {
        logger.debug("startVideo():> ");
        return new Promise((resolve, reject) => {
            this.stateChangeHandlers.playing = (ytv, event) => {
                logger.debug("stateChangeHandlers.playing():> Play started");
                resolve(this);
            };
            this.ytPlayer.playVideo();
        });
    }
    stopVideo() {
        logger.debug("stopVideo():> ");
        return new Promise((resolve, reject) => {
            this.stateChangeHandlers.unstarted = (ytv, event) => {
                logger.debug("stateChangeHandlers.unstarted():> Play unstarted(stopped)");
                resolve(this);
            };
            this.ytPlayer.stopVideo();
        });
    }
    /**
     * Translate a number-based enumeration to a human readable state. Useful for logging.
     * @param state State received from the YT.Player.getPlayerState()
     */
    translatePlayerStateEnumToString(state) {
        if (YouTubeVideo.ytPlayerStates[state]) {
            return YouTubeVideo.ytPlayerStates[state];
        }
        else {
            const msg = `translatePlayerStateEnumToString():> Unknown state=${state}`;
            logger.fatal(msg);
            throw new UnknownState_1.UnknownStateException(msg);
        }
    }
    /** Just seek with no safety checks */
    _seekVideo(position) {
        const oldStatus = this.getStatus();
        logger.debug("_seekVideo():> position:", position, "status:", this.getStatus());
        return new Promise((resolve, reject) => {
            // YouTube Player doesn't trigger onStatusChangeHandlers when seeking to an already buffered position in the video, when being paused.
            // Thus we cannot get a confirmation that the seeking was actually done.
            // Use a timeout to check if we are buffering, and if not, mark the seek as complete.
            if (oldStatus === VideoAPI_1.VideoPlayerStatus.paused) {
                setTimeout(() => {
                    if (this.getStatus() !== VideoAPI_1.VideoPlayerStatus.buffering) {
                        logger.debug(`stateChangeHandlers.${this.getStatus()}():> Position seeked without buffering from a paused state`);
                        resolve(this);
                    }
                }, 100);
            }
            const func = (ytv, event) => {
                logger.debug(`stateChangeHandlers.${this.getStatus()}():> Position seeked`);
                resolve(this);
            };
            this.stateChangeHandlers[oldStatus] = func;
            this.ytPlayer.seekTo(position, true);
        });
    }
    /**
     * Check if the desired rate is in the list of allowed playback rates, if not, raise an exception
     *
     * @param rate the new playback rate
     * @throws BadPlaybackRateException if the given rate is not on the list of allowed playback rates
     */
    checkPlaybackRate(rate) {
        if (!this.availablePlaybackRates) {
            this.availablePlaybackRates = this.ytPlayer.getAvailablePlaybackRates();
        }
        if (!this.availablePlaybackRates.find((value, index, obj) => value === rate)) {
            const msg = `Trying to set playback rate ${rate}. This is not on the list of allowed playback rates ${this.availablePlaybackRates}`;
            logger.fatal(msg);
            throw new BadPlaybackRate_1.BadPlaybackRateException(msg);
        }
    }
    /**
     * 3. This function creates an <iframe> (and YouTube player) after the API code downloads.
     */
    createPlayer(videoId) {
        if (!this.ytPlayer) {
            logger.debug("createPlayer():> Creating a new player");
            return new Promise((resolve, reject) => {
                this.ytPlayerOptions = this.translateIVideoAPIOptionsToYTPlayerOptions(this.options);
                this.ytPlayerOptions.videoId = videoId;
                this.injectDefaultHandlers(resolve, reject); // This promise is resolved from the injected default onReady()-callback
                logger.debug("createPlayer():> elementId=", this.rootElement.id, "ytPlayerOptions=", this.ytPlayerOptions);
                this.ytPlayer = new YT.Player(this.rootElement.id, this.ytPlayerOptions);
            });
        }
        else {
            logger.debug("createPlayer():> Player exists, Promise resolved");
            return Promise.resolve(this);
        }
    }
    /**
     * 2. This code loads the IFrame Player API code asynchronously.
     * Makes sure the API code is loaded once even when using multiple players on the same document
     */
    initIFrameAPI() {
        logger.debug("initIFrameAPI():> ");
        if (!document.getElementById("youtube-iframe_api")) {
            const tag = document.createElement("script");
            tag.setAttribute("src", "https://www.youtube.com/iframe_api");
            tag.setAttribute("id", "youtube-iframe_api");
            const firstScriptTag = document.getElementsByTagName("script")[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            return new Promise((resolve, reject) => {
                // If script cannot be downloaded and processed in 10s, trigger a timeout and fail the promise.
                const iframeInitializationTimeoutInMillis = 10000;
                const timeoutter = setTimeout(() => {
                    logger.error("onYouTubeIframeAPIReady():> IFrame API loading timed out");
                    reject("Promise timed out");
                }, iframeInitializationTimeoutInMillis);
                // YouTube IFrame API signals intialization is complete
                window.onYouTubeIframeAPIReady = () => {
                    logger.debug("onYouTubeIframeAPIReady():> IFrame API loaded, Promise resolved");
                    clearTimeout(timeoutter);
                    resolve(this);
                };
            });
        }
        // The external iframe source code has already been downloaded so skip redownload
        return new Promise((resolve, reject) => {
            logger.debug("initIFrameAPI():> IFrame API already loaded. Promise resolved");
            resolve(this);
        });
    }
    /**
     * Pass in default handlers for various YouTube IFrame Player events if none supplied
     *
     * @param resolve upstream Promise resolver
     * @param reject  upstream Promise resolver
     */
    injectDefaultHandlers(resolve, reject) {
        if (!this.ytPlayerOptions.events) {
            this.ytPlayerOptions.events = {};
        }
        // The API will call this function when the video player is ready.
        const onPlayerReady = (event) => {
            logger.debug(`onPlayerReady():> params state=${this.translatePlayerStateEnumToString(event.target.getPlayerState())}, Promise resolved`);
            resolve(this);
        };
        // Inject the ready-handler to YT.Events
        if (this.ytPlayerOptions.events.onReady) {
            logger.warn("injectDefaultHandlers():> onPlayerReady-event handler should not be passed, since it is overwritten with Promise functionality.");
        }
        this.ytPlayerOptions.events.onReady = onPlayerReady; // For some reason onPlayerReady is not an accepted event handler?
        // Inject the onPlayerStateChange-handler
        const onPlayerStateChange = (event) => {
            const stateName = this.translatePlayerStateEnumToString(event.target.getPlayerState());
            if (this.stateChangeHandlers[stateName]) {
                logger.debug(`onPlayerStateChange():> params state=${stateName}. Triggering stateChangeHandler`);
                this.stateChangeHandlers[stateName](this, event);
            }
            else {
                logger.trace(`onPlayerStateChange():> No handler for state=${stateName}`);
                // throw new MissingHandlerException(`onPlayerStateChange():> No handler for state=${stateName}`);
            }
        };
        if (!this.ytPlayerOptions.events.onStateChange) {
            this.ytPlayerOptions.events.onStateChange = onPlayerStateChange;
        }
        // Default onPlaybackRateChange handler
        const onPlaybackRateChange = (event) => {
            const stateName = this.translatePlayerStateEnumToString(event.target.getPlayerState());
            if (this.stateChangeHandlers["onPlaybackRateChange"]) {
                this.stateChangeHandlers["onPlaybackRateChange"](this, event);
            }
            else {
                logger.trace(`onPlaybackRateChange():> No handler for state=${stateName}`);
            }
        };
        if (!this.ytPlayerOptions.events.onPlaybackRateChange) {
            this.ytPlayerOptions.events.onPlaybackRateChange = onPlaybackRateChange;
        }
        // Default onError() handler
        const onError = (event) => {
            logger.error("onError():> ", event);
        };
        if (!this.ytPlayerOptions.events.onError) {
            this.ytPlayerOptions.events.onError = onError;
        }
    }
    translateIVideoAPIOptionsToYTPlayerOptions(opts) {
        return {
            width: opts.width || undefined,
            height: opts.height || undefined,
            videoId: "MISSING",
            playerVars: {
                autohide: 1 /* HideAllControls */,
                autoplay: (opts.autoplay) ? 1 /* AutoPlay */ : 0 /* NoAutoPlay */,
                cc_load_policy: 0 /* UserDefault */,
                color: "white",
                controls: (opts.controls) ? 1 /* ShowLoadPlayer */ : 0 /* Hide */,
                disablekb: 1 /* Disable */,
                enablejsapi: 1 /* Enable */,
                end: opts.end || undefined,
                fs: 1 /* Show */,
                hl: undefined,
                iv_load_policy: 3 /* Hide */,
                loop: (opts.loop) ? 1 /* Loop */ : 0 /* SinglePlay */,
                modestbranding: 0 /* Full */,
                playlist: undefined,
                playsinline: 0 /* Fullscreen */,
                rel: 0 /* Hide */,
                showinfo: 1 /* Show */,
                start: opts.start || undefined,
            },
        };
    }
}
// https://developers.google.com/youtube/iframe_api_reference#Events
YouTubeVideo.ytPlayerStates = {
    "-1": "unstarted",
    "0": "ended",
    "1": "playing",
    "2": "paused",
    "3": "buffering",
    "5": "video cued",
    "unstarted": "-1",
    "ended": "0",
    "playing": "1",
    "paused": "2",
    "buffering": "3",
    "video cued": "5",
};
exports.YouTubeVideo = YouTubeVideo;
//# sourceMappingURL=YouTubeVideo.js.map