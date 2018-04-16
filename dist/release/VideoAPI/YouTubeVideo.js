"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * https://developers.google.com/youtube/iframe_api_reference
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/youtube/index.d.ts is in tsconfig.json to make typings available
 */
const VideoAPI_1 = require("../VideoAPI");
const BadPlaybackRate_1 = require("../Exception/BadPlaybackRate");
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
        if (this.ytPlayer) {
            return this.ytPlayer.getPlaybackRate();
        }
        return undefined;
    }
    getPosition() {
        if (this.ytPlayer) {
            return this.ytPlayer.getCurrentTime();
        }
        return undefined;
    }
    getStatus() {
        if (this.ytPlayer) {
            const stateName = this.translatePlayerStateEnumToString(this.ytPlayer.getPlayerState());
            return stateName;
        }
        return VideoAPI_1.VideoPlayerStatus.notLoaded;
    }
    getVolume() {
        if (this.ytPlayer) {
            return this.ytPlayer.getVolume();
        }
        return undefined;
    }
    loadVideo(actionId, videoId, options) {
        const ctx = "loadVideo";
        logger.debug(this.logCtx(actionId, ctx, `params videoId=${videoId}`));
        if (options) {
            Object.assign(this.options, options); // Merge options from the constructor with the new options, atleast the videoId must be given.
        }
        return this.initIFrameAPI(actionId)
            .then(() => this.createPlayer(actionId, videoId))
            .then(() => this.setPlaybackRate(actionId))
            .then((vapi) => {
            if (this.options.volume) {
                this.setVolume(this.options.volume);
            }
            return this;
        });
    }
    /**
     * https://developers.google.com/youtube/iframe_api_reference#pauseVideo
     */
    pauseVideo(actionId) {
        const ctx = "pauseVideo";
        logger.debug(this.logCtx(actionId, ctx));
        return new Promise((resolve, reject) => {
            const status = this.getStatus();
            if (status === VideoAPI_1.VideoPlayerStatus.ended ||
                status === VideoAPI_1.VideoPlayerStatus.paused ||
                status === VideoAPI_1.VideoPlayerStatus.cued ||
                status === VideoAPI_1.VideoPlayerStatus.stopped) {
                logger.info(this.logCtx(actionId, ctx, `Video already ${status}`));
                return resolve(this);
            }
            this.setStateChangeHandler(VideoAPI_1.VideoPlayerStatus.paused, actionId, (ytv, event) => {
                logger.debug(this.logCtx(actionId, ctx, "stateChangeHandlers.paused():> Play paused"));
                this.stateChangeHandlerFulfilled(VideoAPI_1.VideoPlayerStatus.paused, actionId);
                resolve(this);
            });
            this.ytPlayer.pauseVideo();
        });
    }
    /**
     *  Seeking is a bit tricky since we need to be in the proper state. Otherwise we get strange errors and behaviour from YouTube Player.
     *  If not in playing or paused -states, forcibly move there.
     */
    seekVideo(actionId, position) {
        try {
            const ctx = "seekVideo";
            const status = this.getStatus();
            logger.debug(this.logCtx(actionId, ctx, `position:${position}, status:${status}`));
            if (status === VideoAPI_1.VideoPlayerStatus.paused || status === VideoAPI_1.VideoPlayerStatus.started || status === VideoAPI_1.VideoPlayerStatus.buffering) {
                //These statuses are ok to seek from
                return this._seekVideo(actionId, position);
            }
            else {
                if (this.ytPlayer === undefined) {
                    return Promise.reject(new UnknownState_1.UnknownStateException(this.logCtx(actionId, ctx, "YouTube player not loaded with a video yet. Cannot seek before loading a video.")));
                }
                logger.debug(this.logCtx(actionId, ctx, `VideoPlayer not started yet, so start/stop first to workaround a bug. position:${position}, status:${status}`));
                //These statuses are not ok. Mute+Play+Pause to get into the desired position to be able to seek.
                const oldVol = this.getVolume();
                this.setVolume(0);
                return this.startVideo(actionId)
                    .then((player) => this.pauseVideo(actionId))
                    .then((player) => {
                    this.setVolume(oldVol);
                    return this._seekVideo(actionId, position);
                });
            }
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    /**
     * Sets the playback rate to the nearest available rate YouTube player supports.
     *
     * @param playbackRate Desired playback rate, if not given, value in this.options.rate is used.
     */
    setPlaybackRate(actionId, playbackRate) {
        const ctx = "setPlaybackRate";
        const rate = playbackRate || this.options.rate;
        if (rate) {
            logger.debug(this.logCtx(actionId, ctx, `params playbackRate=${playbackRate}, this.options.rate=${this.options.rate}`));
            const oldRate = this.ytPlayer.getPlaybackRate();
            if (rate === oldRate) {
                logger.debug(this.logCtx(actionId, ctx, `rate=${playbackRate} is the same as the current playback rate.`));
                return Promise.resolve(this);
            }
            return new Promise((resolve, reject) => {
                this.checkPlaybackRate(rate);
                this.setStateChangeHandler("onPlaybackRateChange", actionId, (ytv, event) => {
                    const newRate = this.ytPlayer.getPlaybackRate();
                    logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.onPlaybackRateChange():> Playback rate changed from ${oldRate} to ${newRate}. Requested ${rate}`));
                    this.stateChangeHandlerFulfilled("onPlaybackRateChange", actionId);
                    resolve(this);
                });
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
        if (this.ytPlayer) {
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
        else {
            logger.warn("YT.Player not loaded/ready yet! Cannot set volume.");
        }
    }
    startVideo(actionId) {
        const ctx = "startVideo";
        logger.debug(this.logCtx(actionId, ctx));
        return new Promise((resolve, reject) => {
            if (this.getStatus() === VideoAPI_1.VideoPlayerStatus.started) {
                logger.info(this.logCtx(actionId, ctx, `Video already status=${this.getStatus()}`));
                return resolve(this);
            }
            this.setStateChangeHandler(VideoAPI_1.VideoPlayerStatus.started, actionId, (ytv, event) => {
                logger.debug(this.logCtx(actionId, ctx, "stateChangeHandlers.playing():> Play started"));
                this.stateChangeHandlerFulfilled(VideoAPI_1.VideoPlayerStatus.started, actionId);
                resolve(this);
            });
            this.ytPlayer.playVideo();
        });
    }
    stopVideo(actionId) {
        const ctx = "stopVideo";
        logger.debug(this.logCtx(actionId, ctx));
        return new Promise((resolve, reject) => {
            if (this.getStatus() === VideoAPI_1.VideoPlayerStatus.stopped) {
                logger.info(this.logCtx(actionId, ctx, `Video already status=${this.getStatus()}`));
                return resolve(this);
            }
            this.setStateChangeHandler(VideoAPI_1.VideoPlayerStatus.stopped, actionId, (ytv, event) => {
                logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.${this.getStatus()}():> Play unstarted(stopped)`));
                this.stateChangeHandlerFulfilled(VideoAPI_1.VideoPlayerStatus.stopped, actionId);
                resolve(this);
            });
            this.ytPlayer.stopVideo();
        });
    }
    /**
     * Translate a number-based enumeration to a human readable state. Useful for logging.
     * @param state State received from the YT.Player.getPlayerState()
     */
    translatePlayerStateEnumToString(state) {
        if (YouTubeVideo.ytToVAPIPlayerStates[state]) {
            return YouTubeVideo.ytToVAPIPlayerStates[state];
        }
        else {
            const msg = `translatePlayerStateEnumToString():> Unknown state=${state}`;
            logger.fatal(msg);
            throw new UnknownState_1.UnknownStateException(msg);
        }
    }
    /** Just seek with no safety checks */
    _seekVideo(actionId, position) {
        const oldStatus = this.getStatus();
        const ctx = "_seekVideo";
        logger.debug(this.logCtx(actionId, ctx, `position:${position}, status:${oldStatus}`));
        return new Promise((resolve, reject) => {
            // YouTube Player doesn't trigger onStatusChangeHandlers when seeking to an already buffered position in the video, when being paused.
            // Thus we cannot get a confirmation that the seeking was actually done.
            // Use a timeout to check if we are buffering, and if not, mark the seek as complete.
            let cancel;
            if (oldStatus === VideoAPI_1.VideoPlayerStatus.paused ||
                oldStatus === VideoAPI_1.VideoPlayerStatus.started) {
                cancel = window.setTimeout(() => {
                    if (this.getStatus() !== VideoAPI_1.VideoPlayerStatus.buffering) {
                        logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.${this.getStatus()}():> Position seeked without buffering from a ${oldStatus}-state`));
                        this.stateChangeHandlerFulfilled(oldStatus, actionId);
                        //this.stateChangeHandlerFulfilled(VideoPlayerStatus.ended, actionId); //It is possible to seek to the end
                        resolve(this);
                    }
                }, 500);
            }
            const func = (ytv, event) => {
                logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.${this.getStatus()}():> Position seeked`));
                this.stateChangeHandlerFulfilled(oldStatus, actionId);
                //this.stateChangeHandlerFulfilled(VideoPlayerStatus.ended, actionId); //It is possible to seek to the end
                if (cancel) {
                    window.clearTimeout(cancel);
                }
                resolve(this);
            };
            this.setStateChangeHandler(oldStatus, actionId, func);
            //this.setStateChangeHandler(VideoPlayerStatus.ended, actionId, func); //It is possible to seek to the end
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
    createPlayer(actionId, videoId) {
        const ctx = "createPlayer";
        //YT Player not created yet, and the global IFrame API code has not been loaded yet.
        if (!this.ytPlayer) {
            //Create a reference to kill intervals from within closures that they run.
            const timers = {
                interval: 0,
            };
            //Promisify this
            return new Promise((resolve, reject) => {
                this.ytPlayerOptions = this.translateIVideoAPIOptionsToYTPlayerOptions(this.options);
                this.ytPlayerOptions.videoId = videoId;
                const _createPlayer = () => {
                    this.injectDefaultHandlers(resolve, reject); // This promise is resolved from the injected default onReady()-callback
                    logger.debug(this.logCtx(actionId, ctx, `Creating a new player, videoId=${videoId}, elementId=${this.rootElement.id}, ytPlayerOptions=${this.ytPlayerOptions}`));
                    this.ytPlayer = new YT.Player(this.rootElement.id, this.ytPlayerOptions);
                };
                //Another YouTube IFrame Player has begun the work of loading the source code from YouTube,
                // now this Player instance must wait for the script to complete as well.
                if (document.getElementById("youtube-iframe_api") && !(document.getElementById("youtube-iframe_api").hasAttribute("data-complete"))) {
                    //Keep polling every 100ms if the IFrame sources are loaded
                    timers.interval = window.setInterval(() => {
                        if (document.getElementById("youtube-iframe_api") && document.getElementById("youtube-iframe_api").hasAttribute("data-complete")) {
                            window.clearInterval(timers.interval); //Release the interval so it wont create new players ad infinitum
                            logger.debug(this.logCtx(actionId, ctx, `YouTube IFrame source code available to proceed loading videoId=${videoId}`));
                            _createPlayer();
                        }
                    }, 100);
                    logger.debug(this.logCtx(actionId, ctx, "Another VideoPlayer is loading the YouTube IFrame Player source code, waiting for the source code to become available to proceed loading videoId=" + videoId));
                }
                else {
                    _createPlayer();
                }
            });
        }
        else {
            logger.debug(this.logCtx(actionId, ctx, `Player exists, Promise resolved for videoId=${videoId}`));
            return Promise.resolve(this);
        }
    }
    /**
     * 2. This code loads the IFrame Player API code asynchronously.
     * Makes sure the API code is loaded once even when using multiple players on the same document
     */
    initIFrameAPI(actionId) {
        const ctx = "initIFrameAPI";
        if (!document.getElementById("youtube-iframe_api")) {
            logger.debug(this.logCtx(actionId, ctx));
            const tag = document.createElement("script");
            return new Promise((resolve, reject) => {
                //Create a SCRIPT-tag and make it load the javascript by pointing it to the URL
                tag.setAttribute("src", "https://www.youtube.com/iframe_api");
                tag.setAttribute("id", "youtube-iframe_api");
                const firstScriptTag = document.getElementsByTagName("script")[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                // YouTube IFrame API signals intialization is complete
                window.onYouTubeIframeAPIReady = () => {
                    logger.debug(this.logCtx(actionId, ctx, "onYouTubeIframeAPIReady():> IFrame API loaded, Promise resolved"));
                    tag.setAttribute("data-complete", "1"); //Mark the API loaded globally so other YouTubeVideo instances can proceed getting constructed.
                    resolve(this);
                };
            });
        }
        // The external iframe source code has already been downloaded so skip redownload
        logger.debug(this.logCtx(actionId, ctx, "IFrame API already loaded. Promise resolved"));
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
    setStateChangeHandler(event, actionId, handler) {
        if (this.stateChangeHandlersReservations[event] !== undefined) {
            logger.error(new StateChangeHandlerReserved_1.StateChangeHandlerReservedException(this.logCtx(actionId, event, `Handler already used by Promise=${this.stateChangeHandlersReservations[event]} and waiting for fulfillment from YouTube IFrame Player`)));
        }
        this.stateChangeHandlersReservations[event] = actionId;
        this.stateChangeHandlers[event] = handler;
    }
    /** One must call this to mark a stateChangeHandler resolved */
    stateChangeHandlerFulfilled(event, actionId) {
        if (this.stateChangeHandlersReservations[event] === undefined ||
            this.stateChangeHandlers[event] === undefined) {
            let err = "";
            if (this.stateChangeHandlersReservations[event] === undefined) {
                err += `No promise reservation for event=${event}. `;
            }
            if (this.stateChangeHandlers[event] === undefined) {
                err += `No handler for event=${event}. `;
            }
            logger.error(new StateChangeHandlerReserved_1.StateChangeHandlerReservedException(this.logCtx(actionId, event, err)));
        }
        this.stateChangeHandlersReservations[event] = undefined;
        this.stateChangeHandlers[event] = undefined;
    }
    logCtx(actionId, ctx, message) {
        let sb = "";
        if (actionId !== undefined) {
            sb += `Promise:${actionId}:`;
        }
        if (ctx !== undefined) {
            sb += `${ctx}():> `;
        }
        if (message) {
            sb += message;
        }
        return sb;
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
YouTubeVideo.ytToVAPIPlayerStates = {
    "-1": VideoAPI_1.VideoPlayerStatus.stopped,
    "0": VideoAPI_1.VideoPlayerStatus.ended,
    "1": VideoAPI_1.VideoPlayerStatus.started,
    "2": VideoAPI_1.VideoPlayerStatus.paused,
    "3": VideoAPI_1.VideoPlayerStatus.buffering,
    "5": VideoAPI_1.VideoPlayerStatus.cued,
};
exports.YouTubeVideo = YouTubeVideo;
//# sourceMappingURL=YouTubeVideo.js.map