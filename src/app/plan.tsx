import type { CameraRef, LngLatBounds } from '@maplibre/maplibre-react-native';
import { Stack, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoordinateInput } from '@/components/coordinate-input';
import { MapCanvas } from '@/components/map-canvas';
import { PlanOverlays } from '@/components/plan-overlays';
import { PlanStatsBar } from '@/components/plan-stats-bar';
import { PlanToolbar } from '@/components/plan-toolbar';
import { PrepChecklist } from '@/components/prep-checklist';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WaypointSheet } from '@/components/waypoint-sheet';
import { Spacing } from '@/constants/theme';
import { savePlannedRoute } from '@/data/planService';
import { getRoute, getRouteWaypoints } from '@/db/routes';
import type { Route, RouteDifficulty, WaypointType } from '@/db/types';
import { fetchElevations } from '@/elevation/openMeteo';
import { useTheme } from '@/hooks/use-theme';
import { boundsOfCoords, DEFAULT_ZOOM } from '@/map/mapStyle';
import { useCurrentLocation } from '@/map/use-current-location';
import { usePlanStore, type LngLatTuple } from '@/state/planStore';
import { getInitialCoordinate } from '@/tracking/recorder';
import { ascentFromElevations, distanceOf, naismithSeconds } from '@/tracking/stats';

const DIFFICULTIES: RouteDifficulty[] = ['easy', 'moderate', 'hard', 'expert'];
const DIFFICULTY_COLORS: Record<RouteDifficulty, string> = {
  easy: '#30A46C',
  moderate: '#F5A623',
  hard: '#E5484D',
  expert: '#8E4EC6',
};

const ELEVATION_DEBOUNCE_MS = 700;

interface WaypointSheetState {
  visible: boolean;
  mode: 'add' | 'edit';
  lngLat: LngLatTuple | null;
  id: string | null;
  name: string;
  type: WaypointType;
}

const CLOSED_WAYPOINT_SHEET: WaypointSheetState = {
  visible: false,
  mode: 'add',
  lngLat: null,
  id: null,
  name: '',
  type: 'other',
};

interface CoordSheetState {
  visible: boolean;
  /** 'add' places a new vertex; 'edit' moves the selected vertex. */
  mode: 'add' | 'edit';
  lat?: number;
  lng?: number;
}

const CLOSED_COORD_SHEET: CoordSheetState = { visible: false, mode: 'add' };

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();

  const points = usePlanStore((s) => s.points);
  const waypoints = usePlanStore((s) => s.waypoints);
  const selectedVertex = usePlanStore((s) => s.selectedVertex);
  const mode = usePlanStore((s) => s.mode);
  const setMode = usePlanStore((s) => s.setMode);
  const editingRouteId = usePlanStore((s) => s.editingRouteId);
  const elevations = usePlanStore((s) => s.elevations);
  const elevationStatus = usePlanStore((s) => s.elevationStatus);
  const appendPoint = usePlanStore((s) => s.appendPoint);
  const moveVertex = usePlanStore((s) => s.moveVertex);
  const undo = usePlanStore((s) => s.undo);
  const canUndo = usePlanStore((s) => s.history.length > 0);
  const removeVertex = usePlanStore((s) => s.removeVertex);
  const selectVertex = usePlanStore((s) => s.selectVertex);
  const clearAll = usePlanStore((s) => s.clearAll);
  const addWaypoint = usePlanStore((s) => s.addWaypoint);
  const updateWaypoint = usePlanStore((s) => s.updateWaypoint);
  const removeWaypoint = usePlanStore((s) => s.removeWaypoint);
  const setMeta = usePlanStore((s) => s.setMeta);
  const setElevations = usePlanStore((s) => s.setElevations);

  const { routeId } = useLocalSearchParams<{ routeId?: string }>();
  const cameraRef = useRef<CameraRef | null>(null);
  const userCoord = useCurrentLocation();
  const [initialCenter, setInitialCenter] = useState<LngLatTuple | null>(null);
  const [editBounds, setEditBounds] = useState<LngLatBounds | undefined>(undefined);
  const [statsBarHeight, setStatsBarHeight] = useState(0);
  const [wpSheet, setWpSheet] = useState<WaypointSheetState>(CLOSED_WAYPOINT_SHEET);
  const [coordSheet, setCoordSheet] = useState<CoordSheetState>(CLOSED_COORD_SHEET);
  const [saveVisible, setSaveVisible] = useState(false);
  const [postSave, setPostSave] = useState<Route | null>(null);
  const [saving, setSaving] = useState(false);

  // When entered with a `routeId`, load that saved route into the draft for
  // editing and frame the camera on its bounds (instead of the user location).
  useEffect(() => {
    if (!routeId) return;
    if (usePlanStore.getState().points.length > 0) return;
    let cancelled = false;
    (async () => {
      const route = await getRoute(routeId);
      if (!route || cancelled) return;
      const wps = await getRouteWaypoints(routeId);
      if (cancelled) return;
      usePlanStore.getState().loadRoute(route, wps);
      setEditBounds(boundsOfCoords(route.geometry.coordinates) ?? undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  // Center the map on the user once, on entry. The live `userCoord` keeps
  // updating to drive the recenter button and seed waypoint placement, but the
  // camera center is captured from a single fix so it never undoes panning.
  // Skipped when editing a saved route (the camera frames the route bounds).
  useEffect(() => {
    if (routeId) return;
    let cancelled = false;
    getInitialCoordinate().then((coord) => {
      if (!cancelled && coord) setInitialCenter(coord);
    });
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  // Confirm before leaving with unsaved work; always clear the draft on exit.
  const savedRef = useRef(false);
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (savedRef.current || usePlanStore.getState().points.length === 0) {
        usePlanStore.getState().reset();
        return;
      }
      e.preventDefault();
      Alert.alert(t('plan.discardTitle'), t('plan.discardMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.discard'),
          style: 'destructive',
          onPress: () => {
            usePlanStore.getState().reset();
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return unsubscribe;
  }, [navigation, t]);

  // Debounced elevation fetch: re-runs whenever the geometry changes. A monotonic
  // token drops responses superseded by a newer edit. Failures degrade to a
  // distance-only estimate ('unknown').
  const elevToken = useRef(0);
  useEffect(() => {
    // Bump the token even when there is nothing to fetch, so any fetch still
    // in flight from a previous (now-edited) geometry is invalidated.
    const token = ++elevToken.current;
    if (points.length < 2) return;
    setElevations([], 'loading');
    const timer = setTimeout(async () => {
      const result = await fetchElevations(points);
      if (token !== elevToken.current) return;
      setElevations(result ?? [], result ? 'ready' : 'unknown');
    }, ELEVATION_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [points, setElevations]);

  const recomputeElevation = useCallback(async () => {
    if (points.length < 2) return;
    const token = ++elevToken.current;
    setElevations([], 'loading');
    const result = await fetchElevations(points);
    if (token !== elevToken.current) return;
    setElevations(result ?? [], result ? 'ready' : 'unknown');
  }, [points, setElevations]);

  const distanceM = distanceOf(points);
  const ascentM = elevationStatus === 'ready' ? ascentFromElevations(elevations) : 0;
  const durationS = naismithSeconds(distanceM, ascentM);

  // A map tap means exactly one thing per mode: draw → append a point, waypoint
  // → drop a waypoint at the tap, edit → deselect (empty space).
  const onMapPress = useCallback(
    (lngLat: LngLatTuple) => {
      if (mode === 'draw') {
        appendPoint(lngLat);
      } else if (mode === 'waypoint') {
        setWpSheet({ ...CLOSED_WAYPOINT_SHEET, visible: true, mode: 'add', lngLat });
      } else {
        selectVertex(null);
      }
    },
    [mode, appendPoint, selectVertex],
  );

  const onAddByCoordinate = useCallback(() => {
    const seed = points.length > 0 ? points[points.length - 1] : userCoord;
    setCoordSheet({ visible: true, mode: 'add', lat: seed?.[1], lng: seed?.[0] });
  }, [points, userCoord]);

  const onEditCoordinate = useCallback(() => {
    if (selectedVertex === null) return;
    const p = points[selectedVertex];
    setCoordSheet({ visible: true, mode: 'edit', lat: p[1], lng: p[0] });
  }, [selectedVertex, points]);

  const onSubmitCoordinate = useCallback(
    (lat: number, lng: number) => {
      const lngLat: LngLatTuple = [lng, lat];
      if (coordSheet.mode === 'edit' && selectedVertex !== null) {
        moveVertex(selectedVertex, lngLat);
      } else {
        appendPoint(lngLat);
      }
      cameraRef.current?.easeTo({ center: lngLat, duration: 500 });
      setCoordSheet(CLOSED_COORD_SHEET);
    },
    [coordSheet.mode, selectedVertex, moveVertex, appendPoint],
  );

  const onEditWaypoint = useCallback(
    (id: string) => {
      const wp = waypoints.find((w) => w.id === id);
      if (!wp) return;
      setWpSheet({
        visible: true,
        mode: 'edit',
        lngLat: wp.lngLat,
        id: wp.id,
        name: wp.name,
        type: wp.type,
      });
    },
    [waypoints],
  );

  const onClear = useCallback(() => {
    Alert.alert(t('plan.clearTitle'), t('plan.clearMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('plan.clear'), style: 'destructive', onPress: clearAll },
    ]);
  }, [clearAll, t]);

  const onSubmitWaypoint = useCallback(
    (name: string, type: WaypointType, lngLat: LngLatTuple) => {
      if (wpSheet.mode === 'edit' && wpSheet.id) {
        updateWaypoint(wpSheet.id, { name, type, lngLat });
      } else {
        addWaypoint({ lngLat, name, type });
      }
      setWpSheet(CLOSED_WAYPOINT_SHEET);
    },
    [wpSheet, addWaypoint, updateWaypoint],
  );

  const onDeleteWaypoint = useCallback(() => {
    if (wpSheet.id) removeWaypoint(wpSheet.id);
    setWpSheet(CLOSED_WAYPOINT_SHEET);
  }, [wpSheet, removeWaypoint]);

  const onConfirmSave = useCallback(async () => {
    const { name, region, difficulty } = usePlanStore.getState();
    if (!name.trim()) {
      Alert.alert(t('plan.nameRequiredTitle'), t('plan.nameRequiredMessage'));
      return;
    }
    setSaving(true);
    try {
      const route = await savePlannedRoute({
        id: editingRouteId ?? undefined,
        name,
        region,
        difficulty,
        points,
        waypoints,
        elevations,
        elevationStatus,
      });
      savedRef.current = true;
      setSaveVisible(false);
      setPostSave(route);
    } catch (err) {
      Alert.alert(
        t('plan.saveFailedTitle'),
        err instanceof Error ? err.message : t('plan.saveFailedMessage'),
      );
    } finally {
      setSaving(false);
    }
  }, [editingRouteId, points, waypoints, elevations, elevationStatus, t]);

  const openSavedRoute = useCallback(() => {
    const route = postSave;
    if (!route) return;
    setPostSave(null);
    usePlanStore.getState().reset();
    router.replace(`/route/${route.id}`);
  }, [postSave]);

  const canSave = points.length >= 2;
  const showRecompute = elevationStatus === 'unknown' && points.length >= 2;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: editingRouteId ? t('plan.editTitle') : t('plan.title') }} />

      <MapCanvas
        ref={cameraRef}
        centerCoordinate={initialCenter ?? undefined}
        zoomLevel={initialCenter ? 14 : DEFAULT_ZOOM}
        bounds={editBounds}
        showUser
        showRecenter
        userCoordinate={userCoord ?? undefined}
        controlsTopInset={statsBarHeight + Spacing.two}
        onPress={onMapPress}>
        <PlanOverlays onEditWaypoint={onEditWaypoint} />
      </MapCanvas>

      <PlanStatsBar
        topInset={0}
        pointCount={points.length}
        distanceM={distanceM}
        ascentM={ascentM}
        durationS={durationS}
        elevationStatus={elevationStatus}
        onHeightChange={setStatsBarHeight}
      />

      {showRecompute ? (
        <Pressable
          onPress={recomputeElevation}
          accessibilityRole="button"
          style={[styles.recompute, { backgroundColor: theme.backgroundElement, top: 60 }]}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('plan.recomputeElevation')}
          </ThemedText>
        </Pressable>
      ) : null}

      <ThemedView
        type="backgroundElement"
        style={[styles.hint, { top: statsBarHeight + Spacing.two + 12 }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.hintText}>
          {t(
            mode === 'draw'
              ? 'plan.drawHint'
              : mode === 'waypoint'
                ? 'plan.waypointHint'
                : 'plan.editHint',
          )}
        </ThemedText>
      </ThemedView>

      <PlanToolbar
        bottomInset={insets.bottom + 96}
        mode={mode}
        onModeChange={setMode}
        canUndo={canUndo}
        canClear={points.length > 0 || waypoints.length > 0}
        hasSelection={selectedVertex !== null}
        onUndo={undo}
        onClear={onClear}
        onAddByCoordinate={onAddByCoordinate}
        onEditCoordinate={onEditCoordinate}
        onDeletePoint={() => selectedVertex !== null && removeVertex(selectedVertex)}
      />

      <View style={[styles.saveBar, { paddingBottom: insets.bottom + Spacing.three }]}>
        <PrimaryButton
          title={t('plan.saveRoute')}
          onPress={() => setSaveVisible(true)}
          disabled={!canSave}
        />
      </View>

      {wpSheet.visible && wpSheet.lngLat ? (
        <WaypointSheet
          initialName={wpSheet.name}
          initialType={wpSheet.type}
          initialLngLat={wpSheet.lngLat}
          editing={wpSheet.mode === 'edit'}
          onSubmit={onSubmitWaypoint}
          onDelete={onDeleteWaypoint}
          onClose={() => setWpSheet(CLOSED_WAYPOINT_SHEET)}
        />
      ) : null}

      {coordSheet.visible ? (
        <CoordinateInput
          title={coordSheet.mode === 'edit' ? t('plan.editCoordinate') : t('plan.addByCoordinate')}
          initialLat={coordSheet.lat}
          initialLng={coordSheet.lng}
          onSubmit={onSubmitCoordinate}
          onClose={() => setCoordSheet(CLOSED_COORD_SHEET)}
        />
      ) : null}

      <SaveSheet
        visible={saveVisible}
        saving={saving}
        onConfirm={onConfirmSave}
        onClose={() => setSaveVisible(false)}
        setMeta={setMeta}
      />

      <PostSaveSheet route={postSave} onOpenRoute={openSavedRoute} />
    </ThemedView>
  );
}

function SaveSheet({
  visible,
  saving,
  onConfirm,
  onClose,
  setMeta,
}: {
  visible: boolean;
  saving: boolean;
  onConfirm: () => void;
  onClose: () => void;
  setMeta: (patch: { name?: string; difficulty?: RouteDifficulty | null; region?: string | null }) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const name = usePlanStore((s) => s.name);
  const region = usePlanStore((s) => s.region);
  const difficulty = usePlanStore((s) => s.difficulty);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <ThemedView style={styles.sheet}>
          <ThemedText type="subtitle" style={styles.sheetHeading}>
            {t('plan.saveRoute')}
          </ThemedText>

          <View style={[styles.inputBox, { backgroundColor: theme.backgroundElement }]}>
            <TextInput
              value={name}
              onChangeText={(text) => setMeta({ name: text })}
              placeholder={t('plan.routeNamePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
              autoFocus
            />
          </View>

          <View style={[styles.inputBox, { backgroundColor: theme.backgroundElement }]}>
            <TextInput
              value={region ?? ''}
              onChangeText={(text) => setMeta({ region: text })}
              placeholder={t('plan.regionPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
            />
          </View>

          <View style={styles.difficultyRow}>
            {DIFFICULTIES.map((d) => {
              const selected = difficulty === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => setMeta({ difficulty: selected ? null : d })}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.difficultyChip,
                    { backgroundColor: selected ? DIFFICULTY_COLORS[d] : theme.backgroundElement },
                  ]}>
                  <ThemedText
                    type="small"
                    style={{ color: selected ? '#ffffff' : theme.textSecondary }}>
                    {t(`difficulty.${d}`)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <PrimaryButton title={t('common.save')} onPress={onConfirm} loading={saving} />
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancel}>
            <ThemedText themeColor="textSecondary">{t('common.cancel')}</ThemedText>
          </Pressable>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PostSaveSheet({
  route,
  onOpenRoute,
}: {
  route: Route | null;
  onOpenRoute: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={route !== null} transparent animationType="slide">
      <View style={styles.backdrop} />
      <ThemedView style={styles.sheet}>
        <ThemedText type="subtitle" style={styles.sheetHeading}>
          {t('plan.savedTitle')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('plan.savedSubtitle')}
        </ThemedText>
        <ScrollView style={styles.checklistScroll}>
          <PrepChecklist />
        </ScrollView>
        <PrimaryButton title={t('plan.openRoute')} onPress={onOpenRoute} />
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  recompute: {
    position: 'absolute',
    left: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
  hint: {
    position: 'absolute',
    left: Spacing.three,
    // Clear the top-right control column (locate + zoom buttons) so the hint
    // never covers the recenter button.
    right: 64,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  hintText: { textAlign: 'center' },
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    gap: Spacing.three,
  },
  sheetHeading: { fontSize: 22, lineHeight: 28 },
  inputBox: {
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    height: 48,
    justifyContent: 'center',
  },
  input: { fontSize: 16 },
  difficultyRow: { flexDirection: 'row', gap: Spacing.two },
  difficultyChip: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  checklistScroll: { maxHeight: 320 },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
});
