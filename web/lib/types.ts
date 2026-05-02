import { ObjectId } from "mongodb";

export interface AudioAsset {
    _id?: ObjectId;
    name: string;
    originalFilename: string;
    filePath: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
}

export type ClipStatus =
    | "pending"
    | "queued"
    | "downloading"
    | "processing"
    | "cropping"
    | "vertical"
    | "done"
    | "cancelled"
    | "error"
    | "uploading"
    | "uploaded";

export interface Clip {
    _id?: ObjectId;
    twitchId: string;
    streamerId: string;
    streamerLogin: string;
    streamerDisplayName: string;
    title: string;
    url: string;
    viewCount: number;
    thumbnailUrl: string;
    duration: number;
    status: ClipStatus;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

export type LogLevel = "info" | "warn" | "error";
export type LogStage =
    | "download"
    | "process"
    | "crop"
    | "vertical"
    | "system"
    | "upload";

export interface Log {
    _id?: ObjectId;
    clipId: string;
    stage: LogStage;
    level: LogLevel;
    message: string;
    timestamp: Date;
}
