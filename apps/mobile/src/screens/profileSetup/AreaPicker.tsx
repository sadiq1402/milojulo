import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { BottomSheet, Button, Card, Icon, Text } from '../../components';
import type { Area, Zone } from '../../features/catalog/api';
import { distanceBand, type NearArea } from '../../features/catalog/nearest';
import {
  colors,
  fontFamily,
  fonts,
  radius,
  sizes,
  spacing,
  textStyles,
} from '../../theme';

const zones: Zone[] = ['west', 'pimpri_chinchwad', 'central', 'east', 'south'];
const zoneLabels: Record<Zone, string> = {
  west: 'West',
  pimpri_chinchwad: 'Pimpri-Chinchwad',
  central: 'Central',
  east: 'East',
  south: 'South',
};

export const privacyNote =
  'No one sees your location. Others see a rounded distance, like "~3 km".';

// Before an Area is set: the location card first, the list as the other way in.
export function LocateCard({
  locating,
  onLocate,
  onChoose,
}: {
  locating: boolean;
  onLocate: () => void;
  onChoose: () => void;
}) {
  return (
    <>
      <Card style={styles.locate}>
        <View style={styles.locateRow}>
          <PinBadge size={sizes.avatar.sheet} />
          <Text variant="bodySmall" style={styles.grow}>
            Use your location and we'll find your area. It also shows you people
            nearby.
          </Text>
        </View>
        <Button
          label="Use my location"
          variant="secondary"
          onPress={onLocate}
          loading={locating}
        />
      </Card>
      <Button label="Choose from the list" variant="text" onPress={onChoose} />
    </>
  );
}

// The chosen Area, with a way back to the list.
export function ChosenArea({
  area,
  suggested,
  onChange,
}: {
  area: Area;
  suggested: boolean;
  onChange: () => void;
}) {
  return (
    <View style={styles.chosen}>
      <PinBadge size={sizes.minVisual} />
      <View style={styles.grow}>
        <Text style={styles.semibold}>{area.label}</Text>
        {suggested ? (
          <Text variant="bodySmall" color={colors.secondary}>
            Looks like you're near here
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onChange}
        accessibilityRole="button"
        accessibilityLabel="Change"
        style={styles.change}
      >
        <Text variant="label" color={colors.orchid}>
          Change
        </Text>
      </Pressable>
    </View>
  );
}

function PinBadge({ size }: { size: number }) {
  return (
    <View
      style={[styles.pin, { width: size, height: size, borderRadius: size }]}
    >
      <Icon
        name="pin"
        size={size > sizes.minVisual ? sizes.icon.default : sizes.icon.inline}
        color={colors.orchid}
      />
    </View>
  );
}

// Nearest first when the phone's location is known, then by zone; typing turns it into a flat
// filtered list. Choosing a row closes the sheet.
export function AreaSheet({
  visible,
  areas,
  near,
  selected,
  onClose,
  onChoose,
  title = 'Choose your area',
}: {
  title?: string;
  visible: boolean;
  areas: Area[];
  near?: NearArea[];
  selected: string | null;
  onClose: () => void;
  onChoose: (areaId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const search = query.trim().toLowerCase();
  const close = () => {
    setQuery('');
    onClose();
  };
  const choose = (areaId: string) => {
    setQuery('');
    onChoose(areaId);
  };
  const row = (area: Area, right?: string, key = area.id) => (
    <AreaRow
      key={key}
      area={area}
      right={right}
      match={search}
      checked={area.id === selected}
      onPress={() => choose(area.id)}
    />
  );

  return (
    <BottomSheet visible={visible} onClose={close} full>
      <Text variant="h2" accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.search, focused && styles.searchFocused]}>
        <Icon name="search" size={sizes.icon.inline} color={colors.secondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search areas"
          placeholderTextColor={colors.secondary}
          accessibilityLabel="Search areas"
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.searchInput}
        />
      </View>
      <ScrollView style={styles.grow} keyboardShouldPersistTaps="handled">
        {search ? (
          <>
            {areas
              .filter(area => area.label.toLowerCase().includes(search))
              .map(area => row(area, zoneLabels[area.zone]))}
            <Text
              variant="bodySmall"
              color={colors.secondary}
              style={styles.hint}
            >
              Not listed? Pick the closest area. More of Pune is coming.
            </Text>
          </>
        ) : (
          <>
            {near?.length ? (
              <>
                <ZoneHeader label="Nearest to you" />
                {near.map(({ area, km }) =>
                  row(area, distanceBand(km), `near-${area.id}`),
                )}
              </>
            ) : null}
            {zones.map(zone => {
              const inZone = areas.filter(area => area.zone === zone);
              return inZone.length ? (
                <View key={zone}>
                  <ZoneHeader label={zoneLabels[zone]} />
                  {inZone.map(area => row(area))}
                </View>
              ) : null;
            })}
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function ZoneHeader({ label }: { label: string }) {
  return (
    <Text
      variant="caption"
      color={colors.secondary}
      accessibilityRole="header"
      style={styles.zone}
    >
      {label}
    </Text>
  );
}

function AreaRow({
  area,
  right,
  match,
  checked,
  onPress,
}: {
  area: Area;
  right?: string;
  match: string;
  checked: boolean;
  onPress: () => void;
}) {
  const at = match ? area.label.toLowerCase().indexOf(match) : -1;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={right ? `${area.label}, ${right}` : area.label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.grow} numberOfLines={1}>
        {at < 0 ? (
          area.label
        ) : (
          <>
            {area.label.slice(0, at)}
            <Text style={styles.mark} color={colors.orchid}>
              {area.label.slice(at, at + match.length)}
            </Text>
            {area.label.slice(at + match.length)}
          </>
        )}
      </Text>
      {right ? (
        <Text variant="bodySmall" color={colors.secondary}>
          {right}
        </Text>
      ) : null}
      <View style={[styles.radio, checked && styles.radioOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  semibold: { fontFamily: fontFamily(fonts.text, '600') },
  locate: { gap: spacing.sm },
  locateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pin: {
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // As an option card when chosen: orchid border doubled by an inset ring.
  chosen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: sizes.optionCardMin,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.r20,
    borderWidth: 1,
    borderColor: colors.orchid,
    boxShadow: `inset 0 0 0 1px ${colors.orchid}`,
    backgroundColor: colors.selected,
  },
  change: {
    minHeight: sizes.hitArea,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxs,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: sizes.input.height,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    paddingHorizontal: sizes.input.paddingX,
  },
  searchFocused: {
    borderColor: colors.orchid,
    boxShadow: `inset 0 0 0 1px ${colors.orchid}`,
  },
  searchInput: { ...textStyles.body, flex: 1, color: colors.ink, padding: 0 },
  zone: {
    fontFamily: fontFamily(fonts.text, '700'),
    textTransform: 'uppercase',
    letterSpacing: 0.72,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.listRowMin,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { backgroundColor: colors.selected },
  mark: { fontFamily: fontFamily(fonts.text, '700') },
  radio: {
    width: sizes.checkbox,
    height: sizes.checkbox,
    borderRadius: sizes.checkbox / 2,
    borderWidth: 2,
    borderColor: colors.radio,
  },
  radioOn: { borderWidth: 7, borderColor: colors.orchid },
  hint: { textAlign: 'center', paddingVertical: spacing.xl },
});
