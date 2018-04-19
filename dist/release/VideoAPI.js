"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Define the video playing sources supported
 */
var SupportedVideoAPIs;
(function (SupportedVideoAPIs) {
    SupportedVideoAPIs["YouTube"] = "YouTube";
    SupportedVideoAPIs["HTML5Video"] = "HTML5Video";
})(SupportedVideoAPIs = exports.SupportedVideoAPIs || (exports.SupportedVideoAPIs = {}));
/*
 * Statuses the VideoPlayer can be in.
 *
 * stopping/ending/... transitions denote a Promise being resolved. When the corresponding Promise is resolved, status is transitioned to stopped/ended/...
 *
 * YouTube Player updates the status to match the action when the action has been resolved,
 *     eg. started-status only after the start()-action is resolved
 * Need to know also when a transition is happening, to allow timing actions more closely from asynchronous user actions.
 */
var VideoPlayerStatus;
(function (VideoPlayerStatus) {
    /** VideoPlayer has been initialized, but the VideoAPI has not been loaded or the VideoAPI is not available */
    VideoPlayerStatus["notLoaded"] = "not loaded";
    /** Video is seeking to a new position, this is a transition and the status where this ends is typically started or paused */
    VideoPlayerStatus["seeking"] = "seeking";
    /** Play has been stopped. When Video is loaded it becomes cued first, stop only after start. */
    VideoPlayerStatus["stopped"] = "stopped";
    /** Video is becoming stopped */
    VideoPlayerStatus["stopping"] = "stopping";
    /** Video has reached it's end */
    VideoPlayerStatus["ended"] = "ended";
    /** Video has reached it's end */
    VideoPlayerStatus["ending"] = "ending";
    /** Video play has been started or resumed */
    VideoPlayerStatus["started"] = "started";
    /** Start action in progress, becomes started when the play actually starts/resumes */
    VideoPlayerStatus["starting"] = "starting";
    /** Video was started and now is paused. */
    VideoPlayerStatus["paused"] = "paused";
    /** Video is becoming paused */
    VideoPlayerStatus["pausing"] = "pausing";
    /** Video is being buffered, this is actually a status not a transition! */
    VideoPlayerStatus["buffering"] = "buffering";
    /** Video has been initially loaded, eg. the thumbnail image is cued and initial seconds buffered. */
    VideoPlayerStatus["cued"] = "cued";
    /** Video is being cued. */
    VideoPlayerStatus["cueing"] = "cueing";
})(VideoPlayerStatus = exports.VideoPlayerStatus || (exports.VideoPlayerStatus = {}));
var both;
(function (both) {
    both[both["VideoPlayerStatus"] = 0] = "VideoPlayerStatus";
    both[both["VideoPlayerTransition"] = 1] = "VideoPlayerTransition";
})(both = exports.both || (exports.both = {}));
/**
 * Defines the interface for all video playing sources to implement
 */
class VideoAPI {
}
exports.VideoAPI = VideoAPI;
//# sourceMappingURL=VideoAPI.js.map