/**
 * Define the video playing sources supported
 */
export declare enum SupportedVideoAPIs {
    YouTube = "YouTube",
}
export declare enum VideoPlayerStatus {
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
    abstract getPlaybackRate(): number;
    abstract getStatus(): VideoPlayerStatus;
    abstract getVolume(): number;
    abstract loadVideo(videoId: string, options?: IVideoAPIOptions): Promise<VideoAPI>;
    abstract pauseVideo(): Promise<VideoAPI>;
    abstract setPlaybackRate(playbackRate: number): Promise<VideoAPI>;
    abstract setVolume(volume: number): void;
    abstract startVideo(): Promise<VideoAPI>;
    abstract stopVideo(): Promise<VideoAPI>;
}
