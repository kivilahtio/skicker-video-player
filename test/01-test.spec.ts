"use strict";

import * as $ from "jquery";
import { VideoPlayer } from "../src/VideoPlayer";
import * as dom from "./helpers/dom";

describe("Play a video from YouTube using a headless player", () => {
  let videoPlayer: VideoPlayer;
  let vpElement: Element = dom.appendBodyElement("div", "video-player");

  describe("Create a new VideoPlayer", () => {
    it("Instantiate a new VideoPlayer", () => {
      videoPlayer = new VideoPlayer(vpElement);

      expect(videoPlayer)
      .toEqual(jasmine.any(VideoPlayer)); //videoPlayer is a VideoPlayer
    });
    it("VideoPlayer injected into the given HTML element", () => {
      const htmlElementsCreated =
        $(vpElement)
        .find(".video-player-display")
        .length;

      expect(htmlElementsCreated)
      .toBeGreaterThanOrEqual(1);
    });
  });

  describe("Start the video", () => {
    it("Play-action triggered", () => {
      videoPlayer
      .loadVideo(new URL("https://www.youtube.com/watch?v=nVRqq947lNo"));
      //.startVideo();

      //expect(videoPlayer).toBe(true);
    });
  });
});
