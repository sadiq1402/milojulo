import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Icon, Text } from '../../components';
import type { Venue } from '../../features/activities/model';
import {
  highlightParts,
  newSessionToken,
  placeDetails,
  searchPlaces,
  type PlaceSuggestion,
} from '../../features/activities/places';
import {
  colors,
  fontFamily,
  fonts,
  radius,
  shadow,
  sizes,
  spacing,
  textStyles,
} from '../../theme';
import { PinMapScreen } from './PinMapScreen';

export const searchDelayMs = 300;
const minSearchLength = 2;

type Props = {
  value: Venue | null;
  // An Activity posted before #248 with only typed venue text; shown until a place replaces it.
  typedVenue?: string | null;
  onChange: (place: Venue) => void;
  error?: string;
};

// The Where field: a search through Google Places, then the chosen place with Change.
export function PlaceField({ value, typedVenue, onChange, error }: Props) {
  const chosen = value
    ? { name: value.name, address: value.address }
    : typedVenue
    ? { name: typedVenue, address: '' }
    : null;
  const [searching, setSearching] = useState(chosen === null);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [token, setToken] = useState(newSessionToken);
  const [picking, setPicking] = useState<string | null>(null);
  const [pickFailed, setPickFailed] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), searchDelayMs);
    return () => clearTimeout(timer);
  }, [text]);

  const search = useQuery({
    queryKey: ['places', token, query],
    queryFn: () => searchPlaces(query, token),
    enabled: searching && query.length >= minSearchLength,
    staleTime: Infinity,
    retry: false,
  });

  const pick = async (suggestion: PlaceSuggestion) => {
    setPicking(suggestion.placeId);
    setPickFailed(null);
    try {
      const place = await placeDetails(suggestion.placeId, token);
      onChange(place);
      setSearching(false);
      setText('');
      setQuery('');
      // The pick ends Google's session; a new search starts another.
      setToken(newSessionToken());
    } catch (e) {
      setPickFailed((e as Error).message);
    } finally {
      setPicking(null);
    }
  };

  const choosePin = (place: Venue) => {
    onChange(place);
    setPinning(false);
    setSearching(false);
    setText('');
    setQuery('');
  };

  if (!searching && chosen) {
    return (
      <View style={styles.field}>
        <View style={styles.place}>
          <View style={styles.fill}>
            <Text style={styles.placeName}>{chosen.name}</Text>
            {chosen.address ? (
              <Text variant="bodySmall" color={colors.secondary}>
                {chosen.address}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => setSearching(true)}
            accessibilityRole="button"
            accessibilityLabel={`Change the place: ${chosen.name}`}
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          >
            <Text variant="bodySmall" color={colors.orchid} style={styles.bold}>
              Change
            </Text>
          </Pressable>
        </View>
        <FieldError message={error} />
      </View>
    );
  }

  const suggestions = query.length >= minSearchLength ? search.data ?? [] : [];
  const failed = search.isError ? search.error.message : pickFailed;
  return (
    <View style={styles.field}>
      <View style={[styles.input, error ? styles.invalid : null]}>
        <Icon name="search" size={sizes.icon.inline} color={colors.secondary} />
        <TextInput
          accessibilityLabel="Search for the place"
          placeholder="Search for a place"
          placeholderTextColor={colors.secondary}
          value={text}
          onChangeText={setText}
          autoCorrect={false}
          returnKeyType="search"
          style={styles.inputText}
        />
        {search.isFetching ? (
          <ActivityIndicator size="small" color={colors.orchid} />
        ) : null}
      </View>
      {query.length >= minSearchLength ? (
        <View style={styles.list}>
          {suggestions.map((s, i) => (
            <Pressable
              key={s.placeId}
              onPress={() => pick(s)}
              disabled={picking !== null}
              accessibilityRole="button"
              accessibilityLabel={[s.mainText, s.secondaryText]
                .filter(Boolean)
                .join(', ')}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.divided,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.fill}>
                <Text style={styles.rowName}>
                  {highlightParts(s).map((part, j) =>
                    part.matched ? (
                      <Text key={j} style={[styles.rowName, styles.match]}>
                        {part.text}
                      </Text>
                    ) : (
                      part.text
                    ),
                  )}
                </Text>
                {s.secondaryText ? (
                  <Text style={styles.rowAddress} color={colors.secondary}>
                    {s.secondaryText}
                  </Text>
                ) : null}
              </View>
              {picking === s.placeId ? (
                <ActivityIndicator size="small" color={colors.orchid} />
              ) : null}
            </Pressable>
          ))}
          {/* Always last: for a ground, a gate or a corner Google doesn't list (#249). */}
          <Pressable
            onPress={() => setPinning(true)}
            accessibilityRole="button"
            accessibilityLabel="Not listed? Drop a pin on the map"
            style={({ pressed }) => [
              styles.row,
              styles.pinRow,
              suggestions.length > 0 && styles.divided,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="pin" size={22} color={colors.orchid} />
            <View style={styles.fill}>
              <Text style={[styles.rowName, styles.pinText]}>
                Not listed? Drop a pin on the map
              </Text>
              <Text style={styles.rowAddress} color={colors.secondary}>
                For a ground, a gate or a corner with no name
              </Text>
            </View>
          </Pressable>
          {suggestions.length > 0 ? (
            <Text
              variant="caption"
              color={colors.secondary}
              style={styles.google}
            >
              Results from Google
            </Text>
          ) : null}
        </View>
      ) : null}
      <FieldError message={failed ?? error} />
      {pinning ? (
        <PinMapScreen
          visible
          onClose={() => setPinning(false)}
          onUse={choosePin}
        />
      ) : null}
    </View>
  );
}

function FieldError({ message }: { message: string | null | undefined }) {
  return message ? (
    <Text
      variant="bodySmall"
      color={colors.danger}
      accessibilityLiveRegion="polite"
    >
      {message}
    </Text>
  ) : null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  field: { gap: 6 },
  bold: { fontFamily: fontFamily(fonts.text, '700') },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.r20,
    paddingVertical: spacing.sm,
    paddingHorizontal: 14,
    backgroundColor: colors.selected,
  },
  placeName: {
    ...textStyles.body,
    lineHeight: 22,
    fontFamily: fontFamily(fonts.text, '600'),
  },
  input: {
    height: sizes.input.height,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  invalid: { borderColor: colors.danger },
  inputText: {
    ...textStyles.body,
    flex: 1,
    color: colors.ink,
    paddingVertical: 0,
  },
  list: {
    marginTop: spacing.xs,
    borderRadius: radius.r24,
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...shadow('card'),
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  pressed: { backgroundColor: colors.tint },
  pinRow: { backgroundColor: colors.selected },
  pinText: { color: colors.orchidDark },
  rowName: {
    ...textStyles.bodySmall,
    fontSize: 15,
    fontFamily: fontFamily(fonts.text, '600'),
    color: colors.ink,
  },
  match: {
    color: colors.orchidDark,
    fontFamily: fontFamily(fonts.text, '700'),
  },
  rowAddress: { ...textStyles.bodySmall, fontSize: 13, lineHeight: 18 },
  google: {
    textAlign: 'right',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
