import { useMutation } from '@tanstack/react-query';
import React, { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  Button,
  Card,
  Chip,
  FlowScreen,
  Icon,
  Input,
  Text,
  TextArea,
  type IconName,
} from '../../components';
import {
  ActivityError,
  activityTypeLabels,
  activityTypes,
  descriptionMaxLength,
  fieldMessages,
  maxSpots,
  minSpots,
  titleMaxLength,
  venueMaxLength,
  type ActivityField,
  type ActivityType,
} from '../../features/activities/model';
import {
  dayLabel,
  dayOptions,
  durationLabel,
  formatTime,
  formatWhen,
  indiaInstant,
  indiaParts,
  minutesBetween,
  shiftTime,
  shortDate,
} from '../../features/activities/time';
import {
  activityTones,
  colors,
  fontFamily,
  fonts,
  radius,
  sizes,
  spacing,
  textStyles,
} from '../../theme';
import { DatePickerSheet } from './DatePickerSheet';
import { TimePickerSheet } from './TimePickerSheet';

// An India calendar day and minutes after its midnight.
export type DayTime = { day: string; minutes: number };

export type FormValues = {
  title: string;
  type: ActivityType | null;
  day: string;
  minutes: number;
  // Null when there's no set end.
  end: DayTime | null;
  capacity: number;
  description: string;
  venueDetail: string;
};

export const defaultLength = 120;

export function startsAtOf(values: FormValues): string {
  return indiaInstant(values.day, values.minutes);
}

export function endsAtOf(values: FormValues): string | null {
  return values.end ? indiaInstant(values.end.day, values.end.minutes) : null;
}

// The end a given length after the start, on a later day if it runs past midnight.
export function endAfter(start: DayTime, length: number): DayTime {
  const end = shiftTime({ dateKey: start.day, minutes: start.minutes }, length);
  return { day: end.dateKey, minutes: end.minutes };
}

const lengthOf = (start: DayTime, end: DayTime) =>
  minutesBetween(
    { dateKey: start.day, minutes: start.minutes },
    { dateKey: end.day, minutes: end.minutes },
  );

const typeIcons: Record<ActivityType, IconName> = {
  sports: 'sports',
  food_chai: 'cup',
  outdoors: 'mountain',
  games: 'gamepad',
  learning: 'cap',
};

type Props = {
  heading: string;
  submitLabel: string;
  initial: FormValues;
  onBack: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
  // Editing: the type can't change, and a set end can't be removed.
  editing?: boolean;
  // A Locked Activity: only the description and more Spots.
  locked?: boolean;
  // Posting from a Circle: its name, shown so the Member knows where it goes.
  circleName?: string;
};

type Errors = Partial<Record<ActivityField, string>>;

const errorFieldOf: Record<keyof FormValues, ActivityField> = {
  title: 'title',
  type: 'type',
  day: 'startsAt',
  minutes: 'startsAt',
  end: 'endsAt',
  capacity: 'capacity',
  description: 'description',
  venueDetail: 'venueDetail',
};

type Section = 'what' | 'when' | 'where' | 'who';

const sectionOf: Record<ActivityField, Section> = {
  title: 'what',
  type: 'what',
  startsAt: 'when',
  endsAt: 'when',
  venueDetail: 'where',
  capacity: 'who',
  description: 'who',
};

type Picker = 'startDay' | 'startTime' | 'endDay' | 'endTime' | null;

export function ActivityForm({
  heading,
  submitLabel,
  initial,
  onBack,
  onSubmit,
  editing = false,
  locked = false,
  circleName,
}: Props) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Fields sit inside cards, so a field's top on the page is its card's top plus its own.
  const sectionTops = useRef<Partial<Record<Section, number>>>({});
  const tops = useRef<Partial<Record<ActivityField, number>>>({});
  const section = (name: Section) => ({
    onLayout: (e: LayoutChangeEvent) => {
      sectionTops.current[name] = e.nativeEvent.layout.y;
    },
  });
  const anchor = (field: ActivityField) => ({
    testID: `field-${field}`,
    onLayout: (e: LayoutChangeEvent) => {
      tops.current[field] = e.nativeEvent.layout.y;
    },
  });
  const scrollToFirst = (found: Errors) => {
    const ys = (Object.keys(found) as ActivityField[])
      .filter(field => tops.current[field] !== undefined)
      .map(
        field =>
          (sectionTops.current[sectionOf[field]] ?? 0) + tops.current[field]!,
      );
    if (ys.length > 0) {
      scroll.current?.scrollTo({ y: Math.min(...ys), animated: true });
    }
  };
  // Field refusals show beside their field; anything else under the button.
  const send = useMutation({
    mutationFn: onSubmit,
    onError: e => {
      if (e instanceof ActivityError && e.field) {
        setErrors({ [e.field]: e.message });
        scrollToFirst({ [e.field]: e.message });
      }
    },
  });
  const general =
    send.error && !(send.error instanceof ActivityError && send.error.field)
      ? send.error.message
      : undefined;
  // Changing a field clears its error.
  const set = (changes: Partial<FormValues>) => {
    setValues(v => ({ ...v, ...changes }));
    setErrors(e => {
      const next = { ...e };
      for (const key of Object.keys(changes) as (keyof FormValues)[]) {
        delete next[errorFieldOf[key]];
      }
      return next;
    });
  };
  // A new start keeps the length, so the end moves with it.
  const setStart = (start: Partial<DayTime>) => {
    const from = { day: values.day, minutes: values.minutes };
    const to = { ...from, ...start };
    set({
      ...to,
      end: values.end ? endAfter(to, lengthOf(from, values.end)) : null,
    });
  };
  const start = { day: values.day, minutes: values.minutes };

  const todayKey = indiaParts(new Date()).dateKey;
  const days = dayOptions(todayKey);
  // A day past the quick chips shows on the Pick a date chip.
  const pickedDay = days.includes(values.day) ? null : values.day;
  const [picking, setPicking] = useState<Picker>(null);
  const close = () => setPicking(null);
  const minCapacity = locked ? initial.capacity : minSpots;
  // The database keeps a set end when sent null, so an edit can't remove one.
  const canRemoveEnd = !editing || initial.end === null;
  const length = values.end ? lengthOf(start, values.end) : null;
  // Opening the end's date or time with no end set adds the default one first.
  const end = values.end ?? endAfter(start, defaultLength);
  const openEnd = (picker: 'endDay' | 'endTime') => {
    if (!values.end) {
      set({ end });
    }
    setPicking(picker);
  };

  const check = (): Errors => {
    const found: Errors = {};
    if (!locked && !values.title.trim()) {
      found.title = fieldMessages.title;
    }
    if (!editing && !values.type) {
      found.type = fieldMessages.type;
    }
    const startChanged =
      values.day !== initial.day || values.minutes !== initial.minutes;
    if (
      !locked &&
      (!editing || startChanged) &&
      Date.parse(startsAtOf(values)) <= Date.now()
    ) {
      found.startsAt = fieldMessages.startsAt;
    }
    if (!locked && length !== null && length <= 0) {
      found.endsAt = fieldMessages.endsAt;
    }
    return found;
  };

  const submit = () => {
    const found = check();
    setErrors(found);
    send.reset();
    if (Object.keys(found).length === 0) {
      send.mutate(values);
    } else {
      scrollToFirst(found);
    }
  };

  const title = values.title.trim();
  const summary = title
    ? [
        formatWhen(startsAtOf(values), endsAtOf(values)),
        values.venueDetail.trim(),
        `${values.capacity} ${values.capacity === 1 ? 'spot' : 'spots'}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <FlowScreen
      scrollRef={scroll}
      barTitle={editing ? undefined : heading}
      title={editing ? heading : 'What are you up to?'}
      intro={
        editing
          ? undefined
          : 'People near you see it on the board and ask to join. You choose who comes.'
      }
      onBack={onBack}
      footer={
        <>
          <View style={styles.summary}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: values.type
                    ? activityTones[values.type]
                    : colors.field,
                },
              ]}
            />
            <Text
              variant="bodySmall"
              color={colors.secondary}
              numberOfLines={1}
              style={styles.fill}
            >
              {summary ? (
                <>
                  <Text variant="bodySmall" style={styles.bold}>
                    {title}
                  </Text>
                  {` · ${summary}`}
                </>
              ) : (
                'Add the plan to post'
              )}
            </Text>
          </View>
          {general ? (
            <Text
              variant="bodySmall"
              color={colors.danger}
              accessibilityLiveRegion="polite"
            >
              {general}
            </Text>
          ) : null}
          <Button
            label={submitLabel}
            loading={send.isPending || send.isSuccess}
            onPress={submit}
          />
        </>
      }
    >
      {circleName ? (
        <Card style={styles.notice}>
          <Text variant="bodySmall" color={colors.orchidDark}>
            Posting to {circleName}. It shows on the main board too.
          </Text>
        </Card>
      ) : null}
      {locked ? (
        <Card style={styles.notice}>
          <Text variant="bodySmall" color={colors.orchidDark}>
            Someone has joined, so the title, time and venue stay as they are.
            You can still change the details or add Spots.
          </Text>
        </Card>
      ) : null}
      {locked && editing ? null : (
        <Card style={styles.card} {...section('what')}>
          <SectionHeading icon="star" label="What" />
          {locked ? null : (
            <View {...anchor('title')}>
              <Input
                label="The plan"
                placeholder="e.g. Badminton doubles"
                value={values.title}
                onChangeText={text => set({ title: text })}
                maxLength={titleMaxLength}
                error={errors.title}
              />
            </View>
          )}
          {editing ? null : (
            <View style={styles.field} {...anchor('type')}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.types}>
                {activityTypes.map(type => {
                  const selected = values.type === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => set({ type })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[
                        styles.type,
                        { backgroundColor: activityTones[type] },
                        selected && styles.typeOn,
                      ]}
                    >
                      <Icon name={typeIcons[type]} size={22} />
                      <Text style={styles.typeLabel}>
                        {activityTypeLabels[type]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <FieldError message={errors.type} />
            </View>
          )}
        </Card>
      )}
      {locked ? null : (
        <Card style={styles.card} {...section('when')}>
          <SectionHeading icon="clock" label="When" />
          <View style={styles.field}>
            <Text style={styles.label}>Day</Text>
            <View style={styles.chips}>
              {days.map(day => (
                <Chip
                  key={day}
                  label={dayLabel(day, todayKey)}
                  selected={values.day === day}
                  onPress={() => setStart({ day })}
                />
              ))}
              <Chip
                label={pickedDay ? shortDate(pickedDay) : 'Pick a date'}
                icon="calendar"
                dashed
                selected={pickedDay !== null}
                onPress={() => setPicking('startDay')}
              />
            </View>
          </View>
          <View style={styles.field} {...anchor('startsAt')}>
            <PickerField
              label="Starts at"
              value={formatTime(values.minutes)}
              icon="clock"
              onPress={() => setPicking('startTime')}
            />
            <FieldError message={errors.startsAt} />
          </View>
          <View style={styles.field} {...anchor('endsAt')}>
            <Text style={styles.label}>Ends</Text>
            <View style={styles.two}>
              <PickerField
                accessibilityName="End date"
                value={values.end ? dayLabel(values.end.day, todayKey) : '—'}
                icon="calendar"
                onPress={() => openEnd('endDay')}
              />
              <PickerField
                accessibilityName="End time"
                value={values.end ? formatTime(values.end.minutes) : '—'}
                icon="clock"
                onPress={() => openEnd('endTime')}
              />
            </View>
            <View style={styles.caption}>
              <Text variant="bodySmall" color={colors.secondary}>
                {length === null
                  ? 'No set end.'
                  : length > 0
                  ? `Lasts ${durationLabel(length)}.`
                  : null}
              </Text>
              {length === null ? (
                <TextLink
                  label="Add an end"
                  onPress={() => set({ end: endAfter(start, defaultLength) })}
                />
              ) : canRemoveEnd ? (
                <TextLink
                  label="No set end"
                  onPress={() => set({ end: null })}
                />
              ) : null}
            </View>
            <FieldError message={errors.endsAt} />
          </View>
          <DatePickerSheet
            visible={picking === 'startDay'}
            todayKey={todayKey}
            initial={values.day < todayKey ? todayKey : values.day}
            onPick={day => setStart({ day })}
            onClose={close}
          />
          <TimePickerSheet
            visible={picking === 'startTime'}
            title="Start time"
            initial={values.minutes}
            onPick={minutes => setStart({ minutes })}
            onClose={close}
          />
          <DatePickerSheet
            visible={picking === 'endDay'}
            todayKey={todayKey}
            initial={end.day < todayKey ? todayKey : end.day}
            onPick={day => set({ end: { ...end, day } })}
            onClose={close}
          />
          <TimePickerSheet
            visible={picking === 'endTime'}
            title="End time"
            initial={end.minutes}
            onPick={minutes => set({ end: { ...end, minutes } })}
            onClose={close}
          />
        </Card>
      )}
      {locked ? null : (
        <Card style={styles.card} {...section('where')}>
          <SectionHeading icon="pin" label="Where" />
          <View style={styles.field} {...anchor('venueDetail')}>
            <Input
              label="Where exactly (optional)"
              placeholder="e.g. Baner Sports Complex, court 2"
              value={values.venueDetail}
              onChangeText={venueDetail => set({ venueDetail })}
              maxLength={venueMaxLength}
              error={errors.venueDetail}
            />
            <Text variant="bodySmall" color={colors.secondary}>
              Everyone who sees the Activity sees this place.
            </Text>
          </View>
        </Card>
      )}
      <Card style={styles.card} {...section('who')}>
        <SectionHeading icon="people" label="Who" />
        <View style={styles.field} {...anchor('capacity')}>
          <View style={styles.spots}>
            <View
              accessible
              accessibilityLabel={`Spots: ${values.capacity}`}
              accessibilityLiveRegion="polite"
            >
              <Text style={styles.label}>Spots</Text>
              <Text style={styles.spotsValue}>
                {values.capacity}
                <Text variant="bodySmall" color={colors.secondary}>
                  {`  ${
                    values.capacity === 1 ? 'person' : 'people'
                  } besides you`}
                </Text>
              </Text>
            </View>
            <View style={styles.stepButtons}>
              <RoundButton
                icon="minus"
                accessibilityLabel="Fewer spots"
                enabled={values.capacity > minCapacity}
                onPress={() => set({ capacity: values.capacity - 1 })}
              />
              <RoundButton
                icon="plus"
                accessibilityLabel="More spots"
                enabled={values.capacity < maxSpots}
                onPress={() => set({ capacity: values.capacity + 1 })}
              />
            </View>
          </View>
          <FieldError message={errors.capacity} />
        </View>
        <View {...anchor('description')}>
          <TextArea
            label="Details (optional)"
            placeholder="Skill level, what to bring, how you'll recognise each other"
            value={values.description}
            onChangeText={description => set({ description })}
            maxLength={descriptionMaxLength}
            error={errors.description}
          />
        </View>
      </Card>
    </FlowScreen>
  );
}

function SectionHeading({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.heading}>
      <View style={styles.headingIcon}>
        <Icon name={icon} size={18} color={colors.orchid} />
      </View>
      <Text variant="title" accessibilityRole="header">
        {label}
      </Text>
    </View>
  );
}

// Looks like an input; opens a calendar or a clock.
function PickerField({
  label,
  accessibilityName,
  value,
  icon,
  onPress,
}: {
  label?: string;
  accessibilityName?: string;
  value: string;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <View style={[styles.field, styles.fill]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? accessibilityName}: ${value}`}
        style={styles.picker}
      >
        <Text numberOfLines={1} style={styles.fill}>
          {value}
        </Text>
        <Icon name={icon} size={18} color={colors.orchid} />
      </Pressable>
    </View>
  );
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
    >
      <Text variant="bodySmall" color={colors.orchid} style={styles.bold}>
        {label}
      </Text>
    </Pressable>
  );
}

function RoundButton({
  icon,
  accessibilityLabel,
  enabled,
  onPress,
}: {
  icon: 'minus' | 'plus';
  accessibilityLabel: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [
        styles.round,
        pressed && styles.roundPressed,
        !enabled && styles.inactive,
      ]}
    >
      <Icon name={icon} size={sizes.icon.inline} />
    </Pressable>
  );
}

function FieldError({ message }: { message: string | undefined }) {
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
  card: { gap: spacing.md },
  field: { gap: 6 },
  label: { ...textStyles.bodySmall, fontFamily: fontFamily(fonts.text, '600') },
  bold: { fontFamily: fontFamily(fonts.text, '700'), color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.chip.gap },
  notice: { backgroundColor: colors.selected },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  type: {
    // Three to a row with two 8 gaps between them.
    width: '31%',
    flexGrow: 1,
    maxWidth: '33%',
    minHeight: 64,
    borderRadius: radius.r20,
    borderWidth: 1.5,
    borderColor: 'transparent',
    justifyContent: 'flex-end',
    gap: spacing.xxs,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  typeOn: { borderColor: colors.ink },
  typeLabel: {
    ...textStyles.bodySmall,
    fontFamily: fontFamily(fonts.text, '600'),
  },
  two: { flexDirection: 'row', gap: spacing.sm },
  picker: {
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
  caption: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  spots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spotsValue: { ...textStyles.h1 },
  stepButtons: { flexDirection: 'row', gap: spacing.xs },
  round: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundPressed: { backgroundColor: colors.tint },
  inactive: { opacity: 0.5 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
