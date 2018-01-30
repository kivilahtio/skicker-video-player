/**
 * Define the video playing sources supported
 */
export enum SupportedVideoAPIs { //Using string-based enums, for easier debugging
  YouTube = "YouTube",
}

/**
 * Defines the interface for all video playing sources to implement
 */
export abstract class VideoAPI {
  private apiUrl: URL;
  private name: string;
  private videoUrl: URL;

  public abstract loadVideo(id: string): Promise<VideoAPI>;
  public abstract startVideo(): Promise<VideoAPI>;
  public abstract stopVideo(): Promise<VideoAPI>;
}
