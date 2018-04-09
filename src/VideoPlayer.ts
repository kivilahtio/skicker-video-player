"use strict";

import { IVideoAPIOptions, SupportedVideoAPIs, VideoAPI, VideoPlayerStatus } from "./VideoAPI";
import { YouTubeVideo } from "./VideoAPI/YouTubeVideo";

import { BadParameterException } from "./Exception/BadParameter";
import { UnknownVideoSourceException } from "./Exception/UnknownVideoSource";

import { log4javascript, LoggerManager } from "skicker-logger-manager";
const logger: log4javascript.Logger = LoggerManager.getLogger("Skicker.VideoPlayer");

/**
 * Front-end to interface with multiple video playing sources.
 * Most actions return a Promise. This way it is very easy to handle exceptions and take action when the Promise
 * is resolved (action has succeeded/failed).
 *
 * eg.
 * videoPlayer.startVideo().then(() => {alert("success")}).catch((err) => {alert(err.toString())})
 */
export class VideoPlayer {

  private api: SupportedVideoAPIs;
  private options: IVideoAPIOptions = {};
  private rootElement: HTMLElement;
  private videoAPI: VideoAPI;
  private videoId: string;
  private youTubeURLParsingRegexp: RegExp = /[&?]v=(\w+)(?:\?|$)/;

  /**
   *
   * @param rootElement Inject the video player here
   * @param options
   */
  public constructor(rootElement: HTMLElement, options?: IVideoAPIOptions, url?: URL) {
    logger.debug(`constructor():> params rootElement=${rootElement})`);
    this.rootElement = rootElement;
    if (options) {
      this.options = options;
    }
    if (url) {
      this.parseURL(url);
    }
  }

  /**
   * Release this player and all assets to garbage collection (hopefully)
   */
  public destroy(): void {
    logger.debug("destroy():> ");
    this.videoAPI.destroy();
    this.videoAPI = undefined;
    if (this.rootElement.parentNode) {
      this.rootElement.parentNode.removeChild(this.rootElement);
    }
    this.rootElement = undefined;
  }

  /**
   * Returns -1 if videoAPI has not been loaded
   */
  public getDuration(): number {
    if (this.videoAPI) {
      return this.videoAPI.getDuration();
    }

    return -1;
  }

  /** Returns the options given */
  public getOptions(): IVideoAPIOptions {
    return this.options;
  }

  /**
   * Returns -1 if videoAPI has not been loaded
   */
  public getPosition(): number {
    if (this.videoAPI) {
      return this.videoAPI.getPosition();
    }

    return -1;
  }

  /**
   * Gets the status of the current video player implementation
   */
  public getStatus(): VideoPlayerStatus {
    if (this.videoAPI) {
      logger.debug(`getStatus():> returning ${this.videoAPI.getStatus()}`);
      return this.videoAPI.getStatus();
    }

    logger.debug(`getStatus():> returning ${VideoPlayerStatus.notLoaded}`);
    return VideoPlayerStatus.notLoaded;
  }

  /**
   * Returns the video API implementation
   */
  public getVideoAPI(): VideoAPI {
    return this.videoAPI;
  }

  /**
   * Returns the ID of the video being played
   */
  public getVideoId(): string {
    logger.debug(`getVideoId():> returning ${this.videoId}`);

    return this.videoId;
  }

  /**
   * Prepares a video for playing.
   * @param id Video id of the remote service
   * @param api A supported video source API name. You can try casting a dynamic variable using "let api: SupportedVideoAPIs = SupportedVideoAPIs['YouTube'];"
   * @param options Options to pass to the video player implementation
   */
  public loadVideo(id?: string, api?: SupportedVideoAPIs, options?: IVideoAPIOptions): Promise<VideoAPI> {
    logger.debug(`loadVideo():> params videoId=${id}, api=${api}, options=${options || {}}`);

    if (options) {
      Object.assign(this.options, options);
    }
    if (id) {
      this.videoId = id;
    }
    if (this.videoId === undefined) {
      Promise.reject(new BadParameterException("videoId is undefined. You must pass it here or in the constructor."));
    }
    if (api) {
      this.api = api;
    }
    if (this.api === undefined) {
      Promise.reject(new BadParameterException("video API is undefined. You must pass it here or in the constructor." +
                                               "This is typically parsed from the base of the video url."));
    }

    if (this.videoAPI === undefined) {
      this.videoAPI = this.createVideoAPI();

      return this.videoAPI.loadVideo(this.videoId, this.options);
    } else {
      logger.debug(`loadVideo():> Video already loaded, not loading it again, for videoId=${this.videoId}, api=${this.api}`);

      return Promise.resolve(this.videoAPI);
    }
  }

  /**
   * Prepares a video for playing. The video source and id is parsed from the URL.
   *
   * @param url Full URL to the video source.
   * @param options Options to pass to the video player implementation
   * @throws UnknownVideoSourceException if the video source is not supported
   * @throws BadParameterException if the URL is missing some important parameter
   */
  public loadVideoFromURL(url: URL, options?: IVideoAPIOptions): Promise<VideoAPI> {
    logger.debug(`loadVideoFromURL():> params url=${url}, options=${options || {}}`);

    this.parseURL(url); // Parses the url and stores the videoId and api type to this object.

    return this.loadVideo(this.videoId, this.api, options);
  }

  public pauseVideo(): Promise<VideoAPI> {
    return this.videoAPI.pauseVideo();
  }

  public playOrPauseVideo(): Promise<VideoAPI> {
    return this.loadIfNotYetLoaded()
    .then(() => this.videoAPI.playOrPauseVideo());
  }

  public seekVideo(position: number): Promise<VideoAPI> {
    return this.loadIfNotYetLoaded()
    .then(() => this.videoAPI.seekVideo(position));
  }

  public setPlaybackRate(rate: number): Promise<VideoAPI> {
    return this.loadIfNotYetLoaded()
    .then(() => this.videoAPI.setPlaybackRate(rate));
  }

  public startVideo(): Promise<VideoAPI> {
    return this.loadIfNotYetLoaded()
    .then(() => this.videoAPI.startVideo());
  }

  public stopVideo(): Promise<VideoAPI> {
    logger.debug("stopVideo()");

    return this.videoAPI.stopVideo();
  }

  private createVideoAPI(): VideoAPI {
    logger.debug("selectVideoAPI():> ");

    if (this.api === SupportedVideoAPIs.YouTube) {

      return new YouTubeVideo(this.rootElement, this.options);

//    else if (api === SupportedVideoAPIs.Vimeo) {
//      return new VimeoVideo();

    } else {
      throw new UnknownVideoSourceException(`Video source '${this.api}' is not supported`);
    }
  }

  /**
   * Loads the VideoPlayer instance for the known URL if missing
   */
  private loadIfNotYetLoaded(): Promise<VideoAPI> {
    if (this.videoAPI === undefined) {
      return this.loadVideo();
    }

    return Promise.resolve(this.videoAPI);
  }

  /**
   * given the URL of the video, decides which VideoAPI to use and extracts other available information
   * such as the video id
   *
   * @param url The URL of the video to be played
   * @throws UnknownVideoSourceException if the video source is not supported
   * @throws BadParameterException if the URL is missing some important parameter
   */
  private parseURL(url: URL): SupportedVideoAPIs {
    logger.debug(`parseURL():> params url=${url}`);

    if (url.hostname === "www.youtube.com") {
      this.api = SupportedVideoAPIs.YouTube;

      const videoId: string = url.searchParams.get("v");
      if (! videoId) {
        throw new BadParameterException(
          `URL '${url.toString()}' doesn't include the video id. Using video source '${this.api}'. Expected the URL to look like 'https://www.youtube.com/watch?v=d1mX_MBz0HU'`);
      } else {
        this.videoId = videoId;
      }

      return this.api;

//    } else if (url.hostname === "www.vimeo.com") {
//      return new VimeoVideo();

    } else if (url.hostname === "youtu.be") {
      this.api = SupportedVideoAPIs.YouTube;
      const videoId: string = url.pathname.substr(1); // Omit the first character which is a '/'
      if (! videoId) {
        throw new BadParameterException(
          `URL '${url.toString()}' doesn't include the video id. Using video source '${this.api}'. Expected the URL to look like 'https://youtu.be/d1mX_MBz0HU'`);
      }
      this.videoId = videoId;

    } else {
      throw new UnknownVideoSourceException(`Couldn't identify a known video source from URL '${url.toString()}'`);
    }
  }
}

