"use strict";

import { IVideoAPIOptions, SupportedVideoAPIs, VideoAPI, VideoPlayerStatus } from "./VideoAPI";
import { YouTubeVideo } from "./VideoAPI/YouTubeVideo";

import { BadParameterException } from "./Exception/BadParameter";
import { UnknownVideoSourceException } from "./Exception/UnknownVideoSource";

import * as $ from "jquery";
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
  public constructor(rootElement: HTMLElement, options?: IVideoAPIOptions) {
    logger.debug(`constructor():> params rootElement=${rootElement})`);
    this.rootElement = rootElement;
    if (options) {
      this.options = options;
    }
  }

  /**
   * Release this player and all assets to garbage collection (hopefully)
   */
  public destroy(): void {
    logger.debug("destroy():> ");
    this.videoAPI.destroy();
    this.videoAPI = undefined;
    $(this.rootElement)
    .remove();
    this.rootElement = undefined;
  }

  /** Returns the options given */
  public getOptions(): IVideoAPIOptions {
    return this.options;
  }
  /**
   * Gets the status of the current video player implementation
   */
  public getStatus(): VideoPlayerStatus {
    logger.debug(`getStatus():> returning ${this.videoAPI.getStatus()}`);

    return this.videoAPI.getStatus();
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
  public loadVideo(id: string, api: SupportedVideoAPIs, options?: IVideoAPIOptions): Promise<VideoAPI> {
    logger.debug(`loadVideo():> params videoId=${id}, api=${api}, options=${options || {}}`);

    if (options) {
      $.extend(true, this.options, options);
    }
    this.videoId = id;
    this.api = api;
    this.videoAPI = this.createVideoAPI();

    return this.videoAPI.loadVideo(this.videoId, this.options);
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
    return this.videoAPI.playOrPauseVideo();
  }

  public seekVideo(position: number): Promise<VideoAPI> {
    return this.videoAPI.seekVideo(position);
  }

  public setPlaybackRate(rate: number): Promise<VideoAPI> {
    return this.videoAPI.setPlaybackRate(rate);
  }

  public startVideo(): Promise<VideoAPI> {
    logger.debug("startVideo()");

    return this.videoAPI.startVideo();
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

    } else {
      throw new UnknownVideoSourceException(`Couldn't identify a known video source from URL '${url.toString()}'`);
    }
  }
}

