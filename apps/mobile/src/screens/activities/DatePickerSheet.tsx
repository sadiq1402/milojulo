import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomSheet, Button, IconButton, Text } from '../../components';
import {
  addMonths,
  lastPickableDay,
  maxDaysAhead,
  monthGrid,
  monthTitle,
  shortDate,
} from '../../features/activities/time';
import { colors, fontFamily, fonts, sizes, spacing } from '../../theme';

type Props = {
  visible: boolean;
  // India calendar days ("2026-11-14").
  todayKey: string;
  initial: string;
  onPick: (dateKey: string) => void;
  onClose: () => void;
};

const weekdayInitials = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const daySize = 44;

export function DatePickerSheet({ visible, onClose, ...rest }: Props) {
  // Every opening starts from the chosen day, not where the last one was left.
  const [round, setRound] = useState(0);
  const close = () => {
    setRound(r => r + 1);
    onClose();
  };
  return (
    <BottomSheet visible={visible} onClose={close}>
      <Calendar key={round} {...rest} onClose={close} />
    </BottomSheet>
  );
}

function Calendar({
  todayKey,
  initial,
  onPick,
  onClose,
}: Omit<Props, 'visible'>) {
  const last = lastPickableDay(todayKey);
  const [picked, setPicked] = useState(initial);
  const [month, setMonth] = useState(initial.slice(0, 7));

  return (
    <View style={styles.body}>
      <Text variant="h2" accessibilityRole="header">
        Pick a date
      </Text>
      <Text variant="bodySmall" color={colors.secondary}>
        Any day up to {maxDaysAhead} days from today.
      </Text>
      <View style={styles.month}>
        <IconButton
          icon="back"
          accessibilityLabel="Previous month"
          disabled={month <= todayKey.slice(0, 7)}
          onPress={() => setMonth(m => addMonths(m, -1))}
        />
        <Text variant="title">{monthTitle(month)}</Text>
        <IconButton
          icon="chevronRight"
          accessibilityLabel="Next month"
          disabled={month >= last.slice(0, 7)}
          onPress={() => setMonth(m => addMonths(m, 1))}
        />
      </View>
      <View style={styles.grid}>
        {weekdayInitials.map((initialLetter, i) => (
          <View
            key={`w${i}`}
            style={styles.cell}
            importantForAccessibility="no"
          >
            <Text variant="caption" color={colors.secondary}>
              {initialLetter}
            </Text>
          </View>
        ))}
        {monthGrid(month).map((day, i) => {
          if (!day) {
            return <View key={`b${i}`} style={styles.cell} />;
          }
          const disabled = day < todayKey || day > last;
          const selected = day === picked;
          return (
            <View key={day} style={styles.cell}>
              <Pressable
                onPress={() => setPicked(day)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={shortDate(day)}
                accessibilityState={{ disabled, selected }}
                style={[
                  styles.day,
                  day === todayKey && styles.today,
                  selected && styles.selected,
                ]}
              >
                <Text
                  color={
                    selected
                      ? colors.white
                      : disabled
                      ? colors.radio
                      : day === todayKey
                      ? colors.orchidDark
                      : colors.ink
                  }
                  style={selected || day === todayKey ? styles.bold : null}
                >
                  {Number(day.slice(8))}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <Button
        label={`Use ${shortDate(picked)}`}
        onPress={() => {
          onPick(picked);
          onClose();
        }}
      />
      <Button label="Cancel" variant="text" onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  month: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    height: sizes.hitArea,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: daySize,
    height: daySize,
    borderRadius: daySize / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { borderWidth: 1.5, borderColor: colors.orchid },
  selected: { backgroundColor: colors.orchid, borderColor: colors.orchid },
  bold: { fontFamily: fontFamily(fonts.text, '700') },
});
