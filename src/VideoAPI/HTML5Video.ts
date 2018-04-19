import { IVideoAPIOptions, VideoAPI, VideoPlayerStatus } from "../VideoAPI";

import { BadPlaybackRateException } from "../Exception/BadPlaybackRate";
import { CreateException } from "../Exception/Create";
import { MissingHandlerException } from "../Exception/MissingHandler";
import { PromiseTimeoutException } from "../Exception/PromiseTimeout";
import { UnknownStateException } from "../Exception/UnknownState";

import { log4javascript, LoggerManager } from "skicker-logger-manager";
import { StateChangeHandlerReservedException } from "../Exception/StateChangeHandlerReserved";
import { BadParameterException } from "../Exception/BadParameter";
const logger: log4javascript.Logger = LoggerManager.getLogger("Skicker.VideoAPI.HTML5Video");

/**
 * List transitions that make no sense. Typically used to detect if we are in a paused state or transitioning into such while trying to pause again.
 * or something similarly useless. Actions can typically be invoked and the Player does it's best to put itself into such a state that the action
 * can be fulfilled.
 * Mainly used to more easily define if we should do some action or not, before invoking it from outside the Player.
 */
const uselessTransitions = new Map<string, Map<VideoPlayerStatus, boolean>>()
.set("pauseVideo", new Map<VideoPlayerStatus, boolean>()
.set(VideoPlayerStatus.notLoaded, true)
.set(VideoPlayerStatus.paused, true)
.set(VideoPlayerStatus.pausing, true)
.set(VideoPlayerStatus.ended, true)
.set(VideoPlayerStatus.ending, true)
.set(VideoPlayerStatus.cued, true)
.set(VideoPlayerStatus.cueing, true)
.set(VideoPlayerStatus.stopped, true)
.set(VideoPlayerStatus.stopping, true));
uselessTransitions
.set("startVideo", new Map<VideoPlayerStatus, boolean>()
.set(VideoPlayerStatus.started, true)
.set(VideoPlayerStatus.starting, true));
uselessTransitions
.set("stopVideo", new Map<VideoPlayerStatus, boolean>()
.set(VideoPlayerStatus.notLoaded, true)
.set(VideoPlayerStatus.cued, true)
.set(VideoPlayerStatus.cueing, true)
.set(VideoPlayerStatus.stopped, true)
.set(VideoPlayerStatus.stopping, true));


/**
 * https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Media_events
 */
export enum Html5Event {
  abort = "abort", //Sent when playback is aborted; for example, if the media is playing and is restarted from the beginning, this event is sent.
  canplay = "canplay", //Sent when enough data is available that the media can be played, at least for a couple of frames.  This corresponds to the HAVE_ENOUGH_DATA readyState.
  canplaythrough = "canplaythrough", //Sent when the ready state changes to CAN_PLAY_THROUGH, indicating that the entire media can be played without interruption, assuming the download rate remains at least at the current level. It will also be fired when playback is toggled between paused and playing. Note: Manually setting the currentTime will eventually fire a canplaythrough event in firefox. Other browsers might not fire this event.
  durationchange = "durationchange", //The metadata has loaded or changed, indicating a change in duration of the media.  This is sent, for example, when the media has loaded enough that the duration is known.
  emptied = "emptied", //The media has become empty; for example, this event is sent if the media has already been loaded (or partially loaded), and the load() method is called to reload it.
  encrypted = "encrypted", //The user agent has encountered initialization data in the media data.
  ended = "ended", //Sent when playback completes.
  error = "error", //Sent when an error occurs.  The element's error attribute contains more information. See HTMLMediaElement.error for details.
  interruptbegin = "interruptbegin", //Sent when audio playing on a Firefox OS device is interrupted, either because the app playing the audio is sent to the background, or audio in a higher priority audio channel begins to play. See Using the AudioChannels API for more details.
  interruptend = "interruptend", //Sent when previously interrupted audio on a Firefox OS device commences playing again — when the interruption ends. This is when the associated app comes back to the foreground, or when the higher priority audio finished playing. See Using the AudioChannels API for more details.
  loadeddata = "loadeddata", //The first frame of the media has finished loading.
  loadedmetadata = "loadedmetadata", //The media's metadata has finished loading; all attributes now contain as much useful information as they're going to.
  loadstart = "loadstart", //Sent when loading of the media begins.
  mozaudioavailable = "mozaudioavailable", //Sent when an audio buffer is provided to the audio layer for processing; the buffer contains raw audio samples that may or may not already have been played by the time you receive the event.
  pause = "pause", //Sent when playback is paused.
  play = "play", //Sent when playback of the media starts after having been paused; that is, when playback is resumed after a prior pause event.
  playing = "playing", //Sent when the media begins to play (either for the first time, after having been paused, or after ending and then restarting).
  progress = "progress", //Sent periodically to inform interested parties of progress downloading the media. Information about the current amount of the media that has been downloaded is available in the media element's buffered attribute.
  ratechange = "ratechange", //Sent when the playback speed changes.
  seeked = "seeked", //Sent when a seek operation completes.
  seeking = "seeking", //Sent when a seek operation begins.
  stalled = "stalled", //Sent when the user agent is trying to fetch media data, but data is unexpectedly not forthcoming.
  suspend = "suspend", //Sent when loading of the media is suspended; this may happen either because the download has completed or because it has been paused for any other reason.
  timeupdate = "timeupdate", //The time indicated by the element's currentTime attribute has changed.
  volumechange = "volumechange", //Sent when the audio volume changes (both when the volume is set and when the muted attribute is changed).
  waiting = "waiting", //Sent when the requested operation (such as playback) is delayed pending the completion of another operation (such as a seek).
};

/**
 * Define HTML5 statuses which update the VideoAPI abstraction statuses.
 * HTML5 Media events are more verbose than is needed by the API abstraction,
 * when listening on the Media events from the Video-element,
 * this mapping table picks the Media events that actually transition this Player to anoter VideoPlayerState
 */
const Html5EventToVideoPlayerStatus = new Map<Html5Event, VideoPlayerStatus>()
.set(Html5Event.pause, VideoPlayerStatus.paused)
.set(Html5Event.play, VideoPlayerStatus.starting)
.set(Html5Event.playing, VideoPlayerStatus.started)
.set(Html5Event.loadstart, VideoPlayerStatus.cueing)
.set(Html5Event.canplay, VideoPlayerStatus.cued)
.set(Html5Event.ended, VideoPlayerStatus.ended)
.set(Html5Event.seeking, VideoPlayerStatus.seeking);

const videoPlayerStatusToHtml5Event = new Map<VideoPlayerStatus, Html5Event>()
.set(VideoPlayerStatus.paused, Html5Event.pause)
.set(VideoPlayerStatus.starting, Html5Event.play)
.set(VideoPlayerStatus.started, Html5Event.playing)
.set(VideoPlayerStatus.cueing, Html5Event.loadstart)
.set(VideoPlayerStatus.cued, Html5Event.canplay)
.set(VideoPlayerStatus.ended, Html5Event.ended)
.set(VideoPlayerStatus.seeking, Html5Event.seeking);

/**
 * Wraps the HTML5 Video-tag functionality under this abstraction
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
 * https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Media_events
 *
 * Uses the basic <Video>-tag aka HTMLVideoElement
 */
export class HTML5Video extends VideoAPI {

  private options: IVideoAPIOptions = {};
  private player: HTMLVideoElement;
  private rootElement: HTMLElement;
  private stateChangeHandlers: {[event: string]: (v: HTML5Video, event: Event) => void} = {};
  /**
   * Keep track of the promises that are expecting state chabnge handlers to fulfill.
   * Cannot have multiple handlers overlap since YouTube API doesn't distinguish specific events.
   */
  private stateChangeHandlersReservations: {[event: string]: string} = {};
  /** Track the status of this Player, since the Video-element has no internal status-tracker, but it works through emiting events. */
  private status: VideoPlayerStatus = VideoPlayerStatus.notLoaded;

  /**
   *
   * @param rootElement Where to inject the IFrame Player?
   * @param playerOptions id must be given to satisfy Typing, but can be later overloaded with loadVideo()
   */
  public constructor(rootElement: HTMLElement, options?: IVideoAPIOptions) {
    super();
    logger.debug(`constructor():> params rootElement=${rootElement}, options=`, options);

    this.rootElement = rootElement;

    if (options) {
      this.options = options;
    }
  }

  public canPause(): boolean {
    return this.canDoAction("pauseVideo");
  }
  public canStart(): boolean {
    return this.canDoAction("startVideo");
  }
  public canStop(): boolean {
    return this.canDoAction("stopVideo");
  }

  /**
   * Delete this instance and kill all pending actions
   */
  public destroy(): void {
    // Try to delete as much about anything that could lead to memory leaks.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management
    if (this.player) {
      this.player.remove();
    }
    this.options = undefined;
  }

  public getDuration(): number | undefined {
    try {
      if (this.player && this.isReady()) {
        const dur = this.player.duration;
        if (isNaN(dur)) {
          return undefined;
        }
        return dur;
      } else {
        return undefined;
      }
    } catch (err) {
      throw err;
    }
  }

  public getPlaybackRate(): number | undefined {
    try {
      if (this.player) {
        return this.player.playbackRate;
      } else {
        return undefined;
      }
    } catch (err) {
      throw err;
    }
  }

  public getPosition(): number | undefined {
    try {
      if (this.player && this.isReady()) {
        return this.player.currentTime;
      } else {
        return undefined;
      }
    } catch (err) {
      throw err;
    }
  }

  public getStatus(): VideoPlayerStatus {
    return this.status;
  }

  public getVolume(): number | undefined {
    try {
      if (this.player && this.isReady()) {
        return this.player.volume * 100; //HTML5 Video Player volume range is 0-1
      } else {
        return undefined;
      }
    } catch (err) {
      throw err;
    }
  }

  public loadVideo(actionId: string, videoUrl:string, options?: IVideoAPIOptions): Promise<HTML5Video> {
    const ctx: string = "loadVideo";
    logger.debug(this.logCtx(actionId, ctx, `params videoUrl=${videoUrl}`));

    if (this.rootElement.tagName !== "video") {
      //Copy the attributes of the given element to the new Video element.
      const video = document.createElement("video");
      video.id = this.rootElement.id;
      video.className = this.rootElement.className;
      //Replace the element
      const parent = this.rootElement.parentElement;
      parent.appendChild(video);
      parent.removeChild(this.rootElement);
      this.player = video;

      this.rootElement.remove();
    } else {
      this.player = this.rootElement as HTMLVideoElement;
    }

    this.injectDefaultHandlers();

    if (options) {
      Object.assign(this.options, options); // Merge options from the constructor with the new options, atleast the videoId must be given.
    }
    this.setIVideoAPIOptionsToVideoAttributes(this.options);

    return new Promise((resolve, reject) => {
      const expectedEvent = videoPlayerStatusToHtml5Event.get(VideoPlayerStatus.cued);
      this.setStateChangeHandler(expectedEvent, actionId, (v: HTML5Video, event: Event): void => {
        logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.${expectedEvent}():> Video loaded`));
        resolve(this);
      });
      this.player.src = videoUrl; //Trigger the load event
    });
  }

  public pauseVideo(actionId: string): Promise<HTML5Video> {
    const ctx: string = "pauseVideo";
    return this._pauseVideo(actionId, ctx);
  }

  public seekVideo(actionId: string, position: number): Promise<HTML5Video> {
    try {
      const ctx: string = "seekVideo";
      const status: VideoPlayerStatus = this.getStatus();
      logger.debug(this.logCtx(actionId, ctx, `position:${position}, status:${status}`));

      return this._seekVideo(actionId, position);

    } catch(err) {
      return Promise.reject(err);
    }
  }

  /**
   * @param playbackRate Desired playback rate, if not given, value in this.options.rate is used.
   */
  public setPlaybackRate(actionId: string, playbackRate?: number): Promise<HTML5Video> {
    const ctx: string = "setPlaybackRate";
    const rate: number = playbackRate || this.options.rate;
    if (rate) {
      logger.debug(this.logCtx(actionId, ctx, `params playbackRate=${playbackRate}, this.options.rate=${this.options.rate}`));

      const oldRate: number = this.player.playbackRate;
      if (rate === oldRate) {
        logger.debug(this.logCtx(actionId, ctx, `rate=${playbackRate} is the same as the current playback rate.`));

        return Promise.resolve(this);
      }

      return new Promise((resolve, reject): void => {
        this.setStateChangeHandler("ratechange", actionId, (v: HTML5Video, event: Event): void => {
          const newRate: number = this.player.playbackRate;
          logger.debug(this.logCtx(actionId, ctx,
            `stateChangeHandlers.ratechange():> Playback rate changed from ${oldRate} to ${newRate}. Requested ${rate}`));
          resolve(this);
        });
        this.player.playbackRate = rate;
      });
    } else {
      return Promise.resolve(this);
    }
  }

  /**
   * @param volume Volume level. 0 sets the player muted
   */
  public setVolume(volume: number): void {
    if (this.player) {
      if (volume === 0) {
        this.player.muted = true;
      } else {
        if (this.player.muted) {
          this.player.muted = false;
        }
        this.player.volume = volume / 100; //HTML5 Video Player volume range is 0-1
      }
    } else {
      logger.warn(`Player not loaded! Cannot set volume=${volume}. In status=${status}`);
    }
  }

  public startVideo(actionId: string): Promise<HTML5Video> {
    const ctx: string = "startVideo";
    logger.debug(this.logCtx(actionId, ctx));

    return new Promise((resolve, reject): void => {
      if (! this.canStart()) {
        logger.info(this.logCtx(actionId, ctx, `Video already status=${this.status}`));

        return resolve(this);
      }

      const expectedEvent = videoPlayerStatusToHtml5Event.get(VideoPlayerStatus.started);
      this.setStateChangeHandler(expectedEvent, actionId, (v: HTML5Video, event: Event): void => {
        logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.${expectedEvent}():> Play started`));
        resolve(this);
      });
      this.player.play();
    });
  }

  /** HTML5 Video API has no stop-action. */
  public stopVideo(actionId: string, ): Promise<HTML5Video> {
    const ctx: string = "stopVideo";
    return this._pauseVideo(actionId, ctx, true);
  }

  private _pauseVideo(actionId: string, ctx: string, stopped?: boolean): Promise<HTML5Video> {
    logger.debug(this.logCtx(actionId, ctx));

    return new Promise((resolve, reject) => {
      if (! this.canPause()) {
        logger.info(this.logCtx(actionId, ctx, `Video already ${this.getStatus()}`));

        return resolve(this);
      }

      const expectedEvent = videoPlayerStatusToHtml5Event.get(VideoPlayerStatus.paused);
      this.setStateChangeHandler(expectedEvent, actionId, (v: HTML5Video, event: Event): void => {
        logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.${expectedEvent}():> Play paused ${stopped ? "(HTML5 Video doesn't support stop)" : ""}`));
        resolve(this);
        if (stopped) {
          this.status = VideoPlayerStatus.stopped; //Cheat a bit to synchronize statuses with video players that support stop
        }
      });
      this.player.pause();
    });
  }

  /** Just seek with no safety checks */
  private _seekVideo(actionId: string, position: number): Promise<HTML5Video> {
    const oldStatus: VideoPlayerStatus = this.getStatus();
    const ctx: string = "_seekVideo";
    logger.debug(this.logCtx(actionId, ctx, `position:${position}, status:${oldStatus}`));

    return new Promise((resolve, reject) => {

      const func = (v: HTML5Video, event: Event): void => {
        logger.debug(this.logCtx(actionId, ctx, `stateChangeHandlers.${this.getStatus()}():> Position seeked`));
        resolve(this);
      };
      this.setStateChangeHandler("canplay", actionId, func); //Firstly seeked-event is triggered, then canplay
      this.player.currentTime = position;
    });
  }

  private canDoAction(action: string): boolean {
    const ac = uselessTransitions.get(action);
    if (ac) {
      if (ac.get(this.getStatus())) {
        return false;
      } else {
        return true;
      }
    }
  }

  /**
   * Pass in default handlers for various Player events if none supplied
   *
   * @param resolve upstream Promise resolver
   * @param reject  upstream Promise resolver
   */
  private injectDefaultHandlers(): void {
    const v: HTMLVideoElement = this.player;

    //First, seed the player with listeners for all known actions. This is used to understand the player internals better.
    const addDefaultListener = (eventName: string) => {
      v.addEventListener(eventName, (event: Event) => {
        logger.debug(`eventName=${eventName}, event.type=${event.type} captured`, event);

        //Trigger any attached stateChangeHandlers
        this.triggerStateChangeHandler(event);
      }, true); //Capture before bubbling
    };
    for (var e in Html5Event) {
      if (Html5Event.hasOwnProperty(e) && !/^\d+$/.test(e)) {
          addDefaultListener(e);
      }
    }
  }

  /** Is the Player considered loaded? */
  private isReady(): boolean {
    if (this.status === VideoPlayerStatus.notLoaded ||
        this.status === VideoPlayerStatus.cueing) {
          return false;
    }
    return true;
  }
  /**
   * Seed the basic attributes for the Player
   * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
   */
  private setIVideoAPIOptionsToVideoAttributes(opts: IVideoAPIOptions): void {
    const v = this.player;
    v.autoplay = opts.autoplay ? true : false;
    v.controls = opts.controls ? true : false;
    v.crossOrigin = "anonymous";
    v.loop = opts.loop ? true : false;
    v.muted = opts.volume === 0 ? true : false;
    v.preload = "metadata"; //Changing this to "none" will cause the 'loadeddata'-event to not trigger when video is loaded. Change will require retesting of the event handling subsystem.
    v.height = opts.height;
    v.width = opts.width;
    this.setVolume(opts.volume);
    v.playbackRate = opts.rate || 1;
    v.currentTime = opts.start || 0;
  }

  /** Defensive programming (TM) */
  private castToHtml5Event(e: string): Html5Event {
    if ((Html5Event[(e as Html5Event)]) !== undefined) {
      return Html5Event[(e as Html5Event)];
    } else {
      throw new BadParameterException(`Unmapped Html5Event '${e}'`);
    }
  }
  /** Triggers and releases a handler for the given event */
  private triggerStateChangeHandler(event: Event) {
    //Update player status
    const st = Html5EventToVideoPlayerStatus.get(this.castToHtml5Event(event.type));
    if (st !== undefined) {
      this.status = st;
      logger.info("New status="+st);
    }
    //Trigger the event handler
    if (this.stateChangeHandlers[event.type]) {
      this.stateChangeHandlers[event.type](this, event);
      this.stateChangeHandlerFulfilled(event);
    }
  }

  /** Create a single-use state change handler */
  private setStateChangeHandler(event: string, actionId: string, handler: (v: HTML5Video, event: Event) => void): void {
    if (this.stateChangeHandlersReservations[event] !== undefined) {
      logger.error(new StateChangeHandlerReservedException(this.logCtx(actionId, event,
        `Handler already used by Promise=${this.stateChangeHandlersReservations[event]} and waiting for fulfillment from YouTube IFrame Player`))
      );
    }
    this.stateChangeHandlersReservations[event] = actionId;
    this.stateChangeHandlers[event] = handler;
  }

  /** One must call this to mark a stateChangeHandler resolved */
  private stateChangeHandlerFulfilled(event: Event, actionId?: string): void {
    if (this.stateChangeHandlersReservations[event.type] === undefined ||
        this.stateChangeHandlers[event.type] === undefined) {
      let err = "";
      if (this.stateChangeHandlersReservations[event.type] === undefined) {
        err += `No promise reservation for event=${event.type}. `;
      }
      if (this.stateChangeHandlers[event.type] === undefined) {
        err += `No handler for event=${event.type}. `;
      }
      logger.error(new StateChangeHandlerReservedException(this.logCtx(actionId, event.type, err)));
    }
    this.stateChangeHandlersReservations[event.type] = undefined;
    this.stateChangeHandlers[event.type] = undefined;
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
