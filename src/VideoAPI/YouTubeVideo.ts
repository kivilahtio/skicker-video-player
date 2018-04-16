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
  private static ytToVAPIPlayerStates: {[key: string]: string} = {
    "-1": VideoPlayerStatus.stopped,
    "0":  VideoPlayerStatus.ended,
    "1":  VideoPlayerStatus.started,
    "2":  VideoPlayerStatus.paused,
    "3":  VideoPlayerStatus.buffering,
    "5":  VideoPlayerStatus.cued,
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

  public getPlaybackRate(): number | undefined {
    if (this.ytPlayer) {
      return this.ytPlayer.getPlaybackRate();
    }
    return undefined;
  }

  public getPosition(): number | undefined {
    if (this.ytPlayer) {
      return this.ytPlayer.getCurrentTime();
    }
    return undefined;
  }

  public getStatus(): VideoPlayerStatus {
    if (this.ytPlayer) {
      const stateName: string = this.translatePlayerStateEnumToString(this.ytPlayer.getPlayerState());
      return stateName as VideoPlayerStatus;
    }
    return VideoPlayerStatus.notLoaded;
  }

  public getVolume(): number | undefined {
    if (this.ytPlayer) {
      return this.ytPlayer.getVolume();
    }
    return undefined;
  }

  public loadVideo(actionId: string, videoId:string, options?: IVideoAPIOptions): Promise<YouTubeVideo> {
    const ctx: string = "loadVideo";
    logger.debug(this.logCtx(actionId, ctx, `params videoId=${videoId}`));

    if (options) {
      Object.assign(this.options, options); // Merge options from the constructor with the new options, atleast the videoId must be given.
    }

    return this.initIFrameAPI(actionId)
    .then(() => this.createPlayer(actionId, videoId))
    .then(() => this.setPlaybackRate(actionId))
    .then((vapi: YouTubeVideo) => {
      if (this.options.volume) {
        this.setVolume(this.options.volume);
      }

      return this;
    });
  }

  /**
   * https://developers.google.com/youtube/iframe_api_reference#pauseVideo
   */
  public pauseVideo(actionId: string): Promise<YouTubeVideo> {
    const ctx: string = "pauseVideo";
    logger.debug(this.logCtx(actionId, ctx));

    return new Promise((resolve, reject) => {
      const status = this.getStatus();
      if (status === VideoPlayerStatus.ended ||
          status === VideoPlayerStatus.paused ||
          status === VideoPlayerStatus.cued ||
          status === VideoPlayerStatus.stopped
        ) {
        logger.info(this.logCtx(actionId, ctx, `Video already ${status}`));

        return resolve(this);
      }

      this.setStateChangeHandler(VideoPlayerStatus.paused, actionId, (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
        logger.debug(this.logCtx(actionId, ctx, "stateChangeHandlers.paused():> Play paused"));
        this.stateChangeHandlerFulfilled(VideoPlayerStatus.paused, actionId);
        resolve(this);
      });
      this.ytPlayer.pauseVideo();
    });
  }

  /**
   *  Seeking is a bit tricky since we need to be in the proper state. Otherwise we get strange errors and behaviour from YouTube Player.
   *  If not in playing or paused -states, forcibly move there.
   */
  public seekVideo(actionId: string, position: number): Promise<YouTubeVideo> {
    try {
      const ctx: string = "seekVideo";
      const status: VideoPlayerStatus = this.getStatus();
      logger.debug(this.logCtx(actionId, ctx, `position:${position}, status:${status}`));

      if (status === VideoPlayerStatus.paused || status === VideoPlayerStatus.started || status === VideoPlayerStatus.buffering) {
        //These statuses are ok to seek from
        return this._seekVideo(actionId, position);
      } else {
        if (this.ytPlayer === undefined) {
          return Promise.reject(new UnknownStateException(this.logCtx(actionId, ctx, "YouTube player not loaded with a video yet. Cannot seek before loading a video.")));
        }

        logger.debug(this.logCtx(actionId, ctx,
          `VideoPlayer not started yet, so start/stop first to workaround a bug. position:${position}, status:${status}`));
        //These statuses are not ok. Mute+Play+Pause to get into the desired position to be able to seek.
        const oldVol: number = this.getVolume();
        this.setVolume(0);

        return this.startVideo(actionId)
        .then((player: YouTubeVideo) => this.pauseVideo(actionId))
        .then((player: YouTubeVideo) => {
          this.setVolume(oldVol);

          return this._seekVideo(actionId, position);
        });
      }
    } catch(err) {
      return Promise.reject(err);
    }
  }

  /**
   * Sets the playback rate to the nearest available rate YouTube player supports.
   *
   * @param playbackRate Desired playback rate, if not given, value in this.options.rate is used.
   */
  public setPlaybackRate(actionId: string, playbackRate?: number): Promise<YouTubeVideo> {
    const ctx: string = "setPlaybackRate";
    const rate: number = playbackRate || this.options.rate;
    if (rate) {
      logger.debug(this.logCtx(actionId, ctx, `params playbackRate=${playbackRate}, this.options.rate=${this.options.rate}`));

      const oldRate: number = this.ytPlayer.getPlaybackRate();
      if (rate === oldRate) {
        logger.debug(this.logCtx(actionId, ctx, `rate=${playbackRate} is the same as the current playback rate.`));

        return Promise.resolve(this);
      }

      return new Promise((resolve, reject): void => {
        this.checkPlaybackRate(rate);

        this.setStateChangeHandler("onPlaybackRateChange", actionId, (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
          const newRate: number = this.ytPlayer.getPlaybackRate();
          logger.debug(this.logCtx(actionId, ctx,
            `stateChangeHandlers.onPlaybackRateChange():> Playback rate changed from ${oldRate} to ${newRate}. Requested ${rate}`));
          this.stateChangeHandlerFulfilled("onPlaybackRateChange", actionId);
          resolve(this);
        });
        this.ytPlayer.setPlaybackRate(rate);
      });
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

  public startVideo(actionId: string): Promise<YouTubeVideo> {
    const ctx: string = "startVideo";
    logger.debug(this.logCtx(actionId, ctx));

    return new Promise((resolve, reject): void => {
      if (this.getStatus() === VideoPlayerStatus.started) {
        logger.info(this.logCtx(actionId, ctx, `Video already status=${this.getStatus()}`));

        return resolve(this);
      }

      this.setStateChangeHandler(VideoPlayerStatus.started, actionId, (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
        logger.debug(this.logCtx(actionId, ctx, "stateChangeHandlers.playing():> Play started"));
        this.stateChangeHandlerFulfilled(VideoPlayerStatus.started, actionId);
        resolve(this);
      });
      this.ytPlayer.playVideo();
    });
  }

  public stopVideo(actionId: string, ): Promise<YouTubeVideo> {
    const ctx: string = "stopVideo";
    logger.debug(this.logCtx(actionId, ctx));

    return new Promise((resolve, reject): void => {
      if (this.getStatus() === VideoPlayerStatus.stopped) {
        logger.info(this.logCtx(actionId, ctx, `Video already status=${this.getStatus()}`));

        return resolve(this);
      }

      this.setStateChangeHandler(VideoPlayerStatus.stopped, actionId, (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
        logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.${this.getStatus()}():> Play unstarted(stopped)`));
        this.stateChangeHandlerFulfilled(VideoPlayerStatus.stopped, actionId);
        resolve(this);
      });
      this.ytPlayer.stopVideo();
    });
  }

  /**
   * Translate a number-based enumeration to a human readable state. Useful for logging.
   * @param state State received from the YT.Player.getPlayerState()
   */
  public translatePlayerStateEnumToString(state: YT.PlayerState): string {
    if (YouTubeVideo.ytToVAPIPlayerStates[state]) {

      return YouTubeVideo.ytToVAPIPlayerStates[state];
    } else {
      const msg: string = `translatePlayerStateEnumToString():> Unknown state=${state}`;
      logger.fatal(msg);
      throw new UnknownStateException(msg);
    }
  }

  /** Just seek with no safety checks */
  private _seekVideo(actionId: string, position: number): Promise<YouTubeVideo> {
    const oldStatus: VideoPlayerStatus = this.getStatus();
    const ctx: string = "_seekVideo";
    logger.debug(this.logCtx(actionId, ctx, `position:${position}, status:${oldStatus}`));

    return new Promise((resolve, reject) => {

      // YouTube Player doesn't trigger onStatusChangeHandlers when seeking to an already buffered position in the video, when being paused.
      // Thus we cannot get a confirmation that the seeking was actually done.
      // Use a timeout to check if we are buffering, and if not, mark the seek as complete.
      let cancel: number;
      if (oldStatus === VideoPlayerStatus.paused ||
          oldStatus === VideoPlayerStatus.started) {
        cancel = window.setTimeout(() => {
          if (this.getStatus() !== VideoPlayerStatus.buffering) {
            logger.debug(this.logCtx(actionId, ctx,
              `stateChangeHandlers.${this.getStatus()}():> Position seeked without buffering from a ${oldStatus}-state`));
            this.stateChangeHandlerFulfilled(oldStatus, actionId);
            //this.stateChangeHandlerFulfilled(VideoPlayerStatus.ended, actionId); //It is possible to seek to the end
            resolve(this);
          }
        },500);
      }

      const func = (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
        logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.${this.getStatus()}():> Position seeked`));
        this.stateChangeHandlerFulfilled(oldStatus, actionId);
        //this.stateChangeHandlerFulfilled(VideoPlayerStatus.ended, actionId); //It is possible to seek to the end
        if (cancel) {
          window.clearTimeout(cancel);
        }
        resolve(this);
      };
      this.setStateChangeHandler(oldStatus, actionId, func);
      //this.setStateChangeHandler(VideoPlayerStatus.ended, actionId, func); //It is possible to seek to the end
      this.ytPlayer.seekTo(position, true);
    });
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
  private createPlayer(actionId: string, videoId: string): Promise<YouTubeVideo> {
    const ctx: string = "createPlayer";
    if (! this.ytPlayer) {
      return new Promise((resolve, reject) => {
        this.ytPlayerOptions = this.translateIVideoAPIOptionsToYTPlayerOptions(this.options);
        this.ytPlayerOptions.videoId = videoId;

        this.injectDefaultHandlers(resolve, reject); // This promise is resolved from the injected default onReady()-callback

        logger.debug(this.logCtx(actionId, ctx,
          `Creating a new player, videoId=${videoId}, elementId=${this.rootElement.id}, ytPlayerOptions=${this.ytPlayerOptions}`));
        this.ytPlayer = new YT.Player(this.rootElement.id, this.ytPlayerOptions);
      });
    } else {
      logger.debug(this.logCtx(actionId, ctx, `Player exists, Promise resolved for videoId=${videoId}`));

      return Promise.resolve(this);
    }
  }

  /**
   * 2. This code loads the IFrame Player API code asynchronously.
   * Makes sure the API code is loaded once even when using multiple players on the same document
   */
  private initIFrameAPI(actionId: string): Promise<YouTubeVideo> {
    const ctx: string = "initIFrameAPI";
    if (! document.getElementById("youtube-iframe_api")) {
      logger.debug(this.logCtx(actionId, ctx));
      const tag: HTMLElement = document.createElement("script");

      tag.setAttribute("src", "https://www.youtube.com/iframe_api");
      tag.setAttribute("id", "youtube-iframe_api");
      const firstScriptTag: HTMLElement = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      return new Promise((resolve, reject) => {

        // YouTube IFrame API signals intialization is complete
        (window as any).onYouTubeIframeAPIReady = (): void => {
          logger.debug(this.logCtx(actionId, ctx, "onYouTubeIframeAPIReady():> IFrame API loaded, Promise resolved"));
          resolve(this);
        };
      });
    }
    // The external iframe source code has already been downloaded so skip redownload
    logger.debug(this.logCtx(actionId, ctx, "IFrame API already loaded. Promise resolved"));

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
  private setStateChangeHandler(event: string, actionId: string, handler: (ytv: YouTubeVideo, event: YT.PlayerEvent) => void): void {
    if (this.stateChangeHandlersReservations[event] !== undefined) {
      logger.error(new StateChangeHandlerReservedException(this.logCtx(actionId, event,
        `Handler already used by Promise=${this.stateChangeHandlersReservations[event]} and waiting for fulfillment from YouTube IFrame Player`))
      );
    }
    this.stateChangeHandlersReservations[event] = actionId;
    this.stateChangeHandlers[event] = handler;
  }

  /** One must call this to mark a stateChangeHandler resolved */
  private stateChangeHandlerFulfilled(event: string, actionId: string): void {
    if (this.stateChangeHandlersReservations[event] === undefined ||
        this.stateChangeHandlers[event] === undefined) {
      let err = "";
      if (this.stateChangeHandlersReservations[event] === undefined) {
        err += `No promise reservation for event=${event}. `;
      }
      if (this.stateChangeHandlers[event] === undefined) {
        err += `No handler for event=${event}. `;
      }
      logger.error(new StateChangeHandlerReservedException(this.logCtx(actionId, event, err)));
    }
    this.stateChangeHandlersReservations[event] = undefined;
    this.stateChangeHandlers[event] = undefined;
  }

  private logCtx(actionId?: string, ctx?: string, message?: string): string {
    let sb = "";
    if (actionId !== undefined) {
      sb += `Promise:${actionId}:`;
    }
    if (ctx !== undefined) {
      sb += `${ctx}():> `;
    }
    if (message) {
      sb += message;
    }

    return sb;
  }
}
