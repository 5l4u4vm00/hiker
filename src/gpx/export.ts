import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { Track, TrackPoint } from '@/db/types';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Builds a GPX 1.1 document for a recorded track. */
export function buildGpx(track: Track, points: TrackPoint[]): string {
  const segments = points
    .map((p) => {
      const ele = p.alt != null ? `\n        <ele>${p.alt.toFixed(1)}</ele>` : '';
      const time = `\n        <time>${new Date(p.recordedAt).toISOString()}</time>`;
      return `      <trkpt lat="${p.lat}" lon="${p.lon}">${ele}${time}\n      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Hiker" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(track.name)}</name>
    <time>${new Date(track.startedAt).toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(track.name)}</name>
    <trkseg>
${segments}
    </trkseg>
  </trk>
</gpx>`;
}

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^a-z0-9-_]+/gi, '_').replace(/_+/g, '_').toLowerCase();
  return `${cleaned || 'hike'}.gpx`;
}

/** Writes a GPX file for the track to the cache directory and returns its uri. */
export async function writeGpxFile(track: Track, points: TrackPoint[]): Promise<string> {
  const gpx = buildGpx(track, points);
  const file = new File(Paths.cache, safeFileName(track.name));
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(gpx);
  return file.uri;
}

/** Exports a track as GPX and opens the native share sheet. */
export async function shareTrackAsGpx(track: Track, points: TrackPoint[]): Promise<void> {
  const uri = await writeGpxFile(track, points);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/gpx+xml',
      dialogTitle: `Share ${track.name}`,
      UTI: 'com.topografix.gpx',
    });
  }
}
