/**
 * Define the video playing sources supported
 */
export declare enum SupportedVideoAPIs {
    YouTube = "YouTube",
}
export declare enum VideoPlayerStatus {
    /** VideoPlayer has been initialized, but the VideoAPI has not been loaded or the VideoAPI is not available */
    notLoaded = "not loaded",
    unstarted = "unstarted",
    ended = "ended",
    playing = "playing",
    paused = "paused",
    buffering = "buffering",
    videoCued = "video cued",
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
    abstract playOrPauseVideo(actionId: string): Promise<VideoAPI>;
    /**
     * @param position time in seconds where to seek to? Use decimals to reach millisecond precision.
     */
    abstract seekVideo(actionId: string, position: number): Promise<VideoAPI>;
    abstract setPlaybackRate(actionId: string, playbackRate: number): Promise<VideoAPI>;
    abstract setVolume(volume: number): void;
    abstract startVideo(actionId: string): Promise<VideoAPI>;
    abstract stopVideo(actionId: string): Promise<VideoAPI>;
}
