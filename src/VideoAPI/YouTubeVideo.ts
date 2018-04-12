/**
 * https://developers.google.com/youtube/iframe_api_reference
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/youtube/index.d.ts is in tsconfig.json to make typings available
 */
import { IVideoAPIOptions, VideoAPI, VideoPlayerStatus } from "../VideoAPI";

import { BadPlaybackRateException } from "../Exception/BadPlaybackRate";
import { CreateException } from "../Exception/Create";
import { MissingHandlerException } from "../Exception/MissingHandler";
import { PromiseTimeoutException } from "../Exception/PromiseTimeout";
import { UnknownStateException } from "../Exception/UnknownState";

import { log4javascript, LoggerManager } from "skicker-logger-manager";
import { StateChangeHandlerReservedException } from "../Exception/StateChangeHandlerReserved";
const logger: log4javascript.Logger = LoggerManager.getLogger("Skicker.VideoAPI.YouTubeVideo");

/**
 * Implements the YouTube IFrame Video Player API, wrapping it into nice promises
 */
export class YouTubeVideo extends VideoAPI {

  /**
   * How long does each Promise created in this class take to timeout?
   * This is used to protect and catch against leaking promises that never resolve.
   * Time unit in ms
   */
  public promiseSafetyTimeout: number = process.env.NODE_ENV === "testing" ? 95000 : 20000;

  // https://developers.google.com/youtube/iframe_api_reference#Events
  private static ytPlayerStates: {[key: string]: string} = {
    "-1": "unstarted",
    "0":  "ended",
    "1":  "playing",
    "2":  "paused",
    "3":  "buffering",
    "5":  "video cued",
    "unstarted": "-1",
    "ended":      "0",
    "playing":    "1",
    "paused":     "2",
    "buffering":  "3",
    "video cued": "5",
  };
  private availablePlaybackRates: number[];
  private options: IVideoAPIOptions = {};
  /** Is set when the YTPlayer is created to timeout the creation promise */
  private playerCreateTimeoutter: number;
  private rootElement: HTMLElement;
  private stateChangeHandlers: {[event: string]: (ytv: YouTubeVideo, event: YT.PlayerEvent) => void} = {};
  /**
   * Keep track of the promises that are expecting state chabnge handlers to fulfill.
   * Cannot have multiple handlers overlap since YouTube API doesn't distinguish specific events.
   */
  private stateChangeHandlersReservations: {[event: string]: string} = {};
  private ytPlayer: YT.Player;
  private ytPlayerOptions: YT.PlayerOptions;

  /**
   *
   * @param rootElement Where to inject the IFrame Player?
   * @param ytPlayerOptions id must be given to satisfy Typing, but can be later overloaded with loadVideo()
   */
  public constructor(rootElement: HTMLElement, options?: IVideoAPIOptions) {
    super();
    logger.debug(`constructor():> params rootElement=${rootElement}, options=`, options);
    this.rootElement = rootElement;
    if (options) {
      this.options = options;
    }
  }

  /**
   * Delete this instance and kill all pending actions
   */
  public destroy(): void {
    // Try to delete as much about anything that could lead to memory leaks.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management
    this.ytPlayer.destroy();
    this.ytPlayer = undefined;
    this.rootElement.parentNode
    .removeChild(this.rootElement);
    this.rootElement = undefined;
    this.ytPlayerOptions = undefined;
    this.options = undefined;
  }

  public getDuration(): number | undefined {
    if (this.ytPlayer) {
      return this.ytPlayer.getDuration();
    }

    return undefined;
  }

  public getPlaybackRate(): number {
    return this.ytPlayer.getPlaybackRate();
  }

  public getPosition(): number | undefined {
    if (this.ytPlayer) {
      return this.ytPlayer.getCurrentTime();
    }

    return undefined;
  }

  public getStatus(): VideoPlayerStatus {
    const stateName: string = this.translatePlayerStateEnumToString(this.ytPlayer.getPlayerState());

    return stateName as VideoPlayerStatus;
  }

  public getVolume(): number {
    return this.ytPlayer.getVolume();
  }

  public loadVideo(videoId:string, options?: IVideoAPIOptions): Promise<YouTubeVideo> {
    logger.debug(`loadVideo():> params videoId=${videoId}, options=`, options);

    if (options) {
      Object.assign(this.options, options); // Merge options from the constructor with the new options, atleast the videoId must be given.
    }

    return this.initIFrameAPI()
    .then((res: YouTubeVideo) => this.createPlayer(videoId))
    .then((res: YouTubeVideo) => {
      if (this.options.volume) {
        this.setVolume(this.options.volume);
      }

      return this.setPlaybackRate();
    });
  }

  /**
   * https://developers.google.com/youtube/iframe_api_reference#pauseVideo
   */
  public pauseVideo(): Promise<YouTubeVideo> {
    const ctx: string = "pauseVideo";
    logger.debug(`${ctx}():>`);

    if (this.getStatus() === VideoPlayerStatus.ended ||
        this.getStatus() === VideoPlayerStatus.paused) {
      logger.info(`${ctx}():> Video already ${this.getStatus()}`);

      return Promise.resolve(this);
    }

    const promiseId: string = this.getPromiseId();
    return this.promisify<YouTubeVideo>(`${ctx}():> `, (resolve, reject): void => {
      this.setStateChangeHandler("paused", promiseId, (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
        logger.debug(this.logCtx(promiseId, ctx, "stateChangeHandlers.paused():> Play paused"));
        this.stateChangeHandlerFulfilled("paused", promiseId);
        resolve(this);
      });
      this.ytPlayer.pauseVideo();
    }, promiseId);
  }

  public playOrPauseVideo(): Promise<YouTubeVideo> {
    const ctx: string = "playOrPauseVideo";
    logger.debug(`${ctx}():>`);
    if (this.ytPlayer === undefined) {
      return Promise.reject(new UnknownStateException("YouTube Player not instantiated"));
    } else if (this.getStatus() === VideoPlayerStatus.playing) {
      return this.pauseVideo();
    } else {
      return this.startVideo();
    }
  }

  /**
   *  Seeking is a bit tricky since we need to be in the proper state. Otherwise we get strange errors and behaviour from YouTube Player.
   *  If not in playing or paused -states, forcibly move there.
   */
  public seekVideo(position: number): Promise<YouTubeVideo> {
    const ctx: string = "seekVideo";
    const status: VideoPlayerStatus = this.getStatus();
    logger.debug(`${ctx}():> position:`, position, "status:", status);

    if (status === VideoPlayerStatus.paused || status === VideoPlayerStatus.playing || status === VideoPlayerStatus.buffering) {
      //These statuses are ok to seek from
      return this._seekVideo(position);
    } else {
      if (this.ytPlayer === undefined) {
        return Promise.reject(new UnknownStateException("YouTube player not loaded with a video yet. Cannot seek before loading a video."));
      }

      logger.debug(`${ctx}():> VideoPlayer not started yet, so start/stop first to workaround a bug. position:`, position, "status:", status);
      //These statuses are not ok. Mute+Play+Pause to get into the desired position to be able to seek.
      const oldVol: number = this.getVolume();
      this.setVolume(0);

      return this.startVideo()
      .then((player: YouTubeVideo) => this.pauseVideo())
      .then((player: YouTubeVideo) => {
        this.setVolume(oldVol);

        return this._seekVideo(position);
      });
    }
  }

  /**
   * Sets the playback rate to the nearest available rate YouTube player supports.
   *
   * @param playbackRate Desired playback rate, if not given, value in this.options.rate is used.
   */
  public setPlaybackRate(playbackRate?: number): Promise<YouTubeVideo> {
    const ctx: string = "setPlaybackRate";
    const rate: number = playbackRate || this.options.rate;
    if (rate) {
      logger.debug(`${ctx}():> params playbackRate=${playbackRate}, this.options.rate=${this.options.rate}`);

      const oldRate: number = this.ytPlayer.getPlaybackRate();
      if (rate === oldRate) {
        logger.debug(`${ctx}():> rate=${playbackRate} is the same as the current playback rate.`);

        return Promise.resolve(this);
      }

      const promiseId: string = this.getPromiseId();
      return this.promisify(ctx, ((resolve, reject): void => {
        this.checkPlaybackRate(rate);

        this.setStateChangeHandler("onPlaybackRateChange", promiseId, (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
          const newRate: number = this.ytPlayer.getPlaybackRate();
          logger.debug(this.logCtx(promiseId, ctx,
            `stateChangeHandlers.onPlaybackRateChange():> Playback rate changed from ${oldRate} to ${newRate}. Requested ${rate}`));
          this.stateChangeHandlerFulfilled("onPlaybackRateChange", promiseId);
          resolve(this);
        });
        this.ytPlayer.setPlaybackRate(rate);
      }), promiseId);
    } else {
      return Promise.resolve(this);
    }
  }

  /**
   * @param volume Volume level. 0 sets the player muted
   */
  public setVolume(volume: number): void {
    logger.debug(`setVolume():> param volume=${volume}`);
    if (volume === 0) {
      this.ytPlayer.mute();
    } else {
      if (this.ytPlayer.isMuted()) {
        this.ytPlayer.unMute();
      }
      this.ytPlayer.setVolume(volume);
    }
  }

  public startVideo(): Promise<YouTubeVideo> {
    const ctx: string = "startVideo";
    logger.debug(`${ctx}():>`);

    if (this.getStatus() === VideoPlayerStatus.playing) {
      logger.info(ctx+"():> Video already "+this.getStatus());

      return Promise.resolve(this);
    }

    const promiseId: string = this.getPromiseId();
    return this.promisify(ctx, ((resolve, reject): void => {
      this.setStateChangeHandler("playing", promiseId, (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
        logger.debug(this.logCtx(promiseId, ctx, "stateChangeHandlers.playing():> Play started"));
        this.stateChangeHandlerFulfilled("playing", promiseId);
        resolve(this);
      });
      this.ytPlayer.playVideo();
    }), promiseId);
  }

  public stopVideo(): Promise<YouTubeVideo> {
    const ctx: string = "stopVideo";
    logger.debug(`${ctx}():>`);

    const promiseId: string = this.getPromiseId();
    return this.promisify(ctx, ((resolve, reject): void => {
      this.setStateChangeHandler("unstarted", promiseId, (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
        logger.debug(this.logCtx(promiseId, ctx, `stateChangeHandlers.${this.getStatus()}():> Play unstarted(stopped)`));
        this.stateChangeHandlerFulfilled("unstarted", promiseId);
        resolve(this);
      });
      this.ytPlayer.stopVideo();
    }), promiseId);
  }

  /**
   * Translate a number-based enumeration to a human readable state. Useful for logging.
   * @param state State received from the YT.Player.getPlayerState()
   */
  public translatePlayerStateEnumToString(state: YT.PlayerState): string {
    if (YouTubeVideo.ytPlayerStates[state]) {

      return YouTubeVideo.ytPlayerStates[state];
    } else {
      const msg: string = `translatePlayerStateEnumToString():> Unknown state=${state}`;
      logger.fatal(msg);
      throw new UnknownStateException(msg);
    }
  }

  /** Just seek with no safety checks */
  private _seekVideo(position: number): Promise<YouTubeVideo> {
    const oldStatus: VideoPlayerStatus = this.getStatus();
    const ctx: string = "_seekVideo";
    logger.debug(`${ctx}():> position:`, position, "status:", oldStatus);

    const promiseId: string = this.getPromiseId();
    return this.promisify(ctx, (resolve, reject): void => {

      // YouTube Player doesn't trigger onStatusChangeHandlers when seeking to an already buffered position in the video, when being paused.
      // Thus we cannot get a confirmation that the seeking was actually done.
      // Use a timeout to check if we are buffering, and if not, mark the seek as complete.
      let cancel: number;
      if (oldStatus === VideoPlayerStatus.paused) {
        cancel = window.setTimeout(() => {
          if (this.getStatus() !== VideoPlayerStatus.buffering) {
            logger.debug(this.logCtx(promiseId, ctx,
              `stateChangeHandlers.${this.getStatus()}():> Position seeked without buffering from a ${oldStatus}-state`));
            resolve(this);
          }
        },100);
      }

      const func = (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
        logger.debug(this.logCtx(promiseId, ctx, `stateChangeHandlers.${this.getStatus()}():> Position seeked`));
        this.stateChangeHandlerFulfilled(oldStatus, promiseId);
        if (cancel) {
          window.clearTimeout(cancel);
        }
        resolve(this);
      };
      this.setStateChangeHandler(oldStatus, promiseId, func);
      this.ytPlayer.seekTo(position, true);
    }, promiseId);
  }

  /**
   * Check if the desired rate is in the list of allowed playback rates, if not, raise an exception
   *
   * @param rate the new playback rate
   * @throws BadPlaybackRateException if the given rate is not on the list of allowed playback rates
   */
  private checkPlaybackRate(rate: number): void {
    if (! this.availablePlaybackRates) {
      this.availablePlaybackRates = this.ytPlayer.getAvailablePlaybackRates();
    }
    if (! this.availablePlaybackRates.find(
      (value: number, index: number, obj: number[]): boolean =>
        value === rate,
    )) {
      const msg: string = `Trying to set playback rate ${rate}. This is not on the list of allowed playback rates ${this.availablePlaybackRates}`;
      logger.fatal(msg);
      throw new BadPlaybackRateException(msg);
    }
  }
  /**
   * 3. This function creates an <iframe> (and YouTube player) after the API code downloads.
   */
  private createPlayer(videoId: string): Promise<YouTubeVideo> {
    const ctx: string = "createPlayer";
    if (! this.ytPlayer) {
      const promiseId: string = this.getPromiseId();
      return this.promisify(ctx, ((resolve: (value:YouTubeVideo) => void, reject: (err:Error) => void): void => {
        this.ytPlayerOptions = this.translateIVideoAPIOptionsToYTPlayerOptions(this.options);
        this.ytPlayerOptions.videoId = videoId;

        this.injectDefaultHandlers(resolve, reject); // This promise is resolved from the injected default onReady()-callback

        logger.debug(this.logCtx(promiseId, ctx,
          `Creating a new player, videoId=${videoId}, elementId=${this.rootElement.id}, ytPlayerOptions=${this.ytPlayerOptions}`));
        this.ytPlayer = new YT.Player(this.rootElement.id, this.ytPlayerOptions);
      }), promiseId);
    } else {
      logger.debug(`${ctx}():> Player exists, Promise resolved for videoId=`, videoId);

      return Promise.resolve(this);
    }
  }

  /**
   * 2. This code loads the IFrame Player API code asynchronously.
   * Makes sure the API code is loaded once even when using multiple players on the same document
   */
  private initIFrameAPI(): Promise<YouTubeVideo> {
    const ctx: string = "initIFrameAPI";
    if (! document.getElementById("youtube-iframe_api")) {
      logger.debug(`${ctx}():>`);
      const tag: HTMLElement = document.createElement("script");

      tag.setAttribute("src", "https://www.youtube.com/iframe_api");
      tag.setAttribute("id", "youtube-iframe_api");
      const firstScriptTag: HTMLElement = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      const promiseId: string = this.getPromiseId();
      return this.promisify<YouTubeVideo>(ctx, (resolve: (value:YouTubeVideo) => void, reject: (error:Error) => void): void => {

        // YouTube IFrame API signals intialization is complete
        (window as any).onYouTubeIframeAPIReady = (): void => {
          logger.debug(this.logCtx(promiseId, ctx, "onYouTubeIframeAPIReady():> IFrame API loaded, Promise resolved"));
          resolve(this);
        };
      }, promiseId);
    }
    // The external iframe source code has already been downloaded so skip redownload
    logger.debug("initIFrameAPI():> IFrame API already loaded. Promise resolved");

    return Promise.resolve(this);
  }

  /**
   * Pass in default handlers for various YouTube IFrame Player events if none supplied
   *
   * @param resolve upstream Promise resolver
   * @param reject  upstream Promise resolver
   */
  private injectDefaultHandlers(resolve: (value:YouTubeVideo) => void, reject: (err:Error) => void): void {
    if (! this.ytPlayerOptions.events) {
      this.ytPlayerOptions.events = {};
    }

    // The API will call this function when the video player is ready.
    const onPlayerReady: YT.PlayerEventHandler<YT.PlayerEvent> = (event:YT.PlayerEvent): void => {
      logger.debug(`onPlayerReady():> params state=${this.translatePlayerStateEnumToString(event.target.getPlayerState())}, Promise resolved`);
      clearTimeout(this.playerCreateTimeoutter);
      resolve(this);
    };
    // Inject the ready-handler to YT.Events
    if (this.ytPlayerOptions.events.onReady) {
      logger.warn("injectDefaultHandlers():> onPlayerReady-event handler should not be passed, since it is overwritten with Promise functionality.");
    }
    this.ytPlayerOptions.events.onReady = onPlayerReady; // For some reason onPlayerReady is not an accepted event handler?

    // Inject the onPlayerStateChange-handler
    const onPlayerStateChange: YT.PlayerEventHandler<YT.OnStateChangeEvent> = (event: YT.OnStateChangeEvent): void => {
      const stateName: string = this.translatePlayerStateEnumToString(event.target.getPlayerState());
      if (this.stateChangeHandlers[stateName]) {
        logger.debug(`onPlayerStateChange():> params state=${stateName}. Triggering stateChangeHandler`);
        this.stateChangeHandlers[stateName](this, event);
      } else {
        logger.trace(`onPlayerStateChange():> No handler for state=${stateName}`);
        // throw new MissingHandlerException(`onPlayerStateChange():> No handler for state=${stateName}`);
      }
    };
    if (! this.ytPlayerOptions.events.onStateChange) {
      this.ytPlayerOptions.events.onStateChange = onPlayerStateChange;
    }

    // Default onPlaybackRateChange handler
    const onPlaybackRateChange: YT.PlayerEventHandler<YT.OnPlaybackRateChangeEvent> = (event: YT.OnPlaybackRateChangeEvent): void => {
      const stateName: string = this.translatePlayerStateEnumToString(event.target.getPlayerState());
      if (this.stateChangeHandlers["onPlaybackRateChange"]) {
        this.stateChangeHandlers["onPlaybackRateChange"](this, event);
      } else {
        logger.trace(`onPlaybackRateChange():> No handler for state=${stateName}`);
      }
    };
    if (! this.ytPlayerOptions.events.onPlaybackRateChange) {
      this.ytPlayerOptions.events.onPlaybackRateChange = onPlaybackRateChange;
    }

    // Default onError() handler
    const onError: YT.PlayerEventHandler<YT.OnErrorEvent> = (event: YT.OnErrorEvent): void => {
      logger.error("onError():> ", event);
    };
    if (! this.ytPlayerOptions.events.onError) {
      this.ytPlayerOptions.events.onError = onError;
    }
  }

  private translateIVideoAPIOptionsToYTPlayerOptions(opts: IVideoAPIOptions): YT.PlayerOptions {
    return {
      width: opts.width || undefined,
      height: opts.height || undefined,
      videoId: "MISSING", // YT.PlayerOptions is tricky type, because we cannot easily precreate it without knowing the video id we are about to play.
      playerVars: {
        autohide: YT.AutoHide.HideAllControls,
        autoplay: (opts.autoplay) ? YT.AutoPlay.AutoPlay : YT.AutoPlay.NoAutoPlay,
        cc_load_policy: YT.ClosedCaptionsLoadPolicy.UserDefault,
        color: "white", // YT.ProgressBarColor = "red" | "white";
        controls: (opts.controls) ? YT.Controls.ShowLoadPlayer : YT.Controls.Hide,
        disablekb: YT.KeyboardControls.Disable,
        enablejsapi: YT.JsApi.Enable,
        end: opts.end || undefined,
        fs: YT.FullscreenButton.Show,
        hl: undefined, // Player language as an ISO 639-1 two-letter language code or fully-specified locale.
        iv_load_policy: YT.IvLoadPolicy.Hide,
        loop: (opts.loop) ? YT.Loop.Loop : YT.Loop.SinglePlay, // Doesn't work with end. Needs to be manually seekTo() to given start position.
        modestbranding: YT.ModestBranding.Full,
        playlist: undefined,
        playsinline: YT.PlaysInline.Fullscreen,
        rel: YT.RelatedVideos.Hide,
        showinfo: YT.ShowInfo.Show,
        start: opts.start || undefined,
      },
      //events?: {};
    };
  }

  /** Create a single-use state change handler */
  private setStateChangeHandler(event: string, promiseId: string, handler: (ytv: YouTubeVideo, event: YT.PlayerEvent) => void): void {
    if (this.stateChangeHandlersReservations[event] !== undefined) {
      throw new StateChangeHandlerReservedException(this.logCtx(promiseId, event,
        `Handler already used by Promise=${this.stateChangeHandlersReservations[event]} and waiting for fulfillment from YouTube IFrame Player`));
    }
    this.stateChangeHandlersReservations[event] = promiseId;
    this.stateChangeHandlers[event] = handler;
  }

  /** One must call this to mark a stateChangeHandler resolved */
  private stateChangeHandlerFulfilled(event: string, promiseId: string): void {
    if (this.stateChangeHandlersReservations[event] === undefined ||
        this.stateChangeHandlers[event] === undefined) {
      let err = "";
      if (this.stateChangeHandlersReservations[event] === undefined) {
        err += `No promise reservation for event=${event}. `;
      }
      if (this.stateChangeHandlers[event] === undefined) {
        err += `No handler for event=${event}. `;
      }
      throw new StateChangeHandlerReservedException(this.logCtx(promiseId, event, err));
    }
    this.stateChangeHandlersReservations[event] = undefined;
    this.stateChangeHandlers[event] = undefined;
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
  /**
   * Wraps a promise into identifiable log output and timeout to catch stray promises
   * @param ctx Context describing where this promise is used, like "startVideo"
   * @param promiseId temporarily unique identifier for this Promise, used to help finding out the order of events related
   *                  to a singular Promise from the log output.
   * @param callback The function to promisify
   */
  private promisify<G>(ctx: string, callback: (resolve: any, reject: any) => void, promiseId?: string): Promise<G> {
    if (promiseId === undefined) {
      promiseId = this.getPromiseId();
    }
    const logFormat: string = this.logCtx(promiseId, ctx);
    let cancel: number;

    return new Promise<G>((resolve, reject) => {
      logger.trace((`${logFormat}New Promise, timeout=${this.promiseSafetyTimeout}`));
      cancel = window.setTimeout(() => {
        const err: Error = new PromiseTimeoutException(`${logFormat}Timeouts`);
        logger.error(err, err.stack);
        reject(err);
      }, this.promiseSafetyTimeout);
      callback(resolve, reject);
    })
    .then((p: G) => {
      window.clearTimeout(cancel);
      logger.trace(`${logFormat}Resolved`);

      return p;
    });
  }
}
