import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Button, Chip, SegmentedControl } from '../src/components';

test('a disabled button ignores presses', async () => {
  const onPress = jest.fn();
  await render(<Button label="Send code" onPress={onPress} disabled />);
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  expect(onPress).not.toHaveBeenCalled();
});

test('a loading button is busy and ignores presses', async () => {
  const onPress = jest.fn();
  await render(<Button label="Send code" onPress={onPress} loading />);
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  expect(
    screen.getByRole('button', { name: 'Send code', busy: true }),
  ).toBeOnTheScreen();
  expect(onPress).not.toHaveBeenCalled();
});

test('a chip announces whether it is selected', async () => {
  await render(<Chip label="Badminton" selected onPress={() => {}} />);
  expect(
    screen.getByRole('button', { name: 'Badminton', selected: true }),
  ).toBeOnTheScreen();
});

test('a segmented control reports the segment pressed', async () => {
  const onChange = jest.fn();
  await render(
    <SegmentedControl
      options={[
        { value: 'requests', label: 'Requests' },
        { value: 'chats', label: 'Chats' },
      ]}
      value="requests"
      onChange={onChange}
    />,
  );
  expect(
    screen.getByRole('tab', { name: 'Requests', selected: true }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('tab', { name: 'Chats' }));
  expect(onChange).toHaveBeenCalledWith('chats');
});
