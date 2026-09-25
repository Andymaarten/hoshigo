"use client";

import { useState, useTransition } from "react";
import type { FollowState } from "@/lib/follows";
import { follow, unfollow } from "@/app/friends/actions";

export default function FollowButton({ otherId, handle, state }: { otherId: string; handle: string; state: FollowState }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  if (state === "unavailable") return null;

  if (state === "none") {
    return (
      <button type="button" className="btn" disabled={pending} onClick={() => start(async () => void (await follow(otherId, handle)))}>
        Follow
      </button>
    );
  }

  return confirming ? (
    <span className="friend-actions-inline">
      <button
        type="button"
        className="text-btn danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await unfollow(otherId, handle);
            setConfirming(false);
          })
        }
      >
        Yes, unfollow
      </button>
      <button type="button" className="text-btn" onClick={() => setConfirming(false)}>
        Keep following
      </button>
    </span>
  ) : (
    <button type="button" className="btn btn-on" onClick={() => setConfirming(true)}>
      Following
    </button>
  );
}
