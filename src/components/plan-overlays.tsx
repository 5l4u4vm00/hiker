import { Ionicons } from '@expo/vector-icons';
import { GeoJSONSource, Layer, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

import { WAYPOINT_META } from '@/components/waypoint-sheet';
import { midpoint } from '@/map/mapStyle';
import { usePlanStore } from '@/state/planStore';

const ROUTE_COLOR = '#E5484D';

/**
 * Past this many vertices the draggable ghost insert-handles are dropped to keep
 * the count of native annotation views bounded. The line and vertices still
 * render; the user can still append and drag existing vertices.
 */
const GHOST_LIMIT = 60;

/**
 * Editing overlays for the Plan screen, rendered as MapCanvas children: the live
 * polyline (a cheap GeoJSON layer), a draggable handle per vertex, draggable
 * "ghost" handles at segment midpoints that insert a vertex when dragged, and a
 * draggable marker per waypoint. Reads the draft straight from the plan store.
 */
export function PlanOverlays({ onEditWaypoint }: { onEditWaypoint: (id: string) => void }) {
  const points = usePlanStore((s) => s.points);
  const waypoints = usePlanStore((s) => s.waypoints);
  const selectedVertex = usePlanStore((s) => s.selectedVertex);
  const moveVertex = usePlanStore((s) => s.moveVertex);
  const insertPoint = usePlanStore((s) => s.insertPoint);
  const selectVertex = usePlanStore((s) => s.selectVertex);
  const updateWaypoint = usePlanStore((s) => s.updateWaypoint);

  const lineFeature: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: points },
  };

  const showGhosts = points.length >= 2 && points.length <= GHOST_LIMIT;

  return (
    <>
      {points.length >= 2 ? (
        <GeoJSONSource id="plan-line" data={lineFeature}>
          <Layer
            id="plan-line-layer"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': ROUTE_COLOR, 'line-width': 4 }}
          />
        </GeoJSONSource>
      ) : null}

      {showGhosts
        ? points.slice(0, -1).map((p, i) => {
            const mid = midpoint(p, points[i + 1]);
            return (
              <ViewAnnotation
                key={`ghost-${i}`}
                id={`ghost-${i}`}
                lngLat={mid}
                draggable
                onDragEnd={(e) => insertPoint(i, e.nativeEvent.lngLat)}>
                <View style={styles.ghost} />
              </ViewAnnotation>
            );
          })
        : null}

      {points.map((p, i) => (
        <ViewAnnotation
          key={`vertex-${i}`}
          id={`vertex-${i}`}
          lngLat={p}
          draggable
          onPress={() => selectVertex(selectedVertex === i ? null : i)}
          onDragEnd={(e) => moveVertex(i, e.nativeEvent.lngLat)}>
          <View style={[styles.vertex, selectedVertex === i && styles.vertexSelected]} />
        </ViewAnnotation>
      ))}

      {waypoints.map((w) => {
        const meta = WAYPOINT_META[w.type];
        return (
          <ViewAnnotation
            key={w.id}
            id={`wp-${w.id}`}
            lngLat={w.lngLat}
            draggable
            onPress={() => onEditWaypoint(w.id)}
            onDragEnd={(e) => updateWaypoint(w.id, { lngLat: e.nativeEvent.lngLat })}>
            <View style={[styles.waypoint, { backgroundColor: meta.color }]}>
              <Ionicons name={meta.icon} size={14} color="#ffffff" />
            </View>
          </ViewAnnotation>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  vertex: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: ROUTE_COLOR,
  },
  vertexSelected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderColor: '#208AEF',
  },
  ghost: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(229,72,77,0.45)',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  waypoint: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
