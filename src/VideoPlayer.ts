"use strict";

import { SupportedVideoAPIs, VideoAPI } from "./VideoAPI";
import { YouTubeVideo } from "./VideoAPI/YouTubeVideo";

import { RegExpParsingException } from "./Exception/RegExpParsing";
import { UnknownVideoSourceException } from "./Exception/UnknownVideoSource";

import { log4javascript, LoggerManager } from "skicker-logger-manager";
const logger: log4javascript.Logger = LoggerManager.getLogger("Skicker.VideoPlayer");

export class VideoPlayer {

  private api: SupportedVideoAPIs;
  private rootElement: Element;
  private videoAPI: VideoAPI;
  private videoId: string;
  private youTubeURLParsingRegexp: RegExp = /[&?]v=(\w+)(?:\?|$)/;

  public constructor(rootElement: Element) {
    logger.debug(`constructor():> params rootElement=${rootElement})`);
    this.rootElement = rootElement;
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
   * Loads a video into the given root element from a remote service.
   *
   * @param url Full URL to the video source.
   */
  public loadVideo(url: URL): Promise<VideoAPI>;
  /**
   * @param id Video id of the remote service
   * @param api A supported video source API name. You can try casting a dynamic variable using "let api: SupportedVideoAPIs = SupportedVideoAPIs['YouTube'];"
   */
  public loadVideo(id: string, api: SupportedVideoAPIs): Promise<VideoAPI>;
  public loadVideo(urlOrId: URL | string, api?: SupportedVideoAPIs): Promise<VideoAPI> {
    logger.debug(`loadVideo():> params urlOrId=${urlOrId}, api=${api}`);

    let url: URL;
    if (typeof urlOrId === "string") { //This is a video id, infer the video url hostname from the api
      this.videoId = urlOrId;
      this.api = api;
      this.videoAPI = this.selectVideoAPI(this.api);
    } else {
      url = urlOrId;
      this.videoAPI = this.selectVideoAPIFromURL(url);
    }

    return this.videoAPI.loadVideo(this.videoId);
  }

  public startVideo(): Promise<VideoAPI> {
    logger.debug("startVideo()");

    return this.videoAPI.startVideo();
  }

  public stopVideo(): Promise<VideoAPI> {
    logger.debug("stopVideo()");

    return this.videoAPI.stopVideo();
  }

  private selectVideoAPI(api: SupportedVideoAPIs): VideoAPI {
    logger.debug(`selectVideoAPI():> params api=${api}`);

    if (api === SupportedVideoAPIs.YouTube) {
      const options: YT.PlayerOptions = {
        videoId: "asd",
      };

      return new YouTubeVideo(this.rootElement, options);

//    else if (api === SupportedVideoAPIs.Vimeo) {
//      return new VimeoVideo();

    } else {
      throw new UnknownVideoSourceException(`Video source '${api}' is not supported`);
    }
  }
  private selectVideoAPIFromURL(url: URL): VideoAPI {
    logger.debug(`selectVideoAPIFromURL():> params url=${url}`);

    if (url.hostname === "www.youtube.com") {
      this.api = SupportedVideoAPIs.YouTube;

      const match: RegExpExecArray = this.youTubeURLParsingRegexp.exec(url.toString());
      if (match[1]) {
        this.videoId = match[1];
      } else {
        throw new RegExpParsingException(`Couldn't parse URL '${url.toString}' using video source '${this.api}'`);
      }
      const options: YT.PlayerOptions = {
        videoId: this.videoId,
      };

      return new YouTubeVideo(this.rootElement, options);

//    } else if (url.hostname === "www.vimeo.com") {
//      return new VimeoVideo();

    } else {
      throw new UnknownVideoSourceException(`Couldn't identify a known video source from URL '${url.toString()}'`);
    }
  }
}

