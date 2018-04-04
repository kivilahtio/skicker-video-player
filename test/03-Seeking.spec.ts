"use strict";

import * as $ from "jquery";

import { BadPlaybackRateException } from "../src/Exception/BadPlaybackRate";
import { YouTubeVideo } from "../src/VideoAPI/YouTubeVideo";
import { SupportedVideoAPIs, VideoAPI } from "../src/VideoAPI";
import { VideoPlayer } from "../src/VideoPlayer";
import * as dom from "./helpers/dom";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("Seek a video", () => {
  let videoPlayer: VideoPlayer;
  const vpElement: HTMLElement = dom.appendBodyElement("div", "youtube-video-player", "video-player");

  describe("Create a new VideoPlayer,", () => {
    it("Instantiate a new VideoPlayer", () => {
      videoPlayer = new VideoPlayer(vpElement, {}, new URL('https://www.youtube.com/watch?v=C0DPdy98e4c'));

      expect(videoPlayer)
      .toEqual(jasmine.any(VideoPlayer)); //videoPlayer is a VideoPlayer
    });
  });

  describe("Load the video,", () => {
    it("Load-action triggered", () =>
      videoPlayer
      .loadVideo()
      .then(() => {
        expect(true)
        .toBe(true);
      }),
    );
  });

  describe("Seek when VideoPlayer is freshly loaded,", () => {
    it("Seek-action triggered", () =>
      videoPlayer
      .seekVideo(10.500)
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("paused");

        const pos: number = videoPlayer.getVideoAPI().getPosition();
        expect(pos).toBeGreaterThanOrEqual(10.500);
        expect(pos).toBeLessThanOrEqual(11.000);
      }),
    );
    it("Seek-action triggered again to test onStateChangeHandlers for same-state transition", () =>
      videoPlayer
      .seekVideo(11.500)
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("paused");

        const pos: number = videoPlayer.getVideoAPI().getPosition();
        expect(pos).toBeGreaterThanOrEqual(11.500);
        expect(pos).toBeLessThanOrEqual(12.000);
      }),
    );
  });

  describe("Start playing and seek,", () => {
    it("Start-action triggered", () =>
      videoPlayer.startVideo()
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("playing");
      }),
    );

    it("Seek-action triggered", () =>
      videoPlayer
      .seekVideo(13.2500)
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("playing");

        const pos: number = videoPlayer.getVideoAPI().getPosition();
        expect(pos).toBeGreaterThanOrEqual(13.250);
        expect(pos).toBeLessThanOrEqual(13.750);
      }),
    );

    it("Seek-action triggered again to test onStateChangeHandlers for same-state transition", () =>
      videoPlayer
      .seekVideo(14.2500)
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("playing");

        const pos: number = videoPlayer.getVideoAPI().getPosition();
        expect(pos).toBeGreaterThanOrEqual(14.250);
        expect(pos).toBeLessThanOrEqual(14.750);
      }),
    );
  });

  describe("Stop the video and seek,", () => {
    it("Stop-action triggered", () =>
      videoPlayer
      .stopVideo()
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("unstarted");
      }),
    );

    it("Seek-action triggered", () =>
      videoPlayer
      .seekVideo(1.666)
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("paused");

        const pos: number = videoPlayer.getVideoAPI().getPosition();
        expect(pos).toBeGreaterThanOrEqual(1.666);
        expect(pos).toBeLessThanOrEqual(2.166);
      }),
    );

    it("Seek-action triggered again to test onStateChangeHandlers for same-state transition", () =>
      videoPlayer
      .seekVideo(2.555)
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("paused");

        const pos: number = videoPlayer.getVideoAPI().getPosition();
        expect(pos).toBeGreaterThanOrEqual(2.555);
        expect(pos).toBeLessThanOrEqual(2.655);
      }),
    );
  });

  describe("Destroy the video player,", () => {
    it("Destroy-action triggered", () => {
      videoPlayer
      .destroy();
      expect($(vpElement)
             .find("*").length)
      .toBe(0);
    });
  });
});
