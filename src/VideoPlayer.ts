"use strict";

import { IVideoAPIOptions, SupportedVideoAPIs, VideoAPI, VideoPlayerStatus } from "./VideoAPI";
import { YouTubeVideo } from "./VideoAPI/YouTubeVideo";

import { BadParameterException } from "./Exception/BadParameter";
import { UnknownVideoSourceException } from "./Exception/UnknownVideoSource";

import * as $ from "jquery";
import { log4javascript, LoggerManager } from "skicker-logger-manager";
const logger: log4javascript.Logger = LoggerManager.getLogger("Skicker.VideoPlayer");

export class VideoPlayer {

  private api: SupportedVideoAPIs;
  private options: IVideoAPIOptions = {};
  private rootElement: Element;
  private videoAPI: VideoAPI;
  private videoId: string;
  private youTubeURLParsingRegexp: RegExp = /[&?]v=(\w+)(?:\?|$)/;

  public constructor(rootElement: Element, options?: IVideoAPIOptions) {
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

  public getStatus(): VideoPlayerStatus {
    logger.debug(`getStatus():> returning ${this.videoAPI.getStatus()}`);

    return this.videoAPI.getStatus();
  }
  public getVideoAPI(): VideoAPI {
    logger.debug(`getVideoAPI():> returning ${this.videoAPI}`);

    return this.videoAPI;
  }
  public getVideoId(): string {
    logger.debug(`getVideoId():> returning ${this.videoId}`);

    return this.videoId;
  }

  /**
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
   * Loads a video into the given root element from a remote service.
   *
   * @param url Full URL to the video source.
   * @param options Options to pass to the video player implementation
   */
  public loadVideoFromURL(url: URL, options?: IVideoAPIOptions): Promise<VideoAPI> {
    logger.debug(`loadVideoFromURL():> params url=${url}, options=${options || {}}`);

    this.parseURL(url); // Parses the url and stores the videoId and api type to this object.

    return this.loadVideo(this.videoId, this.api, options);
  }

  public pauseVideo(): Promise<VideoAPI> {
    return this.videoAPI.pauseVideo();
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

