/**
 * Define the video playing sources supported
 */
export declare enum SupportedVideoAPIs {
    YouTube = "YouTube",
}
export declare enum VideoPlayerStatus {
    /** VideoPlayer has been initialized, but the VideoAPI has not been loaded or the VideoAPI is not available */
    notLoaded = "not loaded",
    /** Video is seeking to a new position, this is a transition and the status where this ends is typically started or paused */
    seeking = "seeking",
    /** Play has been stopped. When Video is loaded it becomes cued first, stop only after start. */
    stopped = "stopped",
    /** Video is becoming stopped */
    stopping = "stopping",
    /** Video has reached it's end */
    ended = "ended",
    /** Video has reached it's end */
    ending = "ending",
    /** Video play has been started or resumed */
    started = "started",
    /** Start action in progress, becomes started when the play actually starts/resumes */
    starting = "starting",
    /** Video was started and now is paused. */
    paused = "paused",
    /** Video is becoming paused */
    pausing = "pausing",
    /** Video is being buffered, this is actually a status not a transition! */
    buffering = "buffering",
    /** Video has been initially loaded, eg. the thumbnail image is cued and initial seconds buffered. */
    cued = "cued",
    /** Video is being cued. */
    cueing = "cueing",
}
export declare enum both {
    VideoPlayerStatus = 0,
    VideoPlayerTransition = 1,
}
export interface IVideoAPIOptions {
    /** Automatically start playing when player is ready */
    autoplay?: boolean;
    /** Display controls or hide them */
    controls?: boolean;
    /** estimated end time of the video in seconds */
    end?: number;
    /** Height of the plyer window in pixels */
    height?: number;
    /** loop the video */
    loop?: boolean;
    /** playback rate, eg. 1.0, 0.75, 2.5 */
    rate?: number;
    /** estimated start time of the video in seconds */
    start?: number;
    /** volume from 0-100. 0 is mute */
    volume?: number;
    /** Width of the player window in pixels */
    width?: number;
}
/**
 * Defines the interface for all video playing sources to implement
 */
export declare abstract class VideoAPI {
    private apiUrl;
    private name;
    private videoUrl;
    /** Synchronously check if it would make any difference to pauseVideo() */
    abstract canPause(): boolean;
    /** Synchronously check if it would make any difference to startVideo() */
    abstract canStart(): boolean;
    /** Synchronously check if it would make any difference to stopVideo() */
    abstract canStop(): boolean;
    abstract destroy(): void;
    /** Returns the duration of the video in seconds */
    abstract getDuration(): number | undefined;
    abstract getPlaybackRate(): number | undefined;
    /** Returns the current position in seconds in the currently played video. Decimals denote millisecond precision */
    abstract getPosition(): number | undefined;
    abstract getStatus(): VideoPlayerStatus;
    abstract getVolume(): number | undefined;
    abstract loadVideo(actionId: string, videoId: string, options?: IVideoAPIOptions): Promise<VideoAPI>;
    abstract pauseVideo(actionId: string): Promise<VideoAPI>;
    /**
     * @param position time in seconds where to seek to? Use decimals to reach millisecond precision.
     */
    abstract seekVideo(actionId: string, position: number): Promise<VideoAPI>;
    abstract setPlaybackRate(actionId: string, playbackRate: number): Promise<VideoAPI>;
    abstract setVolume(volume: number): void;
    abstract startVideo(actionId: string): Promise<VideoAPI>;
    abstract stopVideo(actionId: string): Promise<VideoAPI>;
}
