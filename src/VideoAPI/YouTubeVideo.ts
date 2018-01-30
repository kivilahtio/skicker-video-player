/**
 * https://developers.google.com/youtube/iframe_api_reference
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/youtube/index.d.ts is in tsconfig.json to make typings available
 */

import { VideoAPI, VideoPlayerStatus } from "../VideoAPI";

import { MissingHandlerException } from "../Exception/MissingHandler";
import { UnknownStateException } from "../Exception/UnknownState";

import { log4javascript, LoggerManager } from "skicker-logger-manager";
const logger: log4javascript.Logger = LoggerManager.getLogger("Skicker.VideoAPI.YouTubeVideo");

enum YouTubeIFramePlayerEvents {
  onReady,
  onStateChange,
}

type YouTubeIFramePlayerEventHandler = (event: Event) => void;

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
  private rootElement: Element;
  private stateChangeHandlers: {[key: string]: (ytv: YouTubeVideo, event: YT.PlayerEvent) => void} = {};
  private ytPlayer: YT.Player;
  private ytPlayerOptions: YT.PlayerOptions;

  /**
   *
   * @param rootElement Where to inject the IFrame Player?
   * @param ytPlayerOptions id must be given to satisfy Typing, but can be later overloaded with loadVideo()
   */
  public constructor(rootElement: Element, ytPlayerOptions: YT.PlayerOptions) {
    super();
    logger.debug(`constructor():> params rootElement=${rootElement}, ytPlayerOptions=${ytPlayerOptions}`);
    this.rootElement = rootElement;
    this.ytPlayerOptions = ytPlayerOptions;
  }

  public getStatus(): VideoPlayerStatus {
    const stateName: string = this.translatePlayerStateEnumToString(this.ytPlayer.getPlayerState());

    return stateName as VideoPlayerStatus;
  }

  public loadVideo(id?: string): Promise<YouTubeVideo> {
    logger.debug(`loadVideo():> params id=${id}`);

    if (!(id) && !(this.ytPlayerOptions.videoId)) {
      return Promise.reject("loadVideo():> No videoId found from the constructor() or given for the loadVideo()");
    }
    if (id) {
      this.ytPlayerOptions.videoId = id;
    }

    return this.initIFrameAPI()
    .then((res: YouTubeVideo) => this.createPlayer());
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
      throw new UnknownStateException(`translatePlayerStateEnumToString():> Unknown state=${state}`);
    }
  }

  /**
   * 3. This function creates an <iframe> (and YouTube player) after the API code downloads.
   */
  private createPlayer(): Promise<YouTubeVideo> {
    if (! this.ytPlayer) {
      logger.debug("createPlayer():> Creating a new player");

      return new Promise<YouTubeVideo> ((resolve: (value:YouTubeVideo) => void, reject: (value:string) => void): void => {
        this.injectDefaultHandlers(resolve, reject);

        logger.debug("createPlayer():> elementId=", this.rootElement.id, "options=", this.ytPlayerOptions);
        this.ytPlayer = new YT.Player(this.rootElement.id, this.ytPlayerOptions);
      });
    } else {
      logger.debug("createPlayer():> Player exists, Promise resolved");

      return Promise.resolve(this);
    }
  }

  /**
   * 2. This code loads the IFrame Player API code asynchronously.
   * Makes sure the API code is loaded once even when using multiple players on the same document
   */
  private initIFrameAPI(): Promise<YouTubeVideo> {
    logger.debug("initIFrameAPI():> ");
    if (! document.getElementById("youtube-iframe_api")) {
      const tag: Element = document.createElement("script");

      tag.setAttribute("src", "https://www.youtube.com/iframe_api");
      tag.setAttribute("id", "youtube-iframe_api");
      const firstScriptTag: Element = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      return new Promise<YouTubeVideo> ((resolve: (value:YouTubeVideo) => void, reject: (value:string) => void): void => {

        // If script cannot be downloaded and processed in 10s, trigger a timeout and fail the promise.
        const iframeInitializationTimeoutInMillis: number = 10000;
        const timeoutter: number = setTimeout(
          () => {
            logger.error("onYouTubeIframeAPIReady():> IFrame API loading timed out");
            reject("Promise timed out");
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
  private injectDefaultHandlers(resolve: (value:YouTubeVideo) => void, reject: (value:string) => void): void {
    if (! this.ytPlayerOptions.events) {
      this.ytPlayerOptions.events = {};
    }

    // The API will call this function when the video player is ready.
    const onPlayerReady: YT.PlayerEventHandler<YT.PlayerEvent> = (event:YT.PlayerEvent): void => {
      logger.debug(`onPlayerReady():> params state=${this.translatePlayerStateEnumToString(event.target.getPlayerState())}, Promise resolved`);
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
  }
}
