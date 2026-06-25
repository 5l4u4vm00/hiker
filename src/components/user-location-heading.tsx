import { Images, Layer, UserLocation } from '@maplibre/maplibre-react-native';

import { useDeviceHeading } from '@/map/use-device-heading';

// Source id created by UserLocation's internal LayerAnnotation. Children layers
// reference it so they track the user position automatically.
const SOURCE = 'mlrn-user-location';
const HEADING_IMAGE_ID = 'user-heading-arrow';
const PUCK_BLUE = '#33B5E5';

// Reuses MapLibre's own north-pointing heading arrow (see assets/images).
const HEADING_IMAGE = require('@/assets/images/user-heading.png');

/**
 * User location dot with a compass-driven heading arrow (Google-Maps "blue cone"
 * style): the arrow points where the device is physically facing, even when
 * stationary. Replaces MapLibre's built-in `heading`, which only rotates by GPS
 * course-over-ground and so is meaningless while standing still.
 *
 * Renders a custom puck as `UserLocation` children — the dot circles plus a
 * symbol layer rotated by `useDeviceHeading`. Falls back to a plain dot until a
 * compass reading is available.
 */
export function UserLocationHeading() {
  const heading = useDeviceHeading();

  return (
    <>
      <Images images={{ [HEADING_IMAGE_ID]: HEADING_IMAGE }} />
      <UserLocation>
        <Layer
          id="mlrn-user-dot-white"
          type="circle"
          source={SOURCE}
          paint={{ 'circle-radius': 9, 'circle-color': '#ffffff', 'circle-pitch-alignment': 'map' }}
        />
        <Layer
          id="mlrn-user-dot-blue"
          type="circle"
          source={SOURCE}
          paint={{ 'circle-radius': 6, 'circle-color': PUCK_BLUE, 'circle-pitch-alignment': 'map' }}
        />
        {heading != null ? (
          <Layer
            id="mlrn-user-heading-arrow"
            type="symbol"
            source={SOURCE}
            beforeId="mlrn-user-dot-white"
            layout={{
              'icon-image': HEADING_IMAGE_ID,
              'icon-allow-overlap': true,
              'icon-pitch-alignment': 'map',
              'icon-rotation-alignment': 'map',
              'icon-rotate': heading,
            }}
          />
        ) : null}
      </UserLocation>
    </>
  );
}
