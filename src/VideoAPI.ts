/**
 * Define the video playing sources supported
 */
export enum SupportedVideoAPIs { //Using string-based enums, for easier debugging
  YouTube = "YouTube",
}

/*
 * Statuses the VideoPlayer can be in.
 *
 * stopping/ending/... transitions denote a Promise being resolved. When the corresponding Promise is resolved, status is transitioned to stopped/ended/...
 *
 * YouTube Player updates the status to match the action when the action has been resolved,
 *     eg. started-status only after the start()-action is resolved
 * Need to know also when a transition is happening, to allow timing actions more closely from asynchronous user actions.
 */
export enum VideoPlayerStatus {
  /** VideoPlayer has been initialized, but the VideoAPI has not been loaded or the VideoAPI is not available */
  notLoaded = "not loaded",
  /** Video is seeking to a new position, this is a transition and the status where this ends is typically started or paused */
  seeking =   "seeking",
  /** Play has been stopped. When Video is loaded it becomes cued first, stop only after start. */
  stopped =   "stopped",
  /** Video is becoming stopped */
  stopping =  "stopping",
  /** Video has reached it's end */
  ended =     "ended",
  /** Video has reached it's end */
  ending =    "ending",
  /** Video play has been started or resumed */
  started =   "started",
  /** Start action in progress, becomes started when the play actually starts/resumes */
  starting =  "starting",
  /** Video was started and now is paused. */
  paused =    "paused",
  /** Video is becoming paused */
  pausing =   "pausing",
  /** Video is being buffered, this is actually a status not a transition! */
  buffering = "buffering",
  /** Video has been initially loaded, eg. the thumbnail image is cued and initial seconds buffered. */
  cued =      "cued",
  /** Video is being cued. */
  cueing =    "cueing",
}

export enum both {
  VideoPlayerStatus,
  VideoPlayerTransition,
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
  public abstract getDuration(): number | undefined;
  public abstract getPlaybackRate(): number | undefined;
  /** Returns the current position in seconds in the currently played video. Decimals denote millisecond precision */
  public abstract getPosition(): number | undefined;
  public abstract getStatus(): VideoPlayerStatus;
  public abstract getVolume(): number | undefined;
  public abstract loadVideo(actionId: string, videoId: string, options?: IVideoAPIOptions): Promise<VideoAPI>;
  public abstract pauseVideo(actionId: string): Promise<VideoAPI>;
  /**
   * @param position time in seconds where to seek to? Use decimals to reach millisecond precision.
   */
  public abstract seekVideo(actionId: string, position: number): Promise<VideoAPI>;
  public abstract setPlaybackRate(actionId: string, playbackRate: number): Promise<VideoAPI>;
  public abstract setVolume(volume: number): void;
  public abstract startVideo(actionId: string): Promise<VideoAPI>;
  public abstract stopVideo(actionId: string): Promise<VideoAPI>;
}
