import { Ionicons } from '@expo/vector-icons';
import { GeoJSONSource, Layer, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

import { WAYPOINT_META } from '@/components/waypoint-sheet';
import { midpoint } from '@/map/mapStyle';
import { usePlanStore } from '@/state/planStore';

const ROUTE_COLOR = '#E5484D';
const SELECT_COLOR = '#208AEF';

/**
 * Past this many segments the midpoint insert handles are dropped to keep the
 * count of native annotation views bounded; vertices still select and drag.
 */
const INSERT_HANDLE_LIMIT = 60;

/**
 * Editing overlays for the Plan screen, rendered as MapCanvas children. Each
 * marker is interactive only in its own mode (see PlanMode): vertices select in
 * `edit`, midpoint "+" handles insert in `edit`, and waypoints edit in
 * `waypoint`. The selected vertex is dragged via the `VertexDragHandle` layered
 * above the map. Reads the draft straight from the plan store.
 */
export function PlanOverlays({ onEditWaypoint }: { onEditWaypoint: (id: string) => void }) {
  const points = usePlanStore((s) => s.points);
  const waypoints = usePlanStore((s) => s.waypoints);
  const selectedVertex = usePlanStore((s) => s.selectedVertex);
  const mode = usePlanStore((s) => s.mode);
  const selectVertex = usePlanStore((s) => s.selectVertex);
  const insertPoint = usePlanStore((s) => s.insertPoint);
  const moveVertex = usePlanStore((s) => s.moveVertex);
  const updateWaypoint = usePlanStore((s) => s.updateWaypoint);

  const lineFeature: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: points },
  };

  const showInsertHandles = mode === 'edit' && points.length >= 2 && points.length <= INSERT_HANDLE_LIMIT;

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

      {showInsertHandles
        ? points.slice(0, -1).map((p, i) => {
            const mid = midpoint(p, points[i + 1]);
            return (
              <ViewAnnotation
                key={`insert-${i}`}
                id={`insert-${i}`}
                lngLat={mid}
                onPress={() => {
                  insertPoint(i, mid);
                  selectVertex(i + 1);
                }}>
                <View style={styles.hitArea}>
                  <View style={styles.insert}>
                    <Ionicons name="add" size={12} color="#ffffff" />
                  </View>
                </View>
              </ViewAnnotation>
            );
          })
        : null}

      {points.map((p, i) => (
        <ViewAnnotation
          key={`vertex-${i}`}
          id={`vertex-${i}`}
          lngLat={p}
          draggable={mode === 'edit'}
          onPress={
            mode === 'edit' ? () => selectVertex(selectedVertex === i ? null : i) : undefined
          }
          onDragStart={mode === 'edit' ? () => selectVertex(i) : undefined}
          onDragEnd={mode === 'edit' ? (e) => moveVertex(i, e.nativeEvent.lngLat) : undefined}>
          <View style={styles.hitArea}>
            <View style={[styles.vertex, selectedVertex === i && styles.vertexSelected]} />
          </View>
        </ViewAnnotation>
      ))}

      {waypoints.map((w) => {
        const meta = WAYPOINT_META[w.type];
        return (
          <ViewAnnotation
            key={w.id}
            id={`wp-${w.id}`}
            lngLat={w.lngLat}
            draggable={mode === 'edit'}
            onPress={mode === 'waypoint' ? () => onEditWaypoint(w.id) : undefined}
            onDragEnd={
              mode === 'edit'
                ? (e) => updateWaypoint(w.id, { lngLat: e.nativeEvent.lngLat })
                : undefined
            }>
            <View style={styles.hitArea}>
              <View style={[styles.waypoint, { backgroundColor: meta.color }]}>
                <Ionicons name={meta.icon} size={14} color="#ffffff" />
              </View>
            </View>
          </ViewAnnotation>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  // Transparent padding that enlarges the tap target around each small marker.
  hitArea: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    borderColor: SELECT_COLOR,
  },
  insert: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(32,138,239,0.85)',
    borderWidth: 1,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
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
