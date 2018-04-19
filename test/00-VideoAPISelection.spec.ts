import * as $ from "jquery";
import { YouTubeVideo } from "../src/VideoAPI/YouTubeVideo";
import { SupportedVideoAPIs, VideoAPI, VideoPlayerStatus } from "../src/VideoAPI";
import { VideoPlayer } from "../src/VideoPlayer";
import { BadParameterException } from "../src/Exception/BadParameter";
import { UnknownVideoSourceException } from "../src/Exception/UnknownVideoSource";
import * as dom from "./helpers/dom";
import * as tu from "./helpers/testutils";

import { LoggerManager } from "skicker-logger-manager";
const logger = LoggerManager.getLogger("Skicker.test.01");

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

const vpElement: HTMLElement = dom.appendBodyElement("div", "youtube-video-player", "video-player");

describe("VideoPlayer URL parsing,", () => {
  describe("YouTube video URL parsing,", () => {
    it("Good url, short type", () => {
      const url: URL = new URL("https://youtu.be/BrW89n0Hss4");
      const vp: VideoPlayer = new VideoPlayer(vpElement, {}, url);
      expect(vp.getVideoId())
      .toEqual("BrW89n0Hss4");
    });
    it("Bad url, short type", () => {
      const url: URL = new URL("https://youtu.be/");
      expect(() => new VideoPlayer(vpElement, {}, url))
      .toThrowError(
        BadParameterException,
        `URL '${url.toString()}' doesn't include the video id. Using video source '${SupportedVideoAPIs.YouTube}'. Expected the URL to look like 'https://youtu.be/d1mX_MBz0HU'`
      );
    });
    it("Good url, long type", () => {
      const url: URL = new URL("https://www.youtube.com/watch?v=C0DPdy98e4c");
      const vp: VideoPlayer = new VideoPlayer(vpElement, {}, url);
      expect(vp.getVideoId())
      .toEqual("C0DPdy98e4c");
    });
    it("Bad url, long type", () => {
      const url: URL = new URL("https://www.youtube.com/watch?xxx=C0DPdy98e4c");
      expect(() => new VideoPlayer(vpElement, {}, url))
      .toThrowError(
        BadParameterException,
        `URL '${url.toString()}' doesn't include the video id. Using video source '${SupportedVideoAPIs.YouTube}'. Expected the URL to look like 'https://www.youtube.com/watch?v=d1mX_MBz0HU'`
      );
    });
  });

  describe("HTML5 Video URL parsing,", () => {
    it(".mp4", () => {
      const url: URL = new URL("https://media.skicer.fi/nice.mp4");
      const vp: VideoPlayer = new VideoPlayer(vpElement, {}, url);
      expect(vp.getVideoId())
      .toEqual("https://media.skicer.fi/nice.mp4");
    });
    it("wrong type", () => {
      const url: URL = new URL("https://media.skicker.fi/nice.avi");
      expect(() => new VideoPlayer(vpElement, {}, url))
      .toThrowError(
        BadParameterException,
        `URL '${url.toString()}' points to a file, but the Video type 'avi' is unsupported. Using video source '${SupportedVideoAPIs.HTML5Video}'. Expected the URL to look like 'https://example.com/path-to-video/video.mp4'`
      );
    });
    it("Local file", () => {
      const url: URL = new URL("file://home/kivilahtio/Video/nice.webm");
      const vp: VideoPlayer = new VideoPlayer(vpElement, {}, url);
      expect(vp.getVideoId())
      .toEqual("file://home/kivilahtio/Video/nice.webm");
    });
  });

  describe("Unknown video source,", () => {
    it("Unknown video source", () => {
      const url: URL = new URL("https://www.skicker.com");
      expect(() => (new VideoPlayer(vpElement, {}, url)))
      .toThrowError(UnknownVideoSourceException, `Couldn't identify a known video source from URL '${url.toString()}'`);
    });
  });
});

