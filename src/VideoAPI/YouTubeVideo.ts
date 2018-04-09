/**
 * https://developers.google.com/youtube/iframe_api_reference
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/youtube/index.d.ts is in tsconfig.json to make typings available
 */

import { IVideoAPIOptions, VideoAPI, VideoPlayerStatus } from "../VideoAPI";

import { BadPlaybackRateException } from "../Exception/BadPlaybackRate";
import { CreateException } from "../Exception/Create";
import { MissingHandlerException } from "../Exception/MissingHandler";
import { UnknownStateException } from "../Exception/UnknownState";

import { log4javascript, LoggerManager } from "skicker-logger-manager";
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
  private availablePlaybackRates: number[];
  private options: IVideoAPIOptions = {};
  /** Is set when the YTPlayer is created to timeout the creation promise */
  private playerCreateTimeoutter: number;
  private rootElement: HTMLElement;
  private stateChangeHandlers: {[key: string]: (ytv: YouTubeVideo, event: YT.PlayerEvent) => void} = {};
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
    logger.debug("pauseVideo():> ");

    if (this.getStatus() === VideoPlayerStatus.ended ||
        this.getStatus() === VideoPlayerStatus.paused) {
      logger.info(`pauseVideo():> Video play already ${this.getStatus()}`);

      return Promise.resolve(this);
    }

    return new Promise<YouTubeVideo> ((resolve, reject): void => {
      this.stateChangeHandlers.paused = (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
        logger.debug("stateChangeHandlers.paused():> Play paused");
        resolve(this);
      };
      this.ytPlayer.pauseVideo();
    });
  }

  public playOrPauseVideo(): Promise<YouTubeVideo> {
    logger.debug("playOrPauseVideo():> ");
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
    const status: VideoPlayerStatus = this.getStatus();
    logger.debug("seekVideo():> position:", position, "status:", status);

    if (status === VideoPlayerStatus.paused || status === VideoPlayerStatus.playing || status === VideoPlayerStatus.buffering) {
      //These statuses are ok to seek from
      return this._seekVideo(position);
    } else {
      if (this.ytPlayer === undefined) {
        return Promise.reject("YouTube player not loaded with a video yet. Cannot seek before loading a video.");
      }

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
    const rate: number = playbackRate || this.options.rate;
    if (rate) {
      logger.debug(`setPlaybackRate():> params playbackRate=${playbackRate}, this.options.rate=${this.options.rate}`);

      const oldRate: number = this.ytPlayer.getPlaybackRate();
      if (rate === oldRate) {
        logger.debug(`setPlaybackRate():> rate=${playbackRate} is the same as the current playback rate.`);

        return Promise.resolve(this);
      }

      return new Promise<YouTubeVideo> ((resolve, reject): void => {

        this.checkPlaybackRate(rate);

        this.stateChangeHandlers.onPlaybackRateChange = (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
          const newRate: number = this.ytPlayer.getPlaybackRate();
          logger.debug(`stateChangeHandlers.onPlaybackRateChange():> Playback rate changed from ${oldRate} to ${newRate}. Requested ${rate}`);
          resolve(this);
        };
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

  public startVideo(): Promise<YouTubeVideo> {
    logger.debug("startVideo():> ");

    return new Promise<YouTubeVideo> ((resolve, reject): void => {
      this.stateChangeHandlers.playing = (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
        logger.debug("stateChangeHandlers.playing():> Play started");
        resolve(this);
      };
      this.ytPlayer.playVideo();
    });
  }

  public stopVideo(): Promise<YouTubeVideo> {
    logger.debug("stopVideo():> ");

    return new Promise<YouTubeVideo> ((resolve, reject): void => {
      this.stateChangeHandlers.unstarted = (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
        logger.debug("stateChangeHandlers.unstarted():> Play unstarted(stopped)");
        resolve(this);
      };
      this.ytPlayer.stopVideo();
    });
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
    const oldStatus: VideoPlayerStatus = this.getStatus()
    logger.debug("_seekVideo():> position:", position, "status:", this.getStatus());

    return new Promise<YouTubeVideo> ((resolve, reject): void => {

      // YouTube Player doesn't trigger onStatusChangeHandlers when seeking to an already buffered position in the video, when being paused.
      // Thus we cannot get a confirmation that the seeking was actually done.
      // Use a timeout to check if we are buffering, and if not, mark the seek as complete.
      if (oldStatus === VideoPlayerStatus.paused) {
        setTimeout(() => {
          if (this.getStatus() !== VideoPlayerStatus.buffering) {
            logger.debug(`stateChangeHandlers.${this.getStatus()}():> Position seeked without buffering from a paused state`);
            resolve(this);
          }
        },100);
      }

      const func = (ytv: YouTubeVideo, event: YT.PlayerEvent): void => {
        logger.debug(`stateChangeHandlers.${this.getStatus()}():> Position seeked`);
        resolve(this);
      };
      this.stateChangeHandlers[oldStatus] = func;
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
  private createPlayer(videoId: string): Promise<YouTubeVideo> {
    if (! this.ytPlayer) {
      return new Promise<YouTubeVideo> ((resolve: (value:YouTubeVideo) => void, reject: (err:Error) => void): void => {
        this.ytPlayerOptions = this.translateIVideoAPIOptionsToYTPlayerOptions(this.options);
        this.ytPlayerOptions.videoId = videoId;

        this.injectDefaultHandlers(resolve, reject); // This promise is resolved from the injected default onReady()-callback

        // If Player cannot be created in 10s, trigger a timeout and fail the promise.
        const createTimeoutInMillis: number = 10000;
        this.playerCreateTimeoutter = setTimeout(
          () => {
            logger.error("createPlayer():> YouTube Player creating timed out for videoId="+videoId);
            reject(new CreateException("createPlayer():> YouTube Player creating timed out for videoId="+videoId));
          },
          createTimeoutInMillis,
        );

        logger.debug("createPlayer():> Creating a new player, videoId="+videoId+", elementId=", this.rootElement.id, "ytPlayerOptions=", this.ytPlayerOptions);
        this.ytPlayer = new YT.Player(this.rootElement.id, this.ytPlayerOptions);
      });
    } else {
      logger.debug("createPlayer():> Player exists, Promise resolved for videoId="+videoId);

      return Promise.resolve(this);
    }
  }

  /**
   * 2. This code loads the IFrame Player API code asynchronously.
   * Makes sure the API code is loaded once even when using multiple players on the same document
   */
  private initIFrameAPI(): Promise<YouTubeVideo> {
    if (! document.getElementById("youtube-iframe_api")) {
      logger.debug("initIFrameAPI():> ");
      const tag: HTMLElement = document.createElement("script");

      tag.setAttribute("src", "https://www.youtube.com/iframe_api");
      tag.setAttribute("id", "youtube-iframe_api");
      const firstScriptTag: HTMLElement = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      return new Promise<YouTubeVideo> ((resolve: (value:YouTubeVideo) => void, reject: (error:Error) => void): void => {

        // If script cannot be downloaded and processed in 10s, trigger a timeout and fail the promise.
        const iframeInitializationTimeoutInMillis: number = 10000;
        const timeoutter: number = setTimeout(
          () => {
            logger.error("onYouTubeIframeAPIReady():> IFrame API loading timed out");
            reject(new CreateException("onYouTubeIframeAPIReady():> IFrame API loading timed out"));
          },
          iframeInitializationTimeoutInMillis,
        );
        // YouTube IFrame API signals intialization is complete
        (window as any).onYouTubeIframeAPIReady = (): void => {
          logger.debug("onYouTubeIframeAPIReady():> IFrame API loaded, Promise resolved");
          clearTimeout(timeoutter);
          resolve(this);
        };
      });
    }
    // The external iframe source code has already been downloaded so skip redownload
    return new Promise<YouTubeVideo> ((resolve: (value:YouTubeVideo) => void, reject: (value:string) => void): void => {
      logger.debug("initIFrameAPI():> IFrame API already loaded. Promise resolved");
      resolve(this);
    });
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
}
