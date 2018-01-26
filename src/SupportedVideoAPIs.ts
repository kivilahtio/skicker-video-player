/**
 * Define the video playing sources supported
 */

export enum SupportedVideoAPIs {
  YouTube,
}

export interface IVideoAPIConfig {
  apiUrl: URL;
  name: string;
  videoUrl: URL;
}

export const videoAPIs: {[keys: string]: IVideoAPIConfig} = {

};
