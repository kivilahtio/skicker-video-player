/// <reference types="youtube" />
/**
 * https://developers.google.com/youtube/iframe_api_reference
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/youtube/index.d.ts is in tsconfig.json to make typings available
 */
import { IVideoAPIOptions, VideoAPI, VideoPlayerStatus } from "../VideoAPI";
/**
 * Implements the YouTube IFrame Video Player API, wrapping it into nice promises
 */
export declare class YouTubeVideo extends VideoAPI {
    private static ytPlayerStates;
    private static ytToVAPIPlayerStates;
    private availablePlaybackRates;
    private options;
    /** Is set when the YTPlayer is created to timeout the creation promise */
    private playerCreateTimeoutter;
    private rootElement;
    private stateChangeHandlers;
    /**
     * Keep track of the promises that are expecting state chabnge handlers to fulfill.
     * Cannot have multiple handlers overlap since YouTube API doesn't distinguish specific events.
     */
    private stateChangeHandlersReservations;
    private ytPlayer;
    private ytPlayerOptions;
    /**
     *
     * @param rootElement Where to inject the IFrame Player?
     * @param ytPlayerOptions id must be given to satisfy Typing, but can be later overloaded with loadVideo()
     */
    constructor(rootElement: HTMLElement, options?: IVideoAPIOptions);
    /**
     * Delete this instance and kill all pending actions
     */
    destroy(): void;
    getDuration(): number | undefined;
    getPlaybackRate(): number | undefined;
    getPosition(): number | undefined;
    getStatus(): VideoPlayerStatus;
    getVolume(): number | undefined;
    loadVideo(actionId: string, videoId: string, options?: IVideoAPIOptions): Promise<YouTubeVideo>;
    /**
     * https://developers.google.com/youtube/iframe_api_reference#pauseVideo
     */
    pauseVideo(actionId: string): Promise<YouTubeVideo>;
    /**
     *  Seeking is a bit tricky since we need to be in the proper state. Otherwise we get strange errors and behaviour from YouTube Player.
     *  If not in playing or paused -states, forcibly move there.
     */
    seekVideo(actionId: string, position: number): Promise<YouTubeVideo>;
    /**
     * Sets the playback rate to the nearest available rate YouTube player supports.
     *
     * @param playbackRate Desired playback rate, if not given, value in this.options.rate is used.
     */
    setPlaybackRate(actionId: string, playbackRate?: number): Promise<YouTubeVideo>;
    /**
     * @param volume Volume level. 0 sets the player muted
     */
    setVolume(volume: number): void;
    startVideo(actionId: string): Promise<YouTubeVideo>;
    stopVideo(actionId: string): Promise<YouTubeVideo>;
    /**
     * Translate a number-based enumeration to a human readable state. Useful for logging.
     * @param state State received from the YT.Player.getPlayerState()
     */
    translatePlayerStateEnumToString(state: YT.PlayerState): string;
    /** Just seek with no safety checks */
    private _seekVideo(actionId, position);
    /**
     * Check if the desired rate is in the list of allowed playback rates, if not, raise an exception
     *
     * @param rate the new playback rate
     * @throws BadPlaybackRateException if the given rate is not on the list of allowed playback rates
     */
    private checkPlaybackRate(rate);
    /**
     * 3. This function creates an <iframe> (and YouTube player) after the API code downloads.
     */
    private createPlayer(actionId, videoId);
    /**
     * 2. This code loads the IFrame Player API code asynchronously.
     * Makes sure the API code is loaded once even when using multiple players on the same document
     */
    private initIFrameAPI(actionId);
    /**
     * Pass in default handlers for various YouTube IFrame Player events if none supplied
     *
     * @param resolve upstream Promise resolver
     * @param reject  upstream Promise resolver
     */
    private injectDefaultHandlers(resolve, reject);
    private translateIVideoAPIOptionsToYTPlayerOptions(opts);
    /** Create a single-use state change handler */
    private setStateChangeHandler(event, actionId, handler);
    /** One must call this to mark a stateChangeHandler resolved */
    private stateChangeHandlerFulfilled(event, actionId);
    private logCtx(actionId?, ctx?, message?);
}
