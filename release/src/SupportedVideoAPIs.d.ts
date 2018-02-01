/**
 * Define the video playing sources supported
 */
export declare enum SupportedVideoAPIs {
    YouTube = 0,
}
export interface IVideoAPIConfig {
    apiUrl: URL;
    name: string;
    videoUrl: URL;
}
export declare const videoAPIs: {
    [keys: string]: IVideoAPIConfig;
};
