"use strict";

import { SupportedVideoAPIs, VideoAPI } from "./VideoAPI";
import { YouTubeVideo } from "./VideoAPI/YouTubeVideo";

import { RegExpParsingException } from "./Exception/RegExpParsing";
import { UnknownVideoSourceException } from "./Exception/UnknownVideoSource";

export class VideoPlayer {

  private api: SupportedVideoAPIs;
  private videoAPI: VideoAPI;
  private videoId: string;
  private rootElement: Element;
  private youTubeURLParsingRegexp: RegExp = /[&?]v=(\w+)(?:\?|$)/;

  public constructor(rootElement: Element) {
    this.rootElement = rootElement;
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

    let url: URL;
    if (typeof urlOrId === "string") { //This is a video id, infer the video url hostname from the api
      this.videoId = urlOrId;
      this.api = api;
      this.videoAPI = this.getVideoAPI(this.api);
    } else {
      url = urlOrId;
      this.videoAPI = this.getVideoAPIFromURL(url);
    }

    return this.videoAPI.loadVideo(this.videoId);
  }

  public startVideo(): void {
    return this.videoAPI.startVideo();
  }

  private getVideoAPI(api: SupportedVideoAPIs): VideoAPI {
    if (api === SupportedVideoAPIs.YouTube) {
      return new YouTubeVideo(this.rootElement);

//    else if (api === SupportedVideoAPIs.Vimeo) {
//      return new VimeoVideo();

    } else {
      throw new UnknownVideoSourceException(`Video source '${api}' is not supported`);
    }
  }
  private getVideoAPIFromURL(url: URL): VideoAPI {

    if (url.hostname === "www.youtube.com") {
      this.api = SupportedVideoAPIs.YouTube;

      const match: RegExpExecArray = this.youTubeURLParsingRegexp.exec(url.toString());
      if (match[1]) {
        this.videoId = match[1];
      } else {
        throw new RegExpParsingException(`Couldn't parse URL '${url.toString}' using video source '${this.api}'`);
      }

      return new YouTubeVideo(this.rootElement);

//    } else if (url.hostname === "www.vimeo.com") {
//      return new VimeoVideo();

    } else {
      throw new UnknownVideoSourceException(`Couldn't identify a known video source from URL '${url.toString()}'`);
    }
  }
}

