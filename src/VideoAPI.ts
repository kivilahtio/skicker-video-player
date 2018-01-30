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

/**
 * Defines the interface for all video playing sources to implement
 */
export abstract class VideoAPI {
  private apiUrl: URL;
  private name: string;
  private videoUrl: URL;

  public abstract getStatus(): VideoPlayerStatus;
  public abstract loadVideo(id: string): Promise<VideoAPI>;
  public abstract startVideo(): Promise<VideoAPI>;
  public abstract stopVideo(): Promise<VideoAPI>;
}
