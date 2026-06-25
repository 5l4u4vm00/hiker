import { Ionicons } from '@expo/vector-icons';
import {
  Camera,
  type CameraRef,
  type LngLatBounds,
  Map as MapLibreMap,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { forwardRef, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { UserLocationHeading } from '@/components/user-location-heading';
import { DEFAULT_ZOOM, MAP_RASTER_STYLE, TAIWAN_CENTER } from '@/map/mapStyle';

const BOUNDS_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const ZOOM_STEP = 1;

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
  /**
   * Navigation-style orientation: center on the user and rotate the map so the
   * device compass heading points to the top of the screen. Overrides
   * `bounds`/`centerCoordinate` while active.
   */
  headingUp?: boolean;
  /** Extra top offset for the zoom controls, e.g. to clear a safe-area inset or banner. */
  controlsTopInset?: number;
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
    headingUp = false,
    controlsTopInset = 0,
    children,
    style,
  },
  ref,
) {
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

  return (
    <View style={[styles.container, style]}>
      <MapLibreMap
        style={styles.map}
        mapStyle={MAP_RASTER_STYLE}
        onDidFinishLoadingMap={() => setMapReady(true)}
        onRegionDidChange={(e) => {
          currentZoom.current = e.nativeEvent.zoom;
        }}>
        {headingUp ? (
          <Camera ref={setCameraRef} trackUserLocation="heading" zoom={zoomLevel} duration={600} />
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

      <View style={[styles.zoomControls, { top: controlsTopInset + 12 }]}>
        <Pressable
          onPress={() => zoomBy(ZOOM_STEP)}
          style={styles.zoomButton}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Zoom in">
          <Ionicons name="add" size={24} color="#1F2933" />
        </Pressable>
        <View style={styles.zoomDivider} />
        <Pressable
          onPress={() => zoomBy(-ZOOM_STEP)}
          style={styles.zoomButton}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Zoom out">
          <Ionicons name="remove" size={24} color="#1F2933" />
        </Pressable>
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
  zoomControls: {
    position: 'absolute',
    right: 12,
    backgroundColor: '#ffffff',
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
    backgroundColor: '#D2D6DC',
  },
});
