import { useMutation } from '@tanstack/react-query';
import React, { useRef, useState } from 'react';
import {
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
  Input,
  Stepper,
  Text,
  TextArea,
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
  formatTime,
  indiaInstant,
  indiaParts,
  lastStartMinutes,
  minutesStep,
} from '../../features/activities/time';
import { areaShortlist } from '../../features/catalog/nearest';
import { useAllAreas } from '../../features/catalog/queries';
import {
  colors,
  sizes,
  spacing,
  textStyles,
  fontFamily,
  fonts,
} from '../../theme';
import { AreaSheet } from '../profileSetup/AreaPicker';

// The chosen Area and the nearest to it; the rest are under All areas.
const shortlistSize = 6;

export type FormValues = {
  title: string;
  type: ActivityType | null;
  areaId: string | null;
  // India calendar day and minutes after its midnight.
  day: string;
  minutes: number;
  // Minutes from start to end; null when there's no set end.
  length: number | null;
  capacity: number;
  description: string;
  venueDetail: string;
};

export const defaultLength = 120;
const maxLength = 12 * 60;

export function startsAtOf(values: FormValues): string {
  return indiaInstant(values.day, values.minutes);
}

export function endsAtOf(values: FormValues): string | null {
  return values.length === null
    ? null
    : indiaInstant(values.day, values.minutes + values.length);
}

function lengthLabel(length: number | null): string {
  if (length === null) {
    return 'No set end';
  }
  const hours = Math.floor(length / 60);
  const rest = length % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function endCaption(values: FormValues): string | null {
  const endsAt = endsAtOf(values);
  if (!endsAt) {
    return null;
  }
  const end = indiaParts(new Date(endsAt));
  return end.dateKey === values.day
    ? `Until ${formatTime(end.minutes)}`
    : `Until ${formatTime(end.minutes)} the next day`;
}

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
  areaId: 'areaId',
  day: 'startsAt',
  minutes: 'startsAt',
  length: 'endsAt',
  capacity: 'capacity',
  description: 'description',
  venueDetail: 'venueDetail',
};

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
  const areas = useAllAreas();
  const [pickingArea, setPickingArea] = useState(false);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Each field's top on the page, so a refusal can scroll back to the first flagged one.
  const tops = useRef<Partial<Record<ActivityField, number>>>({});
  const anchor = (field: ActivityField) => ({
    testID: `field-${field}`,
    onLayout: (e: LayoutChangeEvent) => {
      tops.current[field] = e.nativeEvent.layout.y;
    },
  });
  const scrollToFirst = (found: Errors) => {
    const ys = (Object.keys(found) as ActivityField[])
      .map(field => tops.current[field])
      .filter((y): y is number => y !== undefined);
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

  const todayKey = indiaParts(new Date()).dateKey;
  const days = dayOptions(todayKey);
  if (!days.includes(values.day)) {
    days.unshift(values.day);
  }
  const minCapacity = locked ? initial.capacity : minSpots;
  // The database keeps a set end when sent null, so an edit can't remove one.
  const canRemoveEnd = !editing || initial.length === null;
  const caption = endCaption(values);

  const check = (): Errors => {
    const found: Errors = {};
    if (!locked && !values.title.trim()) {
      found.title = fieldMessages.title;
    }
    if (!editing && !values.type) {
      found.type = fieldMessages.type;
    }
    if (!values.areaId) {
      found.areaId = fieldMessages.areaId;
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

  return (
    <FlowScreen
      scrollRef={scroll}
      title={heading}
      onBack={onBack}
      footer={
        <>
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
        <Card style={styles.locked}>
          <Text variant="bodySmall" color={colors.orchidDark}>
            Someone has joined, so the title, time, Area and venue stay as they
            are. You can still change the details or add Spots.
          </Text>
        </Card>
      ) : (
        <View {...anchor('title')}>
          <Input
            label="What's the plan?"
            placeholder="e.g. Badminton doubles"
            value={values.title}
            onChangeText={title => set({ title })}
            maxLength={titleMaxLength}
            error={errors.title}
          />
        </View>
      )}
      {editing ? null : (
        <View {...anchor('type')}>
          <ChipField label="Type" error={errors.type}>
            {activityTypes.map(type => (
              <Chip
                key={type}
                label={activityTypeLabels[type]}
                selected={values.type === type}
                onPress={() => set({ type })}
              />
            ))}
          </ChipField>
        </View>
      )}
      {locked ? null : (
        <>
          <View {...anchor('areaId')}>
            <ChipField label="Area" error={errors.areaId}>
              {areaShortlist(
                areas.data ?? [],
                null,
                values.areaId,
                shortlistSize,
              ).map(area => (
                <Chip
                  key={area.id}
                  label={area.label}
                  selected={values.areaId === area.id}
                  onPress={() => set({ areaId: area.id })}
                />
              ))}
              <Chip
                label="All areas"
                accessibilityHint="Opens the full list of Areas"
                action
                onPress={() => setPickingArea(true)}
              />
            </ChipField>
            <AreaSheet
              visible={pickingArea}
              title="Where is it?"
              areas={(areas.data ?? []).filter(area => area.active)}
              selected={values.areaId}
              onClose={() => setPickingArea(false)}
              onChoose={areaId => {
                set({ areaId });
                setPickingArea(false);
              }}
            />
          </View>
          <ChipField label="Day" error={undefined}>
            {days.map(day => (
              <Chip
                key={day}
                label={dayLabel(day, todayKey)}
                selected={values.day === day}
                onPress={() => set({ day })}
              />
            ))}
          </ChipField>
          <View style={styles.field} {...anchor('startsAt')}>
            <Stepper
              label="Start time"
              value={formatTime(values.minutes)}
              onDecrease={() => set({ minutes: values.minutes - minutesStep })}
              onIncrease={() => set({ minutes: values.minutes + minutesStep })}
              canDecrease={values.minutes > 0}
              canIncrease={values.minutes < lastStartMinutes}
              decreaseLabel="Earlier start"
              increaseLabel="Later start"
            />
            <FieldError message={errors.startsAt} />
          </View>
          <View style={styles.field} {...anchor('endsAt')}>
            <Stepper
              label="Length"
              value={lengthLabel(values.length)}
              // Below the shortest step comes "No set end", unless the end can't be removed.
              onDecrease={() =>
                set({
                  length:
                    values.length === minutesStep
                      ? null
                      : values.length! - minutesStep,
                })
              }
              onIncrease={() =>
                set({ length: (values.length ?? 0) + minutesStep })
              }
              canDecrease={
                values.length !== null &&
                (values.length > minutesStep || canRemoveEnd)
              }
              canIncrease={values.length === null || values.length < maxLength}
              decreaseLabel="Shorter"
              increaseLabel="Longer"
            />
            {caption ? (
              <Text variant="bodySmall" color={colors.secondary}>
                {caption}
              </Text>
            ) : null}
            <FieldError message={errors.endsAt} />
          </View>
        </>
      )}
      <View style={styles.field} {...anchor('capacity')}>
        <Stepper
          label="Spots"
          value={String(values.capacity)}
          onDecrease={() => set({ capacity: values.capacity - 1 })}
          onIncrease={() => set({ capacity: values.capacity + 1 })}
          canDecrease={values.capacity > minCapacity}
          canIncrease={values.capacity < maxSpots}
          decreaseLabel="Fewer spots"
          increaseLabel="More spots"
        />
        <Text variant="bodySmall" color={colors.secondary}>
          How many people can join you, not counting you.
        </Text>
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
      {locked ? null : (
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
            Only you and the people you accept see this.
          </Text>
        </View>
      )}
    </FlowScreen>
  );
}

function ChipField({
  label,
  error,
  children,
}: {
  label: string;
  error: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>{children}</View>
      <FieldError message={error} />
    </View>
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
  field: { gap: spacing.xs },
  label: { ...textStyles.bodySmall, fontFamily: fontFamily(fonts.text, '600') },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.chip.gap },
  locked: { backgroundColor: colors.selected },
  notice: { backgroundColor: colors.selected },
});
