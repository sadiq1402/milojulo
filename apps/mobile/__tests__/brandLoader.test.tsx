import { act, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { BrandLoader } from '../src/components/BrandLoader';
import * as account from '../src/features/account/api';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/consents/api');
afterEach(() => jest.restoreAllMocks());

// Lets JS-driven animation frames run inside act.
const wait = (ms: number) =>
  act(() => new Promise<void>(resolve => setTimeout(resolve, ms)));
const motionOn = () =>
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);

test('shows the logo, labelled MiloJulo', async () => {
  await render(<BrandLoader ready={false} onDone={() => {}} />);
  expect(screen.getByRole('image', { name: 'MiloJulo' })).toBeOnTheScreen();
});

test('with reduce motion on, the logo stands still and fully shown', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  await render(<BrandLoader ready={false} onDone={() => {}} />);
  await wait(0);
  expect(screen.getByTestId('brand-loader-logo')).toHaveStyle({
    opacity: 1,
    transform: [{ scale: 1 }],
  });
});

test('with motion on, the logo fades and scales in', async () => {
  motionOn();
  const { unmount } = await render(
    <BrandLoader ready={false} onDone={() => {}} />,
  );
  const opacity = () =>
    StyleSheet.flatten(screen.getByTestId('brand-loader-logo').props.style)
      .opacity;
  expect(opacity()).toBeLessThan(0.5);
  await wait(1000);
  expect(screen.getByTestId('brand-loader-logo')).toHaveStyle({ opacity: 1 });
  // Stops the pulse, whose next frame would land outside act.
  await unmount();
});

test('with motion on, it fades out and hands over well within a second of the app being ready', async () => {
  motionOn();
  const onDone = jest.fn();
  const { rerender } = await render(
    <BrandLoader ready={false} onDone={onDone} />,
  );
  await wait(100);
  await rerender(<BrandLoader ready onDone={onDone} />);
  expect(onDone).not.toHaveBeenCalled();
  await wait(500);
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('with reduce motion on, it hands over as soon as the app is ready', async () => {
  const onDone = jest.fn();
  const { rerender } = await render(
    <BrandLoader ready={false} onDone={onDone} />,
  );
  await rerender(<BrandLoader ready onDone={onDone} />);
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('the app shows the loader while the session restores', async () => {
  jest.mocked(account.fetchAccountStage).mockReturnValue(new Promise(() => {}));
  await renderApp(sessionFor('asha@example.com'));
  expect(screen.getByTestId('brand-loader')).toBeOnTheScreen();
});

test('the loader leaves once the app is ready', async () => {
  await renderApp(null);
  await waitFor(() =>
    expect(screen.queryByTestId('brand-loader')).not.toBeOnTheScreen(),
  );
  expect(screen.getByRole('button', { name: 'Get started' })).toBeOnTheScreen();
});
