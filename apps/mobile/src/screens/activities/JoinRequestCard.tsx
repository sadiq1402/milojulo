import React from 'react';
import { useRespondJoinRequest } from '../../features/activities/queries';
import { AnswerCard } from '../requests/AnswerCard';

// A waiting Join Request for the host, on the Activity and in the Inbox.
export function JoinRequestCard({
  requestId,
  name,
  photoId,
  detail,
  tone,
  onOpen,
  openLabel,
  onAccepted,
  canAnswer,
}: {
  requestId: string;
  name: string;
  photoId: string | null;
  detail?: string;
  tone: number;
  onOpen?: () => void;
  openLabel?: string;
  onAccepted?: (connectionId: string) => void;
  canAnswer?: boolean;
}) {
  const answer = useRespondJoinRequest(onAccepted);
  return (
    <AnswerCard
      name={name}
      photoId={photoId}
      detail={detail}
      tone={tone}
      onOpen={onOpen}
      openLabel={openLabel}
      error={answer.error?.message}
      answering={answer.isPending ? answer.variables?.accept : undefined}
      onAnswer={accept => answer.mutate({ requestId, accept })}
      answerLabel={verb => `${verb} ${name}'s Join Request`}
      canAnswer={canAnswer}
    />
  );
}
