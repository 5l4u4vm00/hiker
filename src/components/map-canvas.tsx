import { Ionicons } from '@expo/vector-icons';
import {
  Camera,
  type CameraRef,
  type LngLatBounds,
  Map as MapLibreMap,
  type MapRef,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { forwardRef, useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CompassBadge } from '@/components/compass-badge';
import { UserLocationHeading } from '@/components/user-location-heading';
import { useTheme } from '@/hooks/use-theme';
import { buildRasterStyle, DEFAULT_ZOOM, TAIWAN_CENTER } from '@/map/mapStyle';
import { useDeviceHeading } from '@/map/use-device-heading';
import { MAPTILER_TOKEN } from '@/state/mapTokenStore';

const BOUNDS_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const ZOOM_STEP = 1;
const RECENTER_ZOOM = 15;

/** Midpoint of a `[west, south, east, north]` bounds tuple, for a pre-fit camera center. */
function boundsCenter(bounds: LngLatBounds | undefined): [number, number] | undefined {
  if (!bounds) return undefined;
  const [west, south, east, north] = bounds;
  return [(west + east) / 2, (south + north) / 2];
}

export interface MapCanvasProps {
  centerCoordinate?: [number, number];
  zoomLevel?: number;
  /**
   * When set, the camera fits these bounds (declaratively) instead of using
   * `centerCoordinate`/`zoomLevel`. Reliable for focusing on a route.
   */
  bounds?: LngLatBounds;
  showUser?: boolean;
  /**
   * Render a direction-of-travel arrow on the user dot (Google-navigation
   * style), rotated by the GPS course (`coords.heading`).
   */
  showHeading?: boolean;
  /** The user's current coordinate; target for the recenter button. */
  userCoordinate?: [number, number];
  /**
   * Show a "recenter on my location" button (above the zoom controls) that
   * pans/zooms the camera to `userCoordinate`. Only renders when a coordinate
   * is available.
   */
  showRecenter?: boolean;
  /**
   * Navigation-style orientation: center on the user and rotate the map so the
   * device compass heading points to the top of the screen. Overrides
   * `bounds`/`centerCoordinate` while active.
   */
  headingUp?: boolean;
  /** Extra top offset for the zoom controls, e.g. to clear a safe-area inset or banner. */
  controlsTopInset?: number;
  /** Show a north-pointing compass above the zoom controls (driven by the device heading). */
  showCompass?: boolean;
  /** Called with the `[lon, lat]` of a single tap on the map (e.g. to draw a route). */
  onPress?: (lngLat: [number, number]) => void;
  /** Called with the `[lon, lat]` of a long press on the map (e.g. to drop a waypoint). */
  onLongPress?: (lngLat: [number, number]) => void;
  /**
   * Forwarded ref to the underlying MapView, for `project`/`unproject`
   * screen↔coordinate conversion (e.g. to drag an overlay handle).
   */
  mapRef?: RefObject<MapRef | null>;
  /** Called after the map region finishes changing (pan/zoom/rotate settles). */
  onRegionChange?: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Base map surface: MapTiler Outdoor raster tiles, a camera, the user location
 * dot, and top-right zoom in/out controls. Overlay sources/layers (track
 * polyline, waypoints) are passed as children. The camera ref is forwarded so
 * callers can recenter or fit bounds.
 */
export const MapCanvas = forwardRef<CameraRef, MapCanvasProps>(function MapCanvas(
  {
    centerCoordinate,
    zoomLevel = DEFAULT_ZOOM,
    bounds,
    showUser = true,
    showHeading = true,
    userCoordinate,
    showRecenter = false,
    headingUp = false,
    controlsTopInset = 0,
    showCompass = false,
    onPress,
    onLongPress,
    mapRef,
    onRegionChange,
    children,
    style,
  },
  ref,
) {
  const theme = useTheme();
  const { t } = useTranslation();
  const heading = useDeviceHeading(showCompass || headingUp);
  const mapStyle = buildRasterStyle(MAPTILER_TOKEN);
  // MapLibre throws "padding is greater than map's height or width" if a bounds
  // fit runs before the map view has been measured (e.g. during a tab
  // transition). Gate the bounds camera on the map having finished loading,
  // which only happens once the GL surface — and thus a sized view — exists.
  const [mapReady, setMapReady] = useState(false);

  // The zoom buttons need to drive the camera imperatively, but the camera ref
  // is forwarded to the caller. Keep our own handle and fan the ref out to both.
  const cameraRef = useRef<CameraRef | null>(null);
  const setCameraRef = (instance: CameraRef | null) => {
    cameraRef.current = instance;
    if (typeof ref === 'function') ref(instance);
    else if (ref) ref.current = instance;
  };

  // Track the live zoom (from pan/zoom gestures and bounds fits) so the buttons
  // step relative to what's actually on screen, not a stale prop.
  const currentZoom = useRef(zoomLevel);

  const zoomBy = (delta: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom.current + delta));
    currentZoom.current = next;
    cameraRef.current?.zoomTo(next, { duration: 200 });
  };

  const recenter = () => {
    if (!userCoordinate) return;
    // Keep the zoom buttons stepping from the level we land on.
    currentZoom.current = RECENTER_ZOOM;
    cameraRef.current?.easeTo({ center: userCoordinate, zoom: RECENTER_ZOOM, duration: 500 });
  };

  // In heading-up (recording) mode the camera follows the user via declarative
  // `center`/`bearing` with no `zoom` prop, so manual zoom persists across the
  // frequent position/heading updates. On entry, zoom in *to the current
  // location* once: a single combined move to `centerCoordinate` at the
  // recording zoom (gated on the map being ready so the camera ref is usable).
  const headingUpZoomed = useRef(false);
  useEffect(() => {
    if (!headingUp) {
      headingUpZoomed.current = false;
      return;
    }
    if (!mapReady || headingUpZoomed.current) return;
    headingUpZoomed.current = true;
    currentZoom.current = zoomLevel;
    if (centerCoordinate) {
      cameraRef.current?.easeTo({ center: centerCoordinate, zoom: zoomLevel, duration: 600 });
    } else {
      cameraRef.current?.zoomTo(zoomLevel, { duration: 600 });
    }
  }, [headingUp, mapReady, zoomLevel, centerCoordinate]);

  return (
    <View style={[styles.container, style]}>
      <MapLibreMap
        ref={mapRef}
        style={styles.map}
        mapStyle={mapStyle}
        onDidFinishLoadingMap={() => setMapReady(true)}
        onPress={onPress ? (e) => onPress(e.nativeEvent.lngLat) : undefined}
        onLongPress={onLongPress ? (e) => onLongPress(e.nativeEvent.lngLat) : undefined}
        onRegionDidChange={(e) => {
          currentZoom.current = e.nativeEvent.zoom;
          onRegionChange?.();
        }}>
        {headingUp ? (
          // Navigation-style follow: re-center on the live coordinate and rotate
          // the map to the device compass heading. `center` may be undefined for
          // a moment at recording start — leave it so the camera holds its
          // current (already user-centered) position rather than jumping away.
          <Camera ref={setCameraRef} center={centerCoordinate} bearing={heading ?? 0} duration={400} />
        ) : bounds && mapReady ? (
          <Camera ref={setCameraRef} bounds={bounds} padding={BOUNDS_PADDING} duration={600} />
        ) : (
          <Camera
            ref={setCameraRef}
            center={centerCoordinate ?? boundsCenter(bounds) ?? TAIWAN_CENTER}
            zoom={zoomLevel}
            duration={600}
          />
        )}
        {showUser ? showHeading ? <UserLocationHeading /> : <UserLocation /> : null}
        {children}
      </MapLibreMap>

      <View style={[styles.topRightControls, { top: controlsTopInset + 12 }]}>
        {showCompass && heading != null ? <CompassBadge heading={heading} /> : null}
        {showRecenter && userCoordinate ? (
          <View style={[styles.controlButton, { backgroundColor: theme.background }]}>
            <Pressable
              onPress={recenter}
              style={styles.zoomButton}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('mapCanvas.recenter')}>
              <Ionicons name="locate" size={22} color={theme.text} />
            </Pressable>
          </View>
        ) : null}
        <View style={[styles.zoomControls, { backgroundColor: theme.background }]}>
          <Pressable
            onPress={() => zoomBy(ZOOM_STEP)}
            style={styles.zoomButton}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('mapCanvas.zoomIn')}>
            <Ionicons name="add" size={24} color={theme.text} />
          </Pressable>
          <View style={[styles.zoomDivider, { backgroundColor: theme.backgroundSelected }]} />
          <Pressable
            onPress={() => zoomBy(-ZOOM_STEP)}
            style={styles.zoomButton}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('mapCanvas.zoomOut')}>
            <Ionicons name="remove" size={24} color={theme.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  topRightControls: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 12,
  },
  zoomControls: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  controlButton: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  zoomButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: StyleSheet.hairlineWidth,
  },
});
