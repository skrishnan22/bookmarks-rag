// Types for content extraction from various platforms

export interface ExtractedImage {
  url: string;
  alt?: string;
  type: 'photo' | 'video_thumbnail' | 'gif';
}

export interface TwitterExtraction {
  platform: 'twitter';
  tweetId: string;
  author: {
    name: string;
    handle: string;
    verified: boolean;
    avatarUrl?: string;
  };
  content: {
    text: string;
    html?: string;
  };
  images: ExtractedImage[];
  timestamp?: string;
  quotedTweet?: TwitterExtraction;
}

export interface BookmarkContentData {
  url: string;
  title: string;
  content: string;
  contentType: 'tweet' | 'article' | 'default';
  platformData?: TwitterExtraction;
  images: Array<{
    url: string;
    altText?: string;
    position: number;
    nearbyText?: string;
    heuristicScore: number;
    estimatedType: string;
  }>;
}
