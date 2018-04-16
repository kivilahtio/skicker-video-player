import * as $ from "jquery";

import { BadPlaybackRateException } from "../src/Exception/BadPlaybackRate";
import { YouTubeVideo } from "../src/VideoAPI/YouTubeVideo";
import { SupportedVideoAPIs, VideoAPI, VideoPlayerStatus } from "../src/VideoAPI";
import { VideoPlayer } from "../src/VideoPlayer";
import * as dom from "./helpers/dom";
import * as tu from "./helpers/testutils";

import { LoggerManager } from "skicker-logger-manager";
const logger = LoggerManager.getLogger("Skicker.test.10");

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000; //High timeout because under one test is queued a lot of Promises

describe("Play a video from YouTube using a headless player,", () => {
  let videoPlayer: VideoPlayer;

  it("Instantiate a new VideoPlayer", () => {
    logger.info("Instantiate a new VideoPlayer");
    videoPlayer = tu.createPlayer(new URL("https://www.youtube.com/watch?v=nVRqq947lNo"),
                                  {},
                                  undefined
    );
    expect(videoPlayer)
    .toEqual(jasmine.any(VideoPlayer)); //videoPlayer is a VideoPlayer
  });

  /*
   * VideoPlayer can get flooded with mutually exclusive actions, or actions that behave really wonky when timed properly.
   * Test flooding actions and surviving using an actionQueue in the VideoPlayer.
   * Expecting the Promises to resolve in the order they are triggered
   */
  describe("Queue a ton of actions,", () => {
    it("Queuing a bit and resolving in the order triggered...", () => {
      logger.info("Queuing a bit and resolving in the order triggered...");
      const actionQueue = (videoPlayer as any).actionQueue;
      const promises = new Array<Promise<any>>();
      promises.push(videoPlayer
      .loadVideo()
      .then(() => {
        expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.cued);
        expect(actionQueue.length).toBe(2, "Video loaded and actionQueue should be 2");
      }));
      // Load Video twice in a row. If YouTube Player gets these requests, it will fail miserably. Protect the Core!
      promises.push(videoPlayer
        .loadVideo()
        .then(() => {
          expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.cueing); //We have a previous action loadVideo():ing, so we get a transitional status.
          expect(actionQueue.length).toBe(3, "Video re-load rejected. ActionQueue should be 3 since no action has completed yet.");
        }));
      // Loading a video, and starting it immediately afterwards causes issues with the VideoAPI being instantiated,
      // but the internal Player throwing exceptions.
      promises.push(tu.start()
      .then(() => {
        expect(actionQueue.length).toBe(1, "Video started and actionQueue should be 1");
      }));
      promises.push(tu.pause()
      .then(() => {
        expect(actionQueue.length).toBe(0, "Video paused and actionQueue should be 0");
      }));

      //Expect a lot of actions to be waiting in the queue.
      expect(actionQueue.length).toBe(3, "3 actions queued and waiting to resolve.");

      return Promise.all(promises)
      .then(() => { logger.info("Queue a bit ended"); });
    });

    it("Queuing a ton and resolving in the order triggered...", () => {
      logger.info("Queuing a ton and resolving in the order triggered...");
      const actionQueue = (videoPlayer as any).actionQueue;
      const promises = new Array<Promise<any>>();
      promises.push(tu.start()
      .then(() => {
        expect(actionQueue.length).toBe(5, "Video started and actionQueue is 5");
      }));
      promises.push(tu.pause()
      .then(() => {
        expect(actionQueue.length).toBe(4, "Video paused and actionQueue is 4");
      }));
      promises.push(tu.seek(8.000, 0.250)
      .then((vapi: VideoPlayer) => {
        expect(vapi.getStatus()).toBe(VideoPlayerStatus.paused);
        expect(actionQueue.length).toBe(3, "Video seeked and actionQueue is 3");
      }));
      promises.push(tu.start()
      .then(() => {
        expect(actionQueue.length).toBe(2, "Video started and actionQueue is 2");
        // Queue a pause-action at the end of the current queue!
        // When this resolves, the queue is empty
        promises.push(videoPlayer.pauseVideo()
        .then((vapi: VideoPlayer) => {
          expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.cued, "Then Video is cued, because it was cued before pausing");

          return vapi;
        })
        .then(() => {
          expect(actionQueue.length).toBe(0);
        }));
      }));
      promises.push(tu.seek(16.000, 0.250)
      .then((vapi: VideoPlayer) => {
        expect(vapi.getStatus()).toBe(VideoPlayerStatus.started);
        expect(actionQueue.length).toBe(2, "Video seeked again and actionQueue is 2"); //Should be 1, but a pause-action was triggered midway
      }));
      promises.push(tu.stop()
      .then(() => {
        expect(actionQueue.length).toBe(1, "Video stopped and actionQueue is 1"); //Should be 0, but a pause-action was triggered midway
      }));

      //Expect a lot of actions to be waiting in the queue.
      expect(actionQueue.length).toBe(6, "6 actions queued and waiting to resolve."); //No including the pause-action triggered midway

      return Promise.all(promises)
      .then(() => Promise.all(promises) //We need to catch those promises again, because we have promises created during resolving of the first batch
        .then(() => logger.info("Queue a ton ended"))
      );
    });
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
        .toEqual(jasmine.any(BadPlaybackRateException), "Got a BadPlaybackRateException");
        expect(err.message)
        .toContain("This is not on the list of allowed playback rates", "Error message as expected");
      }),
    );

    it("Setting an accepted playback rate", () =>
      videoPlayer.setPlaybackRate(0.5)
      .then(() => {
        expect(videoPlayer.getPlaybackRate())
        .toEqual(0.5);
      }),
    );

    it("Setting the same rate accidentally again", () => // YouTube Player doesn't trigger the onPlaybackRateChange() callback in this case!
      videoPlayer.setPlaybackRate(0.5)
      .then(() => {
        expect(videoPlayer.getPlaybackRate())
        .toEqual(0.5);
      }),
    );
  });

  it("Destroy the video player,", () => {
    logger.info("Destroy the video player");
    tu.destroy();
  });
});
