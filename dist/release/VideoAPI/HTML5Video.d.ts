import { IVideoAPIOptions, VideoAPI, VideoPlayerStatus } from "../VideoAPI";
/**
 * https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Media_events
 */
export declare enum Html5Event {
    abort = "abort",
    canplay = "canplay",
    canplaythrough = "canplaythrough",
    durationchange = "durationchange",
    emptied = "emptied",
    encrypted = "encrypted",
    ended = "ended",
    error = "error",
    interruptbegin = "interruptbegin",
    interruptend = "interruptend",
    loadeddata = "loadeddata",
    loadedmetadata = "loadedmetadata",
    loadstart = "loadstart",
    mozaudioavailable = "mozaudioavailable",
    pause = "pause",
    play = "play",
    playing = "playing",
    progress = "progress",
    ratechange = "ratechange",
    seeked = "seeked",
    seeking = "seeking",
    stalled = "stalled",
    suspend = "suspend",
    timeupdate = "timeupdate",
    volumechange = "volumechange",
    waiting = "waiting",
}
/**
 * Wraps the HTML5 Video-tag functionality under this abstraction
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
 * https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Media_events
 *
 * Uses the basic <Video>-tag aka HTMLVideoElement
 */
export declare class HTML5Video extends VideoAPI {
    private options;
    private player;
    private rootElement;
    private stateChangeHandlers;
    /**
     * Keep track of the promises that are expecting state chabnge handlers to fulfill.
     * Cannot have multiple handlers overlap since YouTube API doesn't distinguish specific events.
     */
    private stateChangeHandlersReservations;
    /** Track the status of this Player, since the Video-element has no internal status-tracker, but it works through emiting events. */
    private status;
    /**
     *
     * @param rootElement Where to inject the IFrame Player?
     * @param playerOptions id must be given to satisfy Typing, but can be later overloaded with loadVideo()
     */
    constructor(rootElement: HTMLElement, options?: IVideoAPIOptions);
    canPause(): boolean;
    canStart(): boolean;
    canStop(): boolean;
    /**
     * Delete this instance and kill all pending actions
     */
    destroy(): void;
    getDuration(): number | undefined;
    getPlaybackRate(): number | undefined;
    getPosition(): number | undefined;
    getStatus(): VideoPlayerStatus;
    getVolume(): number | undefined;
    loadVideo(actionId: string, videoUrl: string, options?: IVideoAPIOptions): Promise<HTML5Video>;
    pauseVideo(actionId: string): Promise<HTML5Video>;
    seekVideo(actionId: string, position: number): Promise<HTML5Video>;
    /**
     * @param playbackRate Desired playback rate, if not given, value in this.options.rate is used.
     */
    setPlaybackRate(actionId: string, playbackRate?: number): Promise<HTML5Video>;
    /**
     * @param volume Volume level. 0 sets the player muted
     */
    setVolume(volume: number): void;
    startVideo(actionId: string): Promise<HTML5Video>;
    /** HTML5 Video API has no stop-action. */
    stopVideo(actionId: string): Promise<HTML5Video>;
    private _pauseVideo(actionId, ctx, stopped?);
    /** Just seek with no safety checks */
    private _seekVideo(actionId, position);
    private canDoAction(action);
    /**
     * Pass in default handlers for various Player events if none supplied
     *
     * @param resolve upstream Promise resolver
     * @param reject  upstream Promise resolver
     */
    private injectDefaultHandlers();
    /** Is the Player considered loaded? */
    private isReady();
    /**
     * Seed the basic attributes for the Player
     * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
     */
    private setIVideoAPIOptionsToVideoAttributes(opts);
    /** Defensive programming (TM) */
    private castToHtml5Event(e);
    /** Triggers and releases a handler for the given event */
    private triggerStateChangeHandler(event);
    /** Create a single-use state change handler */
    private setStateChangeHandler(event, actionId, handler);
    /** One must call this to mark a stateChangeHandler resolved */
    private stateChangeHandlerFulfilled(event, actionId?);
    private logCtx(actionId?, ctx?, message?);
}
