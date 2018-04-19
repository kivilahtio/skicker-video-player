"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const VideoAPI_1 = require("../VideoAPI");
const skicker_logger_manager_1 = require("skicker-logger-manager");
const StateChangeHandlerReserved_1 = require("../Exception/StateChangeHandlerReserved");
const BadParameter_1 = require("../Exception/BadParameter");
const logger = skicker_logger_manager_1.LoggerManager.getLogger("Skicker.VideoAPI.HTML5Video");
/**
 * List transitions that make no sense. Typically used to detect if we are in a paused state or transitioning into such while trying to pause again.
 * or something similarly useless. Actions can typically be invoked and the Player does it's best to put itself into such a state that the action
 * can be fulfilled.
 * Mainly used to more easily define if we should do some action or not, before invoking it from outside the Player.
 */
const uselessTransitions = new Map()
    .set("pauseVideo", new Map()
    .set(VideoAPI_1.VideoPlayerStatus.notLoaded, true)
    .set(VideoAPI_1.VideoPlayerStatus.paused, true)
    .set(VideoAPI_1.VideoPlayerStatus.pausing, true)
    .set(VideoAPI_1.VideoPlayerStatus.ended, true)
    .set(VideoAPI_1.VideoPlayerStatus.ending, true)
    .set(VideoAPI_1.VideoPlayerStatus.cued, true)
    .set(VideoAPI_1.VideoPlayerStatus.cueing, true)
    .set(VideoAPI_1.VideoPlayerStatus.stopped, true)
    .set(VideoAPI_1.VideoPlayerStatus.stopping, true));
uselessTransitions
    .set("startVideo", new Map()
    .set(VideoAPI_1.VideoPlayerStatus.started, true)
    .set(VideoAPI_1.VideoPlayerStatus.starting, true));
uselessTransitions
    .set("stopVideo", new Map()
    .set(VideoAPI_1.VideoPlayerStatus.notLoaded, true)
    .set(VideoAPI_1.VideoPlayerStatus.cued, true)
    .set(VideoAPI_1.VideoPlayerStatus.cueing, true)
    .set(VideoAPI_1.VideoPlayerStatus.stopped, true)
    .set(VideoAPI_1.VideoPlayerStatus.stopping, true));
/**
 * https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Media_events
 */
var Html5Event;
(function (Html5Event) {
    Html5Event["abort"] = "abort";
    Html5Event["canplay"] = "canplay";
    Html5Event["canplaythrough"] = "canplaythrough";
    Html5Event["durationchange"] = "durationchange";
    Html5Event["emptied"] = "emptied";
    Html5Event["encrypted"] = "encrypted";
    Html5Event["ended"] = "ended";
    Html5Event["error"] = "error";
    Html5Event["interruptbegin"] = "interruptbegin";
    Html5Event["interruptend"] = "interruptend";
    Html5Event["loadeddata"] = "loadeddata";
    Html5Event["loadedmetadata"] = "loadedmetadata";
    Html5Event["loadstart"] = "loadstart";
    Html5Event["mozaudioavailable"] = "mozaudioavailable";
    Html5Event["pause"] = "pause";
    Html5Event["play"] = "play";
    Html5Event["playing"] = "playing";
    Html5Event["progress"] = "progress";
    Html5Event["ratechange"] = "ratechange";
    Html5Event["seeked"] = "seeked";
    Html5Event["seeking"] = "seeking";
    Html5Event["stalled"] = "stalled";
    Html5Event["suspend"] = "suspend";
    Html5Event["timeupdate"] = "timeupdate";
    Html5Event["volumechange"] = "volumechange";
    Html5Event["waiting"] = "waiting";
})(Html5Event = exports.Html5Event || (exports.Html5Event = {}));
;
/**
 * Define HTML5 statuses which update the VideoAPI abstraction statuses.
 * HTML5 Media events are more verbose than is needed by the API abstraction,
 * when listening on the Media events from the Video-element,
 * this mapping table picks the Media events that actually transition this Player to anoter VideoPlayerState
 */
const Html5EventToVideoPlayerStatus = new Map()
    .set(Html5Event.pause, VideoAPI_1.VideoPlayerStatus.paused)
    .set(Html5Event.play, VideoAPI_1.VideoPlayerStatus.starting)
    .set(Html5Event.playing, VideoAPI_1.VideoPlayerStatus.started)
    .set(Html5Event.loadstart, VideoAPI_1.VideoPlayerStatus.cueing)
    .set(Html5Event.canplay, VideoAPI_1.VideoPlayerStatus.cued)
    .set(Html5Event.ended, VideoAPI_1.VideoPlayerStatus.ended)
    .set(Html5Event.seeking, VideoAPI_1.VideoPlayerStatus.seeking);
const videoPlayerStatusToHtml5Event = new Map()
    .set(VideoAPI_1.VideoPlayerStatus.paused, Html5Event.pause)
    .set(VideoAPI_1.VideoPlayerStatus.starting, Html5Event.play)
    .set(VideoAPI_1.VideoPlayerStatus.started, Html5Event.playing)
    .set(VideoAPI_1.VideoPlayerStatus.cueing, Html5Event.loadstart)
    .set(VideoAPI_1.VideoPlayerStatus.cued, Html5Event.canplay)
    .set(VideoAPI_1.VideoPlayerStatus.ended, Html5Event.ended)
    .set(VideoAPI_1.VideoPlayerStatus.seeking, Html5Event.seeking);
/**
 * Wraps the HTML5 Video-tag functionality under this abstraction
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
 * https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Media_events
 *
 * Uses the basic <Video>-tag aka HTMLVideoElement
 */
class HTML5Video extends VideoAPI_1.VideoAPI {
    /**
     *
     * @param rootElement Where to inject the IFrame Player?
     * @param playerOptions id must be given to satisfy Typing, but can be later overloaded with loadVideo()
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
        /** Track the status of this Player, since the Video-element has no internal status-tracker, but it works through emiting events. */
        this.status = VideoAPI_1.VideoPlayerStatus.notLoaded;
        logger.debug(`constructor():> params rootElement=${rootElement}, options=`, options);
        this.rootElement = rootElement;
        if (options) {
            this.options = options;
        }
    }
    canPause() {
        return this.canDoAction("pauseVideo");
    }
    canStart() {
        return this.canDoAction("startVideo");
    }
    canStop() {
        return this.canDoAction("stopVideo");
    }
    /**
     * Delete this instance and kill all pending actions
     */
    destroy() {
        // Try to delete as much about anything that could lead to memory leaks.
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management
        if (this.player) {
            this.player.remove();
        }
        this.options = undefined;
    }
    getDuration() {
        try {
            if (this.player && this.isReady()) {
                const dur = this.player.duration;
                if (isNaN(dur)) {
                    return undefined;
                }
                return dur;
            }
            else {
                return undefined;
            }
        }
        catch (err) {
            throw err;
        }
    }
    getPlaybackRate() {
        try {
            if (this.player) {
                return this.player.playbackRate;
            }
            else {
                return undefined;
            }
        }
        catch (err) {
            throw err;
        }
    }
    getPosition() {
        try {
            if (this.player && this.isReady()) {
                return this.player.currentTime;
            }
            else {
                return undefined;
            }
        }
        catch (err) {
            throw err;
        }
    }
    getStatus() {
        return this.status;
    }
    getVolume() {
        try {
            if (this.player && this.isReady()) {
                return this.player.volume * 100; //HTML5 Video Player volume range is 0-1
            }
            else {
                return undefined;
            }
        }
        catch (err) {
            throw err;
        }
    }
    loadVideo(actionId, videoUrl, options) {
        const ctx = "loadVideo";
        logger.debug(this.logCtx(actionId, ctx, `params videoUrl=${videoUrl}`));
        if (this.rootElement.tagName !== "video") {
            //Copy the attributes of the given element to the new Video element.
            const video = document.createElement("video");
            video.id = this.rootElement.id;
            video.className = this.rootElement.className;
            //Replace the element
            const parent = this.rootElement.parentElement;
            parent.appendChild(video);
            parent.removeChild(this.rootElement);
            this.player = video;
            this.rootElement.remove();
        }
        else {
            this.player = this.rootElement;
        }
        this.injectDefaultHandlers();
        if (options) {
            Object.assign(this.options, options); // Merge options from the constructor with the new options, atleast the videoId must be given.
        }
        this.setIVideoAPIOptionsToVideoAttributes(this.options);
        return new Promise((resolve, reject) => {
            const expectedEvent = videoPlayerStatusToHtml5Event.get(VideoAPI_1.VideoPlayerStatus.cued);
            this.setStateChangeHandler(expectedEvent, actionId, (v, event) => {
                logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.${expectedEvent}():> Video loaded`));
                resolve(this);
            });
            this.player.src = videoUrl; //Trigger the load event
        });
    }
    pauseVideo(actionId) {
        const ctx = "pauseVideo";
        return this._pauseVideo(actionId, ctx);
    }
    seekVideo(actionId, position) {
        try {
            const ctx = "seekVideo";
            const status = this.getStatus();
            logger.debug(this.logCtx(actionId, ctx, `position:${position}, status:${status}`));
            return this._seekVideo(actionId, position);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    /**
     * @param playbackRate Desired playback rate, if not given, value in this.options.rate is used.
     */
    setPlaybackRate(actionId, playbackRate) {
        const ctx = "setPlaybackRate";
        const rate = playbackRate || this.options.rate;
        if (rate) {
            logger.debug(this.logCtx(actionId, ctx, `params playbackRate=${playbackRate}, this.options.rate=${this.options.rate}`));
            const oldRate = this.player.playbackRate;
            if (rate === oldRate) {
                logger.debug(this.logCtx(actionId, ctx, `rate=${playbackRate} is the same as the current playback rate.`));
                return Promise.resolve(this);
            }
            return new Promise((resolve, reject) => {
                this.setStateChangeHandler("ratechange", actionId, (v, event) => {
                    const newRate = this.player.playbackRate;
                    logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.ratechange():> Playback rate changed from ${oldRate} to ${newRate}. Requested ${rate}`));
                    resolve(this);
                });
                this.player.playbackRate = rate;
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
        if (this.player) {
            if (volume === 0) {
                this.player.muted = true;
            }
            else {
                if (this.player.muted) {
                    this.player.muted = false;
                }
                this.player.volume = volume / 100; //HTML5 Video Player volume range is 0-1
            }
        }
        else {
            logger.warn(`Player not loaded! Cannot set volume=${volume}. In status=${status}`);
        }
    }
    startVideo(actionId) {
        const ctx = "startVideo";
        logger.debug(this.logCtx(actionId, ctx));
        return new Promise((resolve, reject) => {
            if (!this.canStart()) {
                logger.info(this.logCtx(actionId, ctx, `Video already status=${this.status}`));
                return resolve(this);
            }
            const expectedEvent = videoPlayerStatusToHtml5Event.get(VideoAPI_1.VideoPlayerStatus.started);
            this.setStateChangeHandler(expectedEvent, actionId, (v, event) => {
                logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.${expectedEvent}():> Play started`));
                resolve(this);
            });
            this.player.play();
        });
    }
    /** HTML5 Video API has no stop-action. */
    stopVideo(actionId) {
        const ctx = "stopVideo";
        return this._pauseVideo(actionId, ctx, true);
    }
    _pauseVideo(actionId, ctx, stopped) {
        logger.debug(this.logCtx(actionId, ctx));
        return new Promise((resolve, reject) => {
            if (!this.canPause()) {
                logger.info(this.logCtx(actionId, ctx, `Video already ${this.getStatus()}`));
                return resolve(this);
            }
            const expectedEvent = videoPlayerStatusToHtml5Event.get(VideoAPI_1.VideoPlayerStatus.paused);
            this.setStateChangeHandler(expectedEvent, actionId, (v, event) => {
                logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.${expectedEvent}():> Play paused ${stopped ? "(HTML5 Video doesn't support stop)" : ""}`));
                resolve(this);
                if (stopped) {
                    this.status = VideoAPI_1.VideoPlayerStatus.stopped; //Cheat a bit to synchronize statuses with video players that support stop
                }
            });
            this.player.pause();
        });
    }
    /** Just seek with no safety checks */
    _seekVideo(actionId, position) {
        const oldStatus = this.getStatus();
        const ctx = "_seekVideo";
        logger.debug(this.logCtx(actionId, ctx, `position:${position}, status:${oldStatus}`));
        return new Promise((resolve, reject) => {
            const func = (v, event) => {
                logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.${this.getStatus()}():> Position seeked`));
                resolve(this);
            };
            this.setStateChangeHandler("canplay", actionId, func); //Firstly seeked-event is triggered, then canplay
            this.player.currentTime = position;
        });
    }
    canDoAction(action) {
        const ac = uselessTransitions.get(action);
        if (ac) {
            if (ac.get(this.getStatus())) {
                return false;
            }
            else {
                return true;
            }
        }
    }
    /**
     * Pass in default handlers for various Player events if none supplied
     *
     * @param resolve upstream Promise resolver
     * @param reject  upstream Promise resolver
     */
    injectDefaultHandlers() {
        const v = this.player;
        //First, seed the player with listeners for all known actions. This is used to understand the player internals better.
        const addDefaultListener = (eventName) => {
            v.addEventListener(eventName, (event) => {
                logger.debug(`eventName=${eventName}, event.type=${event.type} captured`, event);
                //Trigger any attached stateChangeHandlers
                this.triggerStateChangeHandler(event);
            }, true); //Capture before bubbling
        };
        for (var e in Html5Event) {
            if (Html5Event.hasOwnProperty(e) && !/^\d+$/.test(e)) {
                addDefaultListener(e);
            }
        }
    }
    /** Is the Player considered loaded? */
    isReady() {
        if (this.status === VideoAPI_1.VideoPlayerStatus.notLoaded ||
            this.status === VideoAPI_1.VideoPlayerStatus.cueing) {
            return false;
        }
        return true;
    }
    /**
     * Seed the basic attributes for the Player
     * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
     */
    setIVideoAPIOptionsToVideoAttributes(opts) {
        const v = this.player;
        v.autoplay = opts.autoplay ? true : false;
        v.controls = opts.controls ? true : false;
        v.crossOrigin = "anonymous";
        v.loop = opts.loop ? true : false;
        v.muted = opts.volume === 0 ? true : false;
        v.preload = "metadata"; //Changing this to "none" will cause the 'loadeddata'-event to not trigger when video is loaded. Change will require retesting of the event handling subsystem.
        v.height = opts.height;
        v.width = opts.width;
        this.setVolume(opts.volume);
        v.playbackRate = opts.rate || 1;
        v.currentTime = opts.start || 0;
    }
    /** Defensive programming (TM) */
    castToHtml5Event(e) {
        if ((Html5Event[e]) !== undefined) {
            return Html5Event[e];
        }
        else {
            throw new BadParameter_1.BadParameterException(`Unmapped Html5Event '${e}'`);
        }
    }
    /** Triggers and releases a handler for the given event */
    triggerStateChangeHandler(event) {
        //Update player status
        const st = Html5EventToVideoPlayerStatus.get(this.castToHtml5Event(event.type));
        if (st !== undefined) {
            this.status = st;
            logger.info("New status=" + st);
        }
        //Trigger the event handler
        if (this.stateChangeHandlers[event.type]) {
            this.stateChangeHandlers[event.type](this, event);
            this.stateChangeHandlerFulfilled(event);
        }
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
        if (this.stateChangeHandlersReservations[event.type] === undefined ||
            this.stateChangeHandlers[event.type] === undefined) {
            let err = "";
            if (this.stateChangeHandlersReservations[event.type] === undefined) {
                err += `No promise reservation for event=${event.type}. `;
            }
            if (this.stateChangeHandlers[event.type] === undefined) {
                err += `No handler for event=${event.type}. `;
            }
            logger.error(new StateChangeHandlerReserved_1.StateChangeHandlerReservedException(this.logCtx(actionId, event.type, err)));
        }
        this.stateChangeHandlersReservations[event.type] = undefined;
        this.stateChangeHandlers[event.type] = undefined;
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
exports.HTML5Video = HTML5Video;
//# sourceMappingURL=HTML5Video.js.map