
export interface Position {
  x: number;
  y: number;
}

export interface CameraConfig {
  shape: 'circle' | 'rect';
  size: number;
  mirrored: boolean;
  backgroundUrl: string | null;
  blur: number; 
  videoOpacity: number;
  zoom: number; // 1.0 to 2.5
  // Chroma Key Settings
  useChromaKey: boolean;
  chromaKeyColor: { r: number; g: number; b: number };
  threshold: number;
}

export enum RecordingStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PAUSED = 'PAUSED'
}
