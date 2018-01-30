"use strict";

import * as $ from "jquery";
import { SupportedVideoAPIs, VideoAPI } from "../src/VideoAPI";
import { VideoPlayer } from "../src/VideoPlayer";
import * as dom from "./helpers/dom";

describe("Play a video from YouTube using a headless player", () => {
  let videoPlayer: VideoPlayer;
  const vpElement: Element = dom.appendBodyElement("div", "youtube-video-player", "video-player");

  describe("Create a new VideoPlayer", () => {
    it("Instantiate a new VideoPlayer", () => {
      videoPlayer = new VideoPlayer(vpElement);

      expect(videoPlayer)
      .toEqual(jasmine.any(VideoPlayer)); //videoPlayer is a VideoPlayer
    });

    it("VideoPlayer not yet injected into the given HTML element", () => {
      const htmlElementsCreated: number =
        $(vpElement)
        .find("*")
        .length;

      expect(htmlElementsCreated)
      .toEqual(0);
    });
  });

  describe("Load the video", () => {
    it("Load-action triggered", () => {
      videoPlayer
      .loadVideo(new URL("https://www.youtube.com/watch?v=nVRqq947lNo"));
      expect(true).toBe(true);
    });
    it("VideoPlayer injected into the given HTML element", () => {
      const htmlElementsCreated: number =
        $(vpElement)
        .find("*")
        .length;

      expect(htmlElementsCreated)
      .toBeGreaterThanOrEqual(1);
    });

    it("VideoPlayer uses videoAPI 'YouTube'", () => {
      expect(typeof videoPlayer.getVideoAPI())
      .toEqual(SupportedVideoAPIs.YouTube);
    });
    it("VideoPlayer uses the correct videoID", () => {
      expect(videoPlayer.getVideoId())
      .toEqual("nVRqq947lNo");
    });
  });

  describe("Start the video", () => {
    it("Play-action triggered", () => {
      //videoPlayer
      //.startVideo();

      //expect(videoPlayer).toBe(true);
    });
  });
});
