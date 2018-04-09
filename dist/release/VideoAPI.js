"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Define the video playing sources supported
 */
var SupportedVideoAPIs;
(function (SupportedVideoAPIs) {
    SupportedVideoAPIs["YouTube"] = "YouTube";
})(SupportedVideoAPIs = exports.SupportedVideoAPIs || (exports.SupportedVideoAPIs = {}));
/*
 * Currently only VideoAPI.YouTubePlayer uses this mapping table. If other backends are added, generalize mappings.
 */
var VideoPlayerStatus;
(function (VideoPlayerStatus) {
    /** VideoPlayer has been initialized, but the VideoAPI has not been loaded or the VideoAPI is not available */
    VideoPlayerStatus["notLoaded"] = "not loaded";
    VideoPlayerStatus["unstarted"] = "unstarted";
    VideoPlayerStatus["ended"] = "ended";
    VideoPlayerStatus["playing"] = "playing";
    VideoPlayerStatus["paused"] = "paused";
    VideoPlayerStatus["buffering"] = "buffering";
    VideoPlayerStatus["videoCued"] = "video cued";
})(VideoPlayerStatus = exports.VideoPlayerStatus || (exports.VideoPlayerStatus = {}));
/**
 * Defines the interface for all video playing sources to implement
 */
class VideoAPI {
}
exports.VideoAPI = VideoAPI;
//# sourceMappingURL=VideoAPI.js.map