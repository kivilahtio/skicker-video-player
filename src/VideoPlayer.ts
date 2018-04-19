"use strict";

import { IVideoAPIOptions, SupportedVideoAPIs, VideoAPI, VideoPlayerStatus } from "./VideoAPI";
import { YouTubeVideo } from "./VideoAPI/YouTubeVideo";

import { BadParameterException } from "./Exception/BadParameter";
import { UnknownVideoSourceException } from "./Exception/UnknownVideoSource";

import { log4javascript, LoggerManager } from "skicker-logger-manager";
import { PromiseTimeoutException } from "./Exception/PromiseTimeout";
import { UnknownStateException } from "./Exception/UnknownState";
import { HTML5Video } from "./VideoAPI/HTML5Video";
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

  /** Given actions always trigger then matching transition statuses temporarily, until the Action has been resolved */
  private static actionToTransitionMap: {[key: string]: VideoPlayerStatus} = {
    loadVideo: VideoPlayerStatus.cueing,
    pauseVideo: VideoPlayerStatus.pausing,
    seekVideo: VideoPlayerStatus.seeking,
    setPlaybackRate: undefined,
    startVideo: VideoPlayerStatus.starting,
    stopVideo: VideoPlayerStatus.stopping,
  };

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
  private transition: VideoPlayerStatus | undefined = undefined;
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

  public canPause(): boolean {
    if (this.videoAPI) {
      return this.videoAPI.canPause();
    }
    return false;
  }
  public canStart(): boolean {
    if (this.videoAPI) {
      return this.videoAPI.canStart();
    }
    return true; //We can start even when videoAPI is not loaded, then the video is loaded transparently.
  }
  public canStop(): boolean {
    if (this.videoAPI) {
      return this.videoAPI.canStop();
    }
    return false;
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
   * Gets the status of the current video player implementation or the current transition.
   * Remeber to check for both the status and the transition,
   * eg. started || starting
   */
  public getStatus(): VideoPlayerStatus {
    if (this.transition !== undefined) {
      return this.transition;
    }
    if (this.videoAPI) {
      return this.videoAPI.getStatus();
    }
    return VideoPlayerStatus.notLoaded;
  }

  public getTransition(): VideoPlayerStatus {
    return this.transition;
  }

  /**
   * Returns the ID of the video being played
   */
  public getVideoId(): string {
    logger.debug(`getVideoId():> returning ${this.videoId}`);

    return this.videoId;
  }

  public getVolume(): number | undefined {
    if (this.videoAPI) {
      return this.videoAPI.getVolume();
    }
    return undefined;
  }

  /**
   * Prepares a video for playing.
   * @param id Video id of the remote service
   * @param api A supported video source API name. You can try casting a dynamic variable using "let api: SupportedVideoAPIs = SupportedVideoAPIs['YouTube'];"
   * @param options Options to pass to the video player implementation
   */
  public loadVideo(id?: string, api?: SupportedVideoAPIs, options?: IVideoAPIOptions): Promise<VideoPlayer> {
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

    if (this.videoAPI === undefined && this.getStatus() !== VideoPlayerStatus.cueing) {
      this.videoAPI = this.createVideoAPI();

      return this.queueAction("loadVideo", this.videoAPI.loadVideo, this.videoId, this.options);
    } else {
      const loadedLoading = (this.getStatus() !== VideoPlayerStatus.cueing) ? "being loading" : "loaded";
      logger.debug(`loadVideo():> Video already ${loadedLoading}, not loading it again, for videoId=${this.videoId}, api=${this.api}`);

      return Promise.resolve(this);
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
  public loadVideoFromURL(url: URL, options?: IVideoAPIOptions): Promise<VideoPlayer> {
    logger.debug(`loadVideoFromURL():> params url=${url}, options=${options || {}}`);

    this.parseURL(url); // Parses the url and stores the videoId and api type to this object.

    return this.loadVideo(this.videoId, this.api, options);
  }

  public pauseVideo(): Promise<VideoPlayer> {
    if (this.videoAPI === undefined) {
      this.loadVideo();
    }

    return this.queueAction("pauseVideo", this.videoAPI.pauseVideo);
  }

  public playOrPauseVideo(): Promise<VideoPlayer> {
    if (this.getStatus() === VideoPlayerStatus.started || this.transition === VideoPlayerStatus.starting) {
      return this.pauseVideo();
    } else {
      return this.startVideo();
    }
  }

  public seekVideo(position: number): Promise<VideoPlayer> {
    if (this.videoAPI === undefined) {
      this.loadVideo();
    }

    return this.queueAction("seekVideo", this.videoAPI.seekVideo, position);
  }

  public setPlaybackRate(rate: number): Promise<VideoPlayer> {
    if (this.videoAPI === undefined) {
      this.loadVideo();
    }

    return this.queueAction("setPlaybackRate", this.videoAPI.setPlaybackRate, rate)
  }

  /**
   * @param volume Volume level. 0 sets the player muted
   */
  public setVolume(volume: number): void {
    if (this.videoAPI === undefined) {
      this.options.volume = volume;
      logger.debug(`setVolume():> param volume=${volume}. Updating video options, because video not loaded yet.`);
      return;
    }
    this.videoAPI.setVolume(volume);
  }

  public startVideo(): Promise<VideoPlayer> {
    if (this.videoAPI === undefined) {
      this.loadVideo(); //Queue load action
    }

    return this.queueAction("startVideo", this.videoAPI.startVideo);
  }

  public stopVideo(): Promise<VideoPlayer> {
    if (this.videoAPI === undefined) {
      this.loadVideo();
    }

    return this.queueAction("stopVideo", this.videoAPI.stopVideo);
  }

  private createVideoAPI(): VideoAPI {
    logger.debug("selectVideoAPI():> ");

    if (this.api === SupportedVideoAPIs.YouTube) {

      return new YouTubeVideo(this.rootElement, this.options);

    } else if (this.api === SupportedVideoAPIs.HTML5Video) {

      return new HTML5Video(this.rootElement, this.options);

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
    const userAgent: string = navigator.userAgent.toLowerCase();
    logger.debug(`parseURL():> params url=${url}, userAgent=${userAgent}`);

    // YouTube long url
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

    // YouTube short url
    } else if (url.hostname === "youtu.be") {
      this.api = SupportedVideoAPIs.YouTube;
      const videoId: string = url.pathname.substr(1); // Omit the first character which is a '/'
      if (! videoId) {
        throw new BadParameterException(
          `URL '${url.toString()}' doesn't include the video id. Using video source '${this.api}'. Expected the URL to look like 'https://youtu.be/d1mX_MBz0HU'`);
      }
      this.videoId = videoId;

    // HTML5 Video, local or remote
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Supported_media_formats
    } else if (url.pathname.match(/\.(\w{2,4})$/)) {
      this.api = SupportedVideoAPIs.HTML5Video;

      if (url.pathname.match(/\.(?:mp4|ogg|webm)$/)) {
        this.videoId = url.toString();
      } else {
        const match = url.pathname.match(/\.(\w{2,4})$/)
        throw new BadParameterException(
          `URL '${url.toString()}' points to a file, but the Video type '${match[1]}' is unsupported. Using video source '${this.api}'. Expected the URL to look like 'https://example.com/path-to-video/video.mp4'`);
      }

    /* Is it necessary to intercept a local video specifically since it uses the HTML5 Video-element in the background anyway?
    // This is a local video file
    } else if (url.protocol.match(/^file/) && url.pathname.match(/\.(?:mp4|ogg|webm)$/)) {
          //https://github.com/electron/electron/issues/2288
      if (userAgent.indexOf(' electron/') > -1 ||
          //How to reliably detect if inside a NW.js app?
          ???? > -1) {

      }
    */

//    } else if (url.hostname === "www.vimeo.com") {
//      return new VimeoVideo();

    } else {
      throw new UnknownVideoSourceException(`Couldn't identify a known video source from URL '${url.toString()}'`);
    }
  }

  private getTransitionStatus(funcName: string): VideoPlayerStatus {
    if (funcName in VideoPlayer.actionToTransitionMap) {
      return VideoPlayer.actionToTransitionMap[funcName];
    }
    else {
      throw new BadParameterException(`Function '${funcName}' not found in the VideoPlayer.actionToTransitionMap`);
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
  private queueAction<G>(funcName: string, callback: (...any: any[]) => Promise<any>, ...callbackParams: any[]): Promise<VideoPlayer> {

    const promiseId = this.getPromiseId();
    const actionId = `${funcName}:${promiseId}`; //A bit of sugar-coating to make the actionQueue easier to track

    const logFormat: string = this.logCtx(promiseId, funcName);

    const timeouts: any = { // Store timeouts in an object so the interval can see itself from within :)
      actionQueueInterval: undefined,
      promiseTimeout: undefined,
    };

    const promiseResolvedHandler = (p: any) => {
      this.transition = undefined; // No longer transitioning anywhere
      window.clearTimeout(timeouts.promiseTimeout);

      const index: number = this.actionQueue.findIndex((storedActionId: string) => storedActionId === actionId);
      if (index !== 0) {
        throw new UnknownStateException(this.logCtx(promiseId, funcName, "callback that was resolved was not the first action in the queue! index="+index));
      }
      this.actionQueue.splice(index, 1); //Remove the action matching the current action, this should be the first action

      if (p instanceof Error) {
        logger.trace(`${logFormat}Rejected!`);
        throw p;
      }
      logger.trace(`${logFormat}Resolved`);

      return this;
    };

    // Queue the action
    this.actionQueue.push(actionId);
    return new Promise<VideoPlayer>((resolve, reject) => {
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
            this.transition = this.getTransitionStatus(funcName); //Start transitioning
            callback.call(this.videoAPI, promiseId, ...callbackParams).then(resolve, reject);
            window.clearInterval(timeouts.actionQueueInterval); // Kill itself from within.
          }
        }, 50);
      } else {
        this.transition = this.getTransitionStatus(funcName); //Start transitioning
        callback.call(this.videoAPI, promiseId, ...callbackParams).then(resolve, reject);
      }
    })
    .then(promiseResolvedHandler, promiseResolvedHandler);
  }
}

