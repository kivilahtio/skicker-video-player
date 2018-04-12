"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * https://developers.google.com/youtube/iframe_api_reference
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/youtube/index.d.ts is in tsconfig.json to make typings available
 */
const VideoAPI_1 = require("../VideoAPI");
const BadPlaybackRate_1 = require("../Exception/BadPlaybackRate");
const PromiseTimeout_1 = require("../Exception/PromiseTimeout");
const UnknownState_1 = require("../Exception/UnknownState");
const skicker_logger_manager_1 = require("skicker-logger-manager");
const StateChangeHandlerReserved_1 = require("../Exception/StateChangeHandlerReserved");
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
        /**
         * How long does each Promise created in this class take to timeout?
         * This is used to protect and catch against leaking promises that never resolve.
         * Time unit in ms
         */
        this.promiseSafetyTimeout = process.env.NODE_ENV === "testing" ? 95000 : 20000;
        this.options = {};
        this.stateChangeHandlers = {};
        /**
         * Keep track of the promises that are expecting state chabnge handlers to fulfill.
         * Cannot have multiple handlers overlap since YouTube API doesn't distinguish specific events.
         */
        this.stateChangeHandlersReservations = {};
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
        this.rootElement.parentNode
            .removeChild(this.rootElement);
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
            Object.assign(this.options, options); // Merge options from the constructor with the new options, atleast the videoId must be given.
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
        const ctx = "pauseVideo";
        logger.debug(`${ctx}():>`);
        if (this.getStatus() === VideoAPI_1.VideoPlayerStatus.ended ||
            this.getStatus() === VideoAPI_1.VideoPlayerStatus.paused) {
            logger.info(`${ctx}():> Video already ${this.getStatus()}`);
            return Promise.resolve(this);
        }
        const promiseId = this.getPromiseId();
        return this.promisify(`${ctx}():> `, (resolve, reject) => {
            this.setStateChangeHandler("paused", promiseId, (ytv, event) => {
                logger.debug(this.logCtx(promiseId, ctx, "stateChangeHandlers.paused():> Play paused"));
                this.stateChangeHandlerFulfilled("paused", promiseId);
                resolve(this);
            });
            this.ytPlayer.pauseVideo();
        }, promiseId);
    }
    playOrPauseVideo() {
        const ctx = "playOrPauseVideo";
        logger.debug(`${ctx}():>`);
        if (this.ytPlayer === undefined) {
            return Promise.reject(new UnknownState_1.UnknownStateException("YouTube Player not instantiated"));
        }
        else if (this.getStatus() === VideoAPI_1.VideoPlayerStatus.playing) {
            return this.pauseVideo();
        }
        else {
            return this.startVideo();
        }
    }
    /**
     *  Seeking is a bit tricky since we need to be in the proper state. Otherwise we get strange errors and behaviour from YouTube Player.
     *  If not in playing or paused -states, forcibly move there.
     */
    seekVideo(position) {
        const ctx = "seekVideo";
        const status = this.getStatus();
        logger.debug(`${ctx}():> position:`, position, "status:", status);
        if (status === VideoAPI_1.VideoPlayerStatus.paused || status === VideoAPI_1.VideoPlayerStatus.playing || status === VideoAPI_1.VideoPlayerStatus.buffering) {
            //These statuses are ok to seek from
            return this._seekVideo(position);
        }
        else {
            if (this.ytPlayer === undefined) {
                return Promise.reject(new UnknownState_1.UnknownStateException("YouTube player not loaded with a video yet. Cannot seek before loading a video."));
            }
            logger.debug(`${ctx}():> VideoPlayer not started yet, so start/stop first to workaround a bug. position:`, position, "status:", status);
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
        const ctx = "setPlaybackRate";
        const rate = playbackRate || this.options.rate;
        if (rate) {
            logger.debug(`${ctx}():> params playbackRate=${playbackRate}, this.options.rate=${this.options.rate}`);
            const oldRate = this.ytPlayer.getPlaybackRate();
            if (rate === oldRate) {
                logger.debug(`${ctx}():> rate=${playbackRate} is the same as the current playback rate.`);
                return Promise.resolve(this);
            }
            const promiseId = this.getPromiseId();
            return this.promisify(ctx, ((resolve, reject) => {
                this.checkPlaybackRate(rate);
                this.setStateChangeHandler("onPlaybackRateChange", promiseId, (ytv, event) => {
                    const newRate = this.ytPlayer.getPlaybackRate();
                    logger.debug(this.logCtx(promiseId, ctx, `stateChangeHandlers.onPlaybackRateChange():> Playback rate changed from ${oldRate} to ${newRate}. Requested ${rate}`));
                    this.stateChangeHandlerFulfilled("onPlaybackRateChange", promiseId);
                    resolve(this);
                });
                this.ytPlayer.setPlaybackRate(rate);
            }), promiseId);
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
        const ctx = "startVideo";
        logger.debug(`${ctx}():>`);
        if (this.getStatus() === VideoAPI_1.VideoPlayerStatus.playing) {
            logger.info(ctx + "():> Video already " + this.getStatus());
            return Promise.resolve(this);
        }
        const promiseId = this.getPromiseId();
        return this.promisify(ctx, ((resolve, reject) => {
            this.setStateChangeHandler("playing", promiseId, (ytv, event) => {
                logger.debug(this.logCtx(promiseId, ctx, "stateChangeHandlers.playing():> Play started"));
                this.stateChangeHandlerFulfilled("playing", promiseId);
                resolve(this);
            });
            this.ytPlayer.playVideo();
        }), promiseId);
    }
    stopVideo() {
        const ctx = "stopVideo";
        logger.debug(`${ctx}():>`);
        const promiseId = this.getPromiseId();
        return this.promisify(ctx, ((resolve, reject) => {
            this.setStateChangeHandler("unstarted", promiseId, (ytv, event) => {
                logger.debug(this.logCtx(promiseId, ctx, `stateChangeHandlers.${this.getStatus()}():> Play unstarted(stopped)`));
                this.stateChangeHandlerFulfilled("unstarted", promiseId);
                resolve(this);
            });
            this.ytPlayer.stopVideo();
        }), promiseId);
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
        const ctx = "_seekVideo";
        logger.debug(`${ctx}():> position:`, position, "status:", oldStatus);
        const promiseId = this.getPromiseId();
        return this.promisify(ctx, (resolve, reject) => {
            // YouTube Player doesn't trigger onStatusChangeHandlers when seeking to an already buffered position in the video, when being paused.
            // Thus we cannot get a confirmation that the seeking was actually done.
            // Use a timeout to check if we are buffering, and if not, mark the seek as complete.
            let cancel;
            if (oldStatus === VideoAPI_1.VideoPlayerStatus.paused ||
                oldStatus === VideoAPI_1.VideoPlayerStatus.playing) {
                cancel = window.setTimeout(() => {
                    if (this.getStatus() !== VideoAPI_1.VideoPlayerStatus.buffering) {
                        logger.debug(this.logCtx(promiseId, ctx, `stateChangeHandlers.${this.getStatus()}():> Position seeked without buffering from a ${oldStatus}-state`));
                        resolve(this);
                    }
                }, 100);
            }
            const func = (ytv, event) => {
                logger.debug(this.logCtx(promiseId, ctx, `stateChangeHandlers.${this.getStatus()}():> Position seeked`));
                this.stateChangeHandlerFulfilled(oldStatus, promiseId);
                if (cancel) {
                    window.clearTimeout(cancel);
                }
                resolve(this);
            };
            this.setStateChangeHandler(oldStatus, promiseId, func);
            this.ytPlayer.seekTo(position, true);
        }, promiseId);
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
        const ctx = "createPlayer";
        if (!this.ytPlayer) {
            const promiseId = this.getPromiseId();
            return this.promisify(ctx, ((resolve, reject) => {
                this.ytPlayerOptions = this.translateIVideoAPIOptionsToYTPlayerOptions(this.options);
                this.ytPlayerOptions.videoId = videoId;
                this.injectDefaultHandlers(resolve, reject); // This promise is resolved from the injected default onReady()-callback
                logger.debug(this.logCtx(promiseId, ctx, `Creating a new player, videoId=${videoId}, elementId=${this.rootElement.id}, ytPlayerOptions=${this.ytPlayerOptions}`));
                this.ytPlayer = new YT.Player(this.rootElement.id, this.ytPlayerOptions);
            }), promiseId);
        }
        else {
            logger.debug(`${ctx}():> Player exists, Promise resolved for videoId=`, videoId);
            return Promise.resolve(this);
        }
    }
    /**
     * 2. This code loads the IFrame Player API code asynchronously.
     * Makes sure the API code is loaded once even when using multiple players on the same document
     */
    initIFrameAPI() {
        const ctx = "initIFrameAPI";
        if (!document.getElementById("youtube-iframe_api")) {
            logger.debug(`${ctx}():>`);
            const tag = document.createElement("script");
            tag.setAttribute("src", "https://www.youtube.com/iframe_api");
            tag.setAttribute("id", "youtube-iframe_api");
            const firstScriptTag = document.getElementsByTagName("script")[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            const promiseId = this.getPromiseId();
            return this.promisify(ctx, (resolve, reject) => {
                // YouTube IFrame API signals intialization is complete
                window.onYouTubeIframeAPIReady = () => {
                    logger.debug(this.logCtx(promiseId, ctx, "onYouTubeIframeAPIReady():> IFrame API loaded, Promise resolved"));
                    resolve(this);
                };
            }, promiseId);
        }
        // The external iframe source code has already been downloaded so skip redownload
        logger.debug("initIFrameAPI():> IFrame API already loaded. Promise resolved");
        return Promise.resolve(this);
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
            clearTimeout(this.playerCreateTimeoutter);
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
    /** Create a single-use state change handler */
    setStateChangeHandler(event, promiseId, handler) {
        if (this.stateChangeHandlersReservations[event] !== undefined) {
            throw new StateChangeHandlerReserved_1.StateChangeHandlerReservedException(this.logCtx(promiseId, event, `Handler already used by Promise=${this.stateChangeHandlersReservations[event]} and waiting for fulfillment from YouTube IFrame Player`));
        }
        this.stateChangeHandlersReservations[event] = promiseId;
        this.stateChangeHandlers[event] = handler;
    }
    /** One must call this to mark a stateChangeHandler resolved */
    stateChangeHandlerFulfilled(event, promiseId) {
        if (this.stateChangeHandlersReservations[event] === undefined ||
            this.stateChangeHandlers[event] === undefined) {
            let err = "";
            if (this.stateChangeHandlersReservations[event] === undefined) {
                err += `No promise reservation for event=${event}. `;
            }
            if (this.stateChangeHandlers[event] === undefined) {
                err += `No handler for event=${event}. `;
            }
            throw new StateChangeHandlerReserved_1.StateChangeHandlerReservedException(this.logCtx(promiseId, event, err));
        }
        this.stateChangeHandlersReservations[event] = undefined;
        this.stateChangeHandlers[event] = undefined;
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
    /**
     * Wraps a promise into identifiable log output and timeout to catch stray promises
     * @param ctx Context describing where this promise is used, like "startVideo"
     * @param promiseId temporarily unique identifier for this Promise, used to help finding out the order of events related
     *                  to a singular Promise from the log output.
     * @param callback The function to promisify
     */
    promisify(ctx, callback, promiseId) {
        if (promiseId === undefined) {
            promiseId = this.getPromiseId();
        }
        const logFormat = this.logCtx(promiseId, ctx);
        let cancel;
        return new Promise((resolve, reject) => {
            logger.trace((`${logFormat}New Promise, timeout=${this.promiseSafetyTimeout}`));
            cancel = window.setTimeout(() => {
                const err = new PromiseTimeout_1.PromiseTimeoutException(`${logFormat}Timeouts`);
                logger.error(err, err.stack);
                reject(err);
            }, this.promiseSafetyTimeout);
            callback(resolve, reject);
        })
            .then((p) => {
            window.clearTimeout(cancel);
            logger.trace(`${logFormat}Resolved`);
            return p;
        });
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