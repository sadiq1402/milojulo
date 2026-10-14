import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import * as photos from '../src/features/photos/api';
import { usePhotoUrl } from '../src/features/photos/queries';

jest.mock('../src/features/photos/api');

function Url({ id }: { id: string }) {
  const url = usePhotoUrl(id);
  return <Text>{url.isSuccess ? `${id}=${url.data ?? 'none'}` : ''}</Text>;
}

async function renderIds(ids: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await render(
    <QueryClientProvider client={client}>
      {ids.map((id, i) => (
        <Url key={i} id={id} />
      ))}
    </QueryClientProvider>,
  );
}

test('photos shown together share one call, each id asked once', async () => {
  jest.mocked(photos.fetchPhotoUrls).mockResolvedValue({ a: 'A', b: 'B' });
  await renderIds(['a', 'b', 'a']);
  expect(await screen.findByText('b=B')).toBeOnTheScreen();
  expect(screen.getAllByText('a=A')).toHaveLength(2);
  expect(photos.fetchPhotoUrls).toHaveBeenCalledTimes(1);
  expect(photos.fetchPhotoUrls).toHaveBeenCalledWith(['a', 'b']);
});

test('a photo I may not see has no link', async () => {
  jest.mocked(photos.fetchPhotoUrls).mockResolvedValue({});
  await renderIds(['hidden']);
  expect(await screen.findByText('hidden=none')).toBeOnTheScreen();
});
