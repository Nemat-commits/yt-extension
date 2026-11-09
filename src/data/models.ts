export const SCHEMA_VERSION = 1 as const;
export const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export type RouteKind =
  | 'home'
  | 'subscriptions'
  | 'library'
  | 'watch'
  | 'search'
  | 'shorts'
  | 'channel'
  | 'playlist'
  | 'other';

export type AppRoute = {
  kind: RouteKind;
  path: string;
  videoId?: string;
  query?: string;
  channel?: string;
};

export interface DeviceConfig {
  schemaVersion: typeof SCHEMA_VERSION;
  consentVersion: number;
  enabled: boolean;
  privacy: {
    trackProgress: boolean;
    cacheFeeds: boolean;
    diagnostics: boolean;
  };
  /** A true value disables that feature for this device until the user turns it back on. */
  killSwitches: Record<string, boolean>;
}

export type HomeSection = 'hero' | 'continue' | 'subscriptions' | 'collections' | 'shortcuts';

export interface UserPreferences {
  schemaVersion: typeof SCHEMA_VERSION;
  theme: 'midnight' | 'system';
  density: 'comfortable' | 'compact';
  home: {
    destination: 'dashboard' | 'subscriptions' | 'original';
    sections: HomeSection[];
    showRecommendations: boolean;
    pinnedVideoId?: string;
  };
  watch: {
    focusMode: boolean;
    collapseComments: boolean;
    collapseDescription: boolean;
  };
  global: {
    hideShortsSurfaces: boolean;
  };
}

export interface VideoMeta {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  url: string;
  durationText?: string;
  capturedAt?: number;
}

export interface ResumeState {
  video: VideoMeta;
  currentTime: number;
  duration: number;
  percent: number;
  updatedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  videos: VideoMeta[];
}

export interface FeedSnapshot {
  id: 'subscriptions';
  items: VideoMeta[];
  updatedAt: number;
}

export interface FeatureHealth {
  failures: Record<string, number>;
  disabled: Record<string, boolean>;
  updatedAt: number;
}

export interface ExtensionState {
  deviceConfig: DeviceConfig;
  preferences: UserPreferences;
  collections: Collection[];
  resumeStates: ResumeState[];
  feedSnapshots: FeedSnapshot[];
  featureHealth: FeatureHealth;
  storageBytes: number | null;
}

export const DEFAULT_DEVICE_CONFIG: DeviceConfig = {
  schemaVersion: SCHEMA_VERSION,
  consentVersion: 0,
  enabled: false,
  privacy: {
    trackProgress: false,
    cacheFeeds: false,
    diagnostics: false,
  },
  killSwitches: {
    homeDashboard: false,
    subscriptionsAdapter: false,
    progressTracker: false,
    collections: false,
    watchControls: false,
  },
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  schemaVersion: SCHEMA_VERSION,
  theme: 'midnight',
  density: 'comfortable',
  home: {
    destination: 'dashboard',
    sections: ['hero', 'continue', 'subscriptions', 'collections', 'shortcuts'],
    showRecommendations: false,
  },
  watch: {
    focusMode: false,
    collapseComments: false,
    collapseDescription: false,
  },
  global: {
    hideShortsSurfaces: false,
  },
};

export const EMPTY_FEATURE_HEALTH: FeatureHealth = {
  failures: {},
  disabled: {},
  updatedAt: 0,
};
