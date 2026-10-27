import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomSheet, Button, Text } from '../../components';
import { formatTime, from12h, to12h } from '../../features/activities/time';
import {
  colors,
  fontFamily,
  fonts,
  radius,
  sizes,
  spacing,
  textStyles,
} from '../../theme';

type Props = {
  visible: boolean;
  title: string;
  // Minutes after midnight.
  initial: number;
  onPick: (minutes: number) => void;
  onClose: () => void;
};

const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const minuteMarks = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const dialSize = 256;
const numberSize = 44;
const ring = 100;
const pad = (n: number) => String(n).padStart(2, '0');

export function TimePickerSheet({ visible, onClose, ...rest }: Props) {
  // Every opening starts from the chosen time, on the hours.
  const [round, setRound] = useState(0);
  const close = () => {
    setRound(r => r + 1);
    onClose();
  };
  return (
    <BottomSheet visible={visible} onClose={close}>
      <Clock key={round} {...rest} onClose={close} />
    </BottomSheet>
  );
}

function Clock({ title, initial, onPick, onClose }: Omit<Props, 'visible'>) {
  const start = to12h(initial);
  const [hour, setHour] = useState(start.hour);
  // A time not on a 5-minute mark still shows as is until a mark is tapped.
  const [minute, setMinute] = useState(start.minute);
  const [pm, setPm] = useState(start.pm);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const value = from12h(hour, minute, pm);
  const marks = mode === 'hour' ? hours : minuteMarks;
  const current = mode === 'hour' ? hour : minute;
  const at = marks.indexOf(current);

  return (
    <View style={styles.body}>
      <Text variant="h2" accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.readout}>
        <ReadoutPart
          label={String(hour)}
          accessibilityLabel={`Hour, ${hour}`}
          on={mode === 'hour'}
          onPress={() => setMode('hour')}
        />
        <Text style={styles.big}>:</Text>
        <ReadoutPart
          label={pad(minute)}
          accessibilityLabel={`Minutes, ${pad(minute)}`}
          on={mode === 'minute'}
          onPress={() => setMode('minute')}
        />
        <View style={styles.halves}>
          {(['am', 'pm'] as const).map(half => {
            const selected = (half === 'pm') === pm;
            return (
              <Pressable
                key={half}
                onPress={() => setPm(half === 'pm')}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                hitSlop={8}
                style={[styles.half, selected && styles.halfOn]}
              >
                <Text
                  style={styles.halfLabel}
                  color={selected ? colors.white : colors.ink}
                >
                  {half}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Text variant="bodySmall" color={colors.secondary} style={styles.hint}>
        {mode === 'hour' ? 'Tap the hour.' : 'Tap the minutes.'}
      </Text>
      <View style={styles.dial}>
        {at >= 0 ? <Hand angle={at * 30 - 90} /> : null}
        <View style={styles.hub} />
        {marks.map((mark, i) => {
          const angle = ((i * 30 - 90) * Math.PI) / 180;
          const selected = mark === current;
          return (
            <Pressable
              key={mark}
              onPress={() => {
                if (mode === 'hour') {
                  setHour(mark);
                  setMode('minute');
                } else {
                  setMinute(mark);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={
                mode === 'hour' ? `${mark} o'clock` : `${pad(mark)} minutes`
              }
              accessibilityState={{ selected }}
              hitSlop={(sizes.hitArea - numberSize) / 2}
              style={[
                styles.number,
                {
                  left: dialSize / 2 + ring * Math.cos(angle) - numberSize / 2,
                  top: dialSize / 2 + ring * Math.sin(angle) - numberSize / 2,
                },
                selected && styles.numberOn,
              ]}
            >
              <Text
                color={selected ? colors.white : colors.ink}
                style={selected ? styles.bold : styles.medium}
              >
                {mode === 'hour' ? mark : pad(mark)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Button
        label={`Set ${formatTime(value)}`}
        onPress={() => {
          onPick(value);
          onClose();
        }}
      />
      <Button label="Cancel" variant="text" onPress={onClose} />
    </View>
  );
}

function ReadoutPart({
  label,
  accessibilityLabel,
  on,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: on }}
      style={[styles.part, on && styles.partOn]}
    >
      <Text style={styles.big} color={on ? colors.orchidDark : colors.ink}>
        {label}
      </Text>
    </Pressable>
  );
}

// A line from the dial's centre towards the chosen mark.
function Hand({ angle }: { angle: number }) {
  return (
    <View
      importantForAccessibility="no"
      style={[
        styles.hand,
        {
          left: dialSize / 2 - ring / 2,
          top: dialSize / 2 - 1,
          transform: [{ rotate: `${angle}deg` }, { translateX: ring / 2 }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  big: { ...textStyles.display },
  part: {
    borderRadius: radius.r16,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    minHeight: sizes.hitArea,
    justifyContent: 'center',
    backgroundColor: colors.selected,
  },
  partOn: { backgroundColor: colors.tint },
  halves: { gap: spacing.xxs, marginLeft: spacing.xs },
  half: {
    width: 52,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfOn: { backgroundColor: colors.orchid, borderColor: colors.orchid },
  halfLabel: {
    ...textStyles.bodySmall,
    fontFamily: fontFamily(fonts.text, '700'),
  },
  hint: { textAlign: 'center' },
  dial: {
    width: dialSize,
    height: dialSize,
    borderRadius: dialSize / 2,
    backgroundColor: colors.selected,
    alignSelf: 'center',
  },
  hub: {
    position: 'absolute',
    left: dialSize / 2 - 4,
    top: dialSize / 2 - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.orchid,
  },
  hand: {
    position: 'absolute',
    width: ring,
    height: 2,
    backgroundColor: colors.orchid,
  },
  number: {
    position: 'absolute',
    width: numberSize,
    height: numberSize,
    borderRadius: numberSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberOn: { backgroundColor: colors.orchid },
  medium: { fontFamily: fontFamily(fonts.text, '500') },
  bold: { fontFamily: fontFamily(fonts.text, '700') },
});
