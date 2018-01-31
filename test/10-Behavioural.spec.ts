"use strict";

import * as $ from "jquery";

import { BadPlaybackRateException } from "../src/Exception/BadPlaybackRate";
import { YouTubeVideo } from "../src/VideoAPI/YouTubeVideo";
import { SupportedVideoAPIs, VideoAPI } from "../src/VideoAPI";
import { VideoPlayer } from "../src/VideoPlayer";
import * as dom from "./helpers/dom";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("Play a video from YouTube using a headless player,", () => {
  let videoPlayer: VideoPlayer;
  const vpElement: Element = dom.appendBodyElement("div", "youtube-video-player", "video-player");

  describe("Create a new VideoPlayer,", () => {
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

  describe("Load the video,", () => {
    it("Load-action triggered", () =>
      videoPlayer
      .loadVideoFromURL(new URL("https://www.youtube.com/watch?v=nVRqq947lNo"))
      .then(() => {
        expect(true)
        .toBe(true);
      }),
    );
    it("VideoPlayer injected into the given HTML element", () => {
      expect(
        $("#youtube-video-player")
        .prop("nodeName")
      )
      .toEqual("IFRAME");
    });

    it("VideoPlayer uses videoAPI 'YouTube'", () => {
      expect(videoPlayer.getVideoAPI())
      .toEqual(jasmine.any(YouTubeVideo));
    });
    it("VideoPlayer uses the correct videoID", () => {
      expect(videoPlayer.getVideoId())
      .toEqual("nVRqq947lNo");
    });
  });

  describe("Start the video,", () => {
    it("Play-action triggered", () =>
      videoPlayer
      .startVideo()
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("playing");
      }),
    );
  });

  describe("Change playback rate,", () => {
    it("Setting a bad playback rate", () =>
      videoPlayer.setPlaybackRate(55.5)
      .then(() => {
        expect("This should throw an exception")
        .toEqual("But no exception was thrown");
      })
      .catch((err: Error) => {
        expect(err)
        .toEqual(jasmine.any(BadPlaybackRateException));
        expect(err.message)
        .toContain("This is not on the list of allowed playback rates");
      }),
    );

    it("Setting an accepted playback rate", () =>
      videoPlayer.setPlaybackRate(0.5)
      .then(() => {
        expect(videoPlayer.getVideoAPI().getPlaybackRate())
        .toEqual(0.5);
      }),
    );

    it("Setting the same rate accidentally again", () => // YouTube Player doesn't trigger the onPlaybackRateChange() callback in this case!
    videoPlayer.setPlaybackRate(0.5)
    .then(() => {
      expect(videoPlayer.getVideoAPI().getPlaybackRate())
      .toEqual(0.5);
    }),
  );
  });

  describe("Stop the video,", () => {
    it("Stop-action triggered", () =>
      videoPlayer
      .stopVideo()
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("unstarted");
      }),
    );
  });
});
