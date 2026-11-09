import type { AppRoute, ExtensionState, VideoMeta } from '@src/data/models';

export interface ContentState extends ExtensionState {
  route: AppRoute;
  currentVideo: VideoMeta | null;
}

export interface ContentActions {
  navigate(event: MouseEvent, path: string): void;
  setEnabled(enabled: boolean): Promise<void>;
  enableProgress(): Promise<void>;
  enableFeedCache(): Promise<void>;
  toggleWatchPreference(key: 'focusMode' | 'collapseComments' | 'collapseDescription', value: boolean): Promise<void>;
  setHideShorts(value: boolean): Promise<void>;
  createCollection(name: string): Promise<void>;
  renameCollection(id: string, name: string): Promise<void>;
  deleteCollection(id: string): Promise<void>;
  addVideoToCollection(collectionId: string, video: VideoMeta): Promise<void>;
  removeVideoFromCollection(collectionId: string, videoId: string): Promise<void>;
  reorderCollection(collectionId: string, direction: -1 | 1): Promise<void>;
  pinVideo(videoId: string | undefined): Promise<void>;
  importCollections(json: string): Promise<number>;
  openSettings(): void;
  refreshSubscriptions(): void;
}
