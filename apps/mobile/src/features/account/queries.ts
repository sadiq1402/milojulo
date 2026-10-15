import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { signOut } from '../auth/api';
import {
  deleteAccount,
  fetchDataRequests,
  fetchMyConsents,
  requestDataCopy,
  withdrawConsent,
} from './api';
import { useRefreshAccountStage } from './useAccountStage';

const consentsKey = ['my-consents'];
const dataRequestsKey = ['data-requests'];

export function useMyConsents() {
  return useQuery({ queryKey: consentsKey, queryFn: fetchMyConsents });
}

// A withdrawn consent hides the Member, so the stage moves back to the consent step.
export function useWithdrawConsent() {
  const client = useQueryClient();
  const refreshStage = useRefreshAccountStage();
  return useMutation({
    mutationFn: (documentId: string) => withdrawConsent(documentId),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: consentsKey }),
        refreshStage(),
      ]),
  });
}

export function useDataRequests() {
  return useQuery({ queryKey: dataRequestsKey, queryFn: fetchDataRequests });
}

export function useRequestDataCopy() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => requestDataCopy(),
    onSuccess: () => client.invalidateQueries({ queryKey: dataRequestsKey }),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      await deleteAccount();
      await signOut();
    },
  });
}
