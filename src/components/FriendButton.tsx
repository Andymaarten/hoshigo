"use client";

import { useState, useTransition } from "react";
import type { FriendState } from "@/lib/friends";
import { acceptFriend, addFriend, removeFriend } from "@/app/friends/actions";

export default function FriendButton({
  otherId,
  handle,
  state,
  name,
}: {
  otherId: string;
  handle: string;
  state: FriendState;
  name: string;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (state === "unavailable") return null;

  const run = (fn: typeof addFriend) => start(async () => void (await fn(otherId, handle)));

  return (
    <div className="friend-actions">
      {state === "none" && (
        <button type="button" className="btn" disabled={pending} onClick={() => run(addFriend)}>
          Add friend
        </button>
      )}
      {state === "outgoing" && (
        <>
          <span className="friend-status">Request sent.</span>
          <button type="button" className="text-btn" disabled={pending} onClick={() => run(removeFriend)}>
            Cancel request
          </button>
        </>
      )}
      {state === "incoming" && (
        <>
          <span className="friend-status">{name} would like to be friends.</span>
          <button type="button" className="btn" disabled={pending} onClick={() => run(acceptFriend)}>
            Accept request
          </button>
          <button type="button" className="text-btn" disabled={pending} onClick={() => run(removeFriend)}>
            Decline
          </button>
        </>
      )}
      {state === "friends" && (
        <>
          <span className="friend-status">You are friends.</span>
          {confirming ? (
            <>
              <button
                type="button"
                className="text-btn danger"
                disabled={pending}
                onClick={() => run(removeFriend)}
              >
                Yes, stop our friendship
              </button>
              <button type="button" className="text-btn" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" className="text-btn" onClick={() => setConfirming(true)}>
              Stop friendship
            </button>
          )}
        </>
      )}
    </div>
  );
}
