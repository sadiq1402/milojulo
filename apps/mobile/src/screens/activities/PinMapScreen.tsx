import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, IconButton, Input, Text } from '../../components';
import type { Venue } from '../../features/activities/model';
import { pinAddress, pinAddressFailed } from '../../features/activities/places';
import { currentPosition } from '../../features/location/device';
import {
  colors,
  fontFamily,
  fonts,
  layout,
  radius,
  shadow,
  sizes,
  spacing,
  textStyles,
} from '../../theme';

export const addressDelayMs = 400;
// The venue name's length in the database.
export const spotNameMaxLength = 200;
// Where the map opens when the phone can't say where the host is.
export const pinFallback = { lat: 18.5204, lng: 73.8567 };
const zoom = { latitudeDelta: 0.005, longitudeDelta: 0.005 };

type Point = { lat: number; lng: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  onUse: (place: Venue) => void;
};

// Drop a pin (#249): the Google Map with Google's draggable marker, for a place search doesn't list.
export function PinMapScreen({ visible, onClose, onUse }: Props) {
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [pin, setPin] = useState<Point>(pinFallback);
  const [settled, setSettled] = useState<Point>(pinFallback);
  const moved = useRef(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [locateFailed, setLocateFailed] = useState(false);
  const keyboard = useReanimatedKeyboardAnimation();
  const keyboardRoom = useAnimatedStyle(() => ({
    paddingBottom: Math.max(-keyboard.height.value - insets.bottom, 0),
  }));

  const moveTo = (point: Point) => {
    setPin(point);
    map.current?.animateToRegion({
      latitude: point.lat,
      longitude: point.lng,
      ...zoom,
    });
  };

  const goToMe = async () => {
    try {
      moveTo(await currentPosition());
      setLocateFailed(false);
    } catch {
      setLocateFailed(true);
    }
  };

  // Opens where the host is; a pin they've already moved stays put.
  useEffect(() => {
    if (!visible) {
      return;
    }
    let live = true;
    currentPosition().then(
      point => live && !moved.current && moveTo(point),
      () => {},
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(pin), addressDelayMs);
    return () => clearTimeout(timer);
  }, [pin]);

  const address = useQuery({
    queryKey: ['pinAddress', settled.lat, settled.lng],
    queryFn: () => pinAddress(settled.lat, settled.lng),
    enabled: visible,
    staleTime: Infinity,
    retry: false,
  });

  const drop = (point: Point) => {
    moved.current = true;
    setPin(point);
  };

  const use = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give this spot a name.');
      return;
    }
    onUse({
      name: trimmed,
      address: address.data ?? '',
      placeId: null,
      lat: pin.lat,
      lng: pin.lng,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <MapView
          ref={map}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: pinFallback.lat,
            longitude: pinFallback.lng,
            ...zoom,
          }}
          toolbarEnabled={false}
          onPress={e =>
            drop({
              lat: e.nativeEvent.coordinate.latitude,
              lng: e.nativeEvent.coordinate.longitude,
            })
          }
        >
          <Marker
            testID="spot-pin"
            draggable
            pinColor={colors.orchid}
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            onDragEnd={e =>
              drop({
                lat: e.nativeEvent.coordinate.latitude,
                lng: e.nativeEvent.coordinate.longitude,
              })
            }
          />
        </MapView>
        <View
          style={[styles.top, { paddingTop: insets.top + spacing.xs }]}
          pointerEvents="box-none"
        >
          <View style={styles.floating}>
            <IconButton
              icon="back"
              accessibilityLabel="Back"
              onPress={onClose}
            />
          </View>
          <Text style={[styles.tip, styles.floatingTip]}>
            Press and hold the pin to move it
          </Text>
        </View>
        <Reanimated.View style={[styles.bottom, keyboardRoom]}>
          <View style={styles.locateRow} pointerEvents="box-none">
            {locateFailed ? (
              <Text
                variant="bodySmall"
                style={styles.floatingTip}
                accessibilityLiveRegion="polite"
              >
                Turn on location to go to where you are.
              </Text>
            ) : null}
            <View style={styles.floating}>
              <IconButton
                icon="locate"
                color={colors.orchid}
                accessibilityLabel="Go to my location"
                onPress={goToMe}
              />
            </View>
          </View>
          <View
            style={[
              styles.sheet,
              { paddingBottom: sizes.sheet.paddingTop + insets.bottom },
            ]}
          >
            <View style={styles.handle} />
            <View style={styles.address}>
              <Icon name="pin" size={sizes.icon.inline} color={colors.orchid} />
              <View style={styles.fill}>
                <AddressLine
                  loading={address.isFetching || pin !== settled}
                  failed={address.isError}
                  address={address.data}
                  onRetry={() => address.refetch()}
                />
                <Text variant="bodySmall" color={colors.secondary}>
                  The nearest address, worked out from the pin
                </Text>
              </View>
            </View>
            <Input
              label="Name this spot"
              placeholder="e.g. Nets behind the ground, gate 2"
              value={name}
              onChangeText={text => {
                setName(text);
                setNameError(undefined);
              }}
              maxLength={spotNameMaxLength}
              error={nameError}
            />
            <Button label="Use this spot" onPress={use} />
          </View>
        </Reanimated.View>
      </View>
    </Modal>
  );
}

function AddressLine({
  loading,
  failed,
  address,
  onRetry,
}: {
  loading: boolean;
  failed: boolean;
  address: string | undefined;
  onRetry: () => void;
}) {
  if (loading) {
    return <Text style={styles.addressText}>Finding the nearest address…</Text>;
  }
  if (failed) {
    return (
      <View style={styles.failed}>
        <Text style={styles.addressText} accessibilityLiveRegion="polite">
          {pinAddressFailed}
        </Text>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try finding the address again"
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
        >
          <Text variant="bodySmall" color={colors.orchid} style={styles.bold}>
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }
  return (
    <Text style={styles.addressText}>
      {address ? `Near ${address}` : 'No street address here'}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card },
  fill: { flex: 1 },
  bold: { fontFamily: fontFamily(fonts.text, '700') },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  floating: {
    backgroundColor: colors.card,
    borderRadius: radius.full,
    ...shadow('card'),
  },
  tip: {
    ...textStyles.bodySmall,
    fontFamily: fontFamily(fonts.text, '600'),
    color: colors.ink,
  },
  floatingTip: {
    backgroundColor: colors.card,
    borderRadius: radius.r20,
    paddingVertical: spacing.xs,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  locateRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.r28,
    borderTopRightRadius: radius.r28,
    paddingTop: sizes.sheet.paddingTop,
    paddingHorizontal: layout.pageMargin,
    gap: spacing.sm,
    ...shadow('sheet'),
  },
  handle: {
    width: sizes.sheet.handle.w,
    height: sizes.sheet.handle.h,
    borderRadius: sizes.sheet.handle.h,
    backgroundColor: colors.handle,
    alignSelf: 'center',
  },
  address: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  addressText: {
    ...textStyles.body,
    lineHeight: 22,
    fontFamily: fontFamily(fonts.text, '600'),
    color: colors.ink,
  },
  failed: { gap: spacing.xxs, alignItems: 'flex-start' },
});
