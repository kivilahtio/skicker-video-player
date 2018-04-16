"use strict";

import * as $ from "jquery";

import { VideoPlayerStatus } from "../src/VideoAPI";
import { YouTubeVideo } from "../src/VideoAPI/YouTubeVideo";
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

  describe("playOrPauseVideo() when VideoPlayer is freshly loaded,", () => {
    it("playOrPauseVideo-action triggered", () =>
      videoPlayer
      .playOrPauseVideo()
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe(VideoPlayerStatus.started);
      }),
    );
    it("playOrPauseVideo()-action triggered again", () =>
      videoPlayer
      .playOrPauseVideo()
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe(VideoPlayerStatus.paused);
      }),
    );
    it("playOrPauseVideo()-action triggered again", () =>
      videoPlayer
      .playOrPauseVideo()
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe(VideoPlayerStatus.started);
      }),
    );
  });

  describe("Stop playing and playOrPauseVideo() again,", () => {
    it("Stop-action triggered", () =>
      videoPlayer.stopVideo()
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe(VideoPlayerStatus.stopped);
      }),
    );

    it("playOrPauseVideo-action triggered", () =>
      videoPlayer
      .playOrPauseVideo()
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe(VideoPlayerStatus.started);
      }),
    );
    it("playOrPauseVideo()-action triggered again", () =>
      videoPlayer
      .playOrPauseVideo()
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe(VideoPlayerStatus.paused);
      }),
    );
    it("playOrPauseVideo()-action triggered again", () =>
      videoPlayer
      .playOrPauseVideo()
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe(VideoPlayerStatus.started);
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
