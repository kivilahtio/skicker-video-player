/**
 * Define the video playing sources supported
 */
export enum SupportedVideoAPIs { //Using string-based enums, for easier debugging
  YouTube = "YouTube",
}

/*
 * Currently only VideoAPI.YouTubePlayer uses this mapping table. If other backends are added, generalize mappings.
 */
export enum VideoPlayerStatus {
  unstarted = "unstarted",
  ended =     "ended",
  playing =   "playing",
  paused =    "paused",
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
export abstract class VideoAPI {
  private apiUrl: URL;
  private name: string;
  private videoUrl: URL;

  public abstract destroy(): void;
  /** Returns the duration of the video in seconds */
  public abstract getDuration(): number;
  public abstract getPlaybackRate(): number;
  /** Returns the current position in seconds in the currently played video. Decimals denote millisecond precision */
  public abstract getPosition(): number;
  public abstract getStatus(): VideoPlayerStatus;
  public abstract getVolume(): number;
  public abstract loadVideo(videoId: string, options?: IVideoAPIOptions): Promise<VideoAPI>;
  public abstract pauseVideo(): Promise<VideoAPI>;
  public abstract playOrPauseVideo(): Promise<VideoAPI>;
  /**
   * @param position time in seconds where to seek to? Use decimals to reach millisecond precision.
   */
  public abstract seekVideo(position: number): Promise<VideoAPI>;
  public abstract setPlaybackRate(playbackRate: number): Promise<VideoAPI>;
  public abstract setVolume(volume: number): void;
  public abstract startVideo(): Promise<VideoAPI>;
  public abstract stopVideo(): Promise<VideoAPI>;
}
