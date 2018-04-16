import { IVideoAPIOptions, SupportedVideoAPIs, VideoAPI, VideoPlayerStatus } from "./VideoAPI";
/**
 * Front-end to interface with multiple video playing sources.
 * Most actions return a Promise. This way it is very easy to handle exceptions and take action when the Promise
 * is resolved (action has succeeded/failed).
 *
 * eg.
 * videoPlayer.startVideo().then(() => {alert("success")}).catch((err) => {alert(err.toString())})
 */
export declare class VideoPlayer {
    /** Given actions always trigger then matching transition statuses temporarily, until the Action has been resolved */
    private static actionToTransitionMap;
    /**
     * How long does each Promise created in this class take to timeout?
     * This is used to protect and catch against leaking promises that never resolve.
     * Time unit in ms
     */
    promiseSafetyTimeout: number;
    /** Queue actions here, prevents for ex. multiple seeks from messing with each other */
    private actionQueue;
    private api;
    private options;
    private rootElement;
    private transition;
    private videoAPI;
    private videoId;
    private youTubeURLParsingRegexp;
    /**
     *
     * @param rootElement Inject the video player here
     * @param options
     */
    constructor(rootElement: HTMLElement, options?: IVideoAPIOptions, url?: URL);
    /**
     * Release this player and all assets to garbage collection (hopefully)
     */
    destroy(): void;
    /**
     * Returns -1 if videoAPI has not been loaded
     */
    getDuration(): number | undefined;
    /** Returns the options given */
    getOptions(): IVideoAPIOptions;
    getPlaybackRate(): number | undefined;
    /**
     * Returns -1 if videoAPI has not been loaded
     */
    getPosition(): number | undefined;
    /** Get the container for this VideoPlayer */
    getRootElement(): HTMLElement;
    /**
     * Gets the status of the current video player implementation or the current transition.
     * Remeber to check for both the status and the transition,
     * eg. started || starting
     */
    getStatus(): VideoPlayerStatus;
    getTransition(): VideoPlayerStatus;
    /**
     * Returns the video API implementation
     */
    getVideoAPI(): VideoAPI;
    /**
     * Returns the ID of the video being played
     */
    getVideoId(): string;
    /**
     * Prepares a video for playing.
     * @param id Video id of the remote service
     * @param api A supported video source API name. You can try casting a dynamic variable using "let api: SupportedVideoAPIs = SupportedVideoAPIs['YouTube'];"
     * @param options Options to pass to the video player implementation
     */
    loadVideo(id?: string, api?: SupportedVideoAPIs, options?: IVideoAPIOptions): Promise<VideoAPI>;
    /**
     * Prepares a video for playing. The video source and id is parsed from the URL.
     *
     * @param url Full URL to the video source.
     * @param options Options to pass to the video player implementation
     * @throws UnknownVideoSourceException if the video source is not supported
     * @throws BadParameterException if the URL is missing some important parameter
     */
    loadVideoFromURL(url: URL, options?: IVideoAPIOptions): Promise<VideoAPI>;
    pauseVideo(): Promise<VideoAPI>;
    playOrPauseVideo(): Promise<VideoAPI>;
    seekVideo(position: number): Promise<VideoAPI>;
    setPlaybackRate(rate: number): Promise<VideoAPI>;
    startVideo(): Promise<VideoAPI>;
    stopVideo(): Promise<VideoAPI>;
    private createVideoAPI();
    /**
     * given the URL of the video, decides which VideoAPI to use and extracts other available information
     * such as the video id
     *
     * @param url The URL of the video to be played
     * @throws UnknownVideoSourceException if the video source is not supported
     * @throws BadParameterException if the URL is missing some important parameter
     */
    private parseURL(url);
    private getTransitionStatus(funcName);
    private logCtx(promiseId?, ctx?, message?);
    /** Get a random string intended to track down individual promises */
    private getPromiseId();
    private queueAction<G>(funcName, callback, ...callbackParams);
}
