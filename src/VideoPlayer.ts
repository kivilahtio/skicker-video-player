"use strict";

import { IVideoAPIOptions, SupportedVideoAPIs, VideoAPI, VideoPlayerStatus } from "./VideoAPI";
import { YouTubeVideo } from "./VideoAPI/YouTubeVideo";

import { BadParameterException } from "./Exception/BadParameter";
import { UnknownVideoSourceException } from "./Exception/UnknownVideoSource";

import { log4javascript, LoggerManager } from "skicker-logger-manager";
import { PromiseTimeoutException } from "./Exception/PromiseTimeout";
import { UnknownStateException } from "./Exception/UnknownState";
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

  /**
   * How long does each Promise created in this class take to timeout?
   * This is used to protect and catch against leaking promises that never resolve.
   * Time unit in ms
   */
  public promiseSafetyTimeout: number = process.env.NODE_ENV === "testing" ? 9500 : 20000;

  /** Queue actions here, prevents for ex. multiple seeks from messing with each other */
  private actionQueue: string[] = new Array<string>();
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
    if (this.rootElement) {
      this.rootElement.remove();
    }
    this.rootElement = undefined;
  }

  /**
   * Returns -1 if videoAPI has not been loaded
   */
  public getDuration(): number | undefined {
    if (this.videoAPI) {
      return this.videoAPI.getDuration();
    }

    return undefined;
  }

  /** Returns the options given */
  public getOptions(): IVideoAPIOptions {
    return this.options;
  }

  public getPlaybackRate(): number | undefined {
    if (this.videoAPI) {
      return this.videoAPI.getPlaybackRate();
    }

    return undefined;
  }

  /**
   * Returns -1 if videoAPI has not been loaded
   */
  public getPosition(): number | undefined {
    if (this.videoAPI) {
      return this.videoAPI.getPosition();
    }
    return undefined;
  }

  /** Get the container for this VideoPlayer */
  public getRootElement(): HTMLElement {
    return this.rootElement;
  }

  /**
   * Gets the status of the current video player implementation
   */
  public getStatus(): VideoPlayerStatus {
    if (this.videoAPI) {
      return this.videoAPI.getStatus();
    }
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

      return this.queueAction("loadVideo", this.videoAPI.loadVideo, this.videoId, this.options);
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
    if (this.videoAPI === undefined) {
      this.loadVideo(); //Queue a load action
      return this.queueAction("pauseVideo", this.videoAPI.pauseVideo);
    }

    return this.queueAction("pauseVideo", this.videoAPI.pauseVideo);
  }

  public playOrPauseVideo(): Promise<VideoAPI> {
    if (this.videoAPI === undefined) {
      this.loadVideo();
      return this.queueAction("playOrPauseVideo", this.videoAPI.playOrPauseVideo);
    }

    return this.queueAction("playOrPauseVideo", this.videoAPI.playOrPauseVideo);
  }

  public seekVideo(position: number): Promise<VideoAPI> {
    if (this.videoAPI === undefined) {
      this.loadVideo();
      return this.queueAction("seekVideo", this.videoAPI.seekVideo, position);
    }

    return this.queueAction("seekVideo", this.videoAPI.seekVideo, position);
  }

  public setPlaybackRate(rate: number): Promise<VideoAPI> {
    if (this.videoAPI === undefined) {
      this.loadVideo();
      return this.queueAction("setPlaybackRate", this.videoAPI.setPlaybackRate, rate);
    }

    return this.queueAction("setPlaybackRate", this.videoAPI.setPlaybackRate, rate)
  }

  public startVideo(): Promise<VideoAPI> {
    if (this.videoAPI === undefined) {
      this.loadVideo();
      return this.queueAction("startVideo", this.videoAPI.startVideo);
    }

    return this.queueAction("startVideo", this.videoAPI.startVideo);
  }

  public stopVideo(): Promise<VideoAPI> {
    if (this.videoAPI === undefined) {
      this.loadVideo();
      return this.queueAction("stopVideo", this.videoAPI.stopVideo);
    }

    return this.queueAction("stopVideo", this.videoAPI.stopVideo);
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

  private logCtx(promiseId?: string, ctx?: string, message?: string): string {
    let sb = "";
    if (promiseId !== undefined) {
      sb += `Promise:${promiseId}:`;
    }
    if (ctx !== undefined) {
      sb += `${ctx}():> `;
    }
    if (message) {
      sb += message;
    }

    return sb;
  }
  /** Get a random string intended to track down individual promises */
  private getPromiseId(): string {
    return (Math.random() + 1).toString(36).substring(4); // A poor man's random string generator
  }
  private queueAction<G>(ctx: string, callback: (...any: any[]) => Promise<G>, ...callbackParams: any[]): Promise<G> {

    const promiseId = this.getPromiseId();
    const actionId = ctx+promiseId; //A bit of sugar-coating to make the actionQueue easier to track

    const logFormat: string = this.logCtx(promiseId, ctx);

    const timeouts: any = { // Store timeouts in an object so the interval can see itself from within :)
      actionQueueInterval: undefined,
      promiseTimeout: undefined,
    };

    const promiseResolvedHandler = (p: G) => {
      window.clearTimeout(timeouts.promiseTimeout);

      const index: number = this.actionQueue.findIndex((storedActionId: string) => storedActionId === actionId);
      if (index !== 0) {
        throw new UnknownStateException(this.logCtx(promiseId, ctx, "callback that was resolved was not the first action in the queue! index="+index));
      }
      this.actionQueue.splice(index, 1); //Remove the action matching the current action, this should be the first action

      if (p instanceof Error) {
        logger.trace(`${logFormat}Rejected!`);
        throw p;
      }
      logger.trace(`${logFormat}Resolved`);

      return p;
    };

    // Queue the action
    this.actionQueue.push(actionId);
    return new Promise<G>((resolve, reject) => {
      logger.trace((`${logFormat}New Promise, timeout=${this.promiseSafetyTimeout}`));
      timeouts.promiseTimeout = window.setTimeout(() => {
        const err: Error = new PromiseTimeoutException(`${logFormat}Timeouts`);
        logger.error(err, err.stack);
        reject(err);
      }, this.promiseSafetyTimeout);

      //Create a interval to poll the actionQueue
      if (this.actionQueue.length > 1) {
        logger.trace(`${logFormat}Queueing in actionQueue.length=${this.actionQueue.length}`);
        timeouts.actionQueueInterval = window.setInterval(() => {
          //Check every 50ms if this action is next in queue
          if (this.actionQueue[0] === actionId) {
            callback.call(this.videoAPI, promiseId, ...callbackParams).then(resolve, reject);
            window.clearInterval(timeouts.actionQueueInterval); // Kill itself from within.
          }
        }, 50);
      } else {
        callback.call(this.videoAPI, promiseId, ...callbackParams).then(resolve, reject);
      }
    })
    .then(promiseResolvedHandler, promiseResolvedHandler);
  }
}

