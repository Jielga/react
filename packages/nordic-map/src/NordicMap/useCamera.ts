import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clampCamera, homeCamera, panBy, sameCamera, zoomAround } from "./camera.ts";
import type { Camera, Frame, Point } from "./camera.ts";

type Animation =
  /** Eases the zoom toward `targetK`. Wheel steps add to the target, so fast scrolling stays smooth. */
  | { kind: "zoom"; targetK: number; anchor: Point }
  /** Keeps a released pan moving and slows it down. Velocity in pixels per millisecond. */
  | { kind: "fling"; velocity: Point }
  | { kind: "tween"; from: Camera; to: Camera; startTime: number; duration: number };

/** How fast a wheel zoom catches up with its target, in milliseconds */
const ZOOM_EASING_MS = 80;
/** How fast a fling slows down, in milliseconds */
const FLING_DECAY_MS = 250;
/** A fling stops below this speed, in pixels per millisecond */
const FLING_MIN_SPEED = 0.02;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export type CameraControls = {
  /** The current camera, or null until the frame is known */
  camera: Camera | null;
  /** Stops any animation and sets the camera from the current one */
  update: (change: (camera: Camera, frame: Frame) => Camera) => void;
  /** Zooms by `factor` around `anchor` (screen pixels), eased */
  zoomSmooth: (args: { anchor: Point; factor: number }) => void;
  /** Keeps panning with `velocity` (pixels per millisecond) and slows down */
  fling: (velocity: Point) => void;
  /**
   * Moves to the camera `to` returns for the current frame, eased over `duration` milliseconds,
   * or at once when `duration` is 0
   */
  moveTo: (args: { to: (frame: Frame) => Camera; duration: number }) => void;
  stop: () => void;
};

/**
 * Camera state with animations. The camera stays valid for the frame: it is clamped again when the view is resized.
 */
export function useCamera(frame: Frame | null): CameraControls {
  const [stored, setStored] = useState<Camera | null>(null);
  const camera = frame ? clampCamera({ camera: stored ?? homeCamera(frame), frame }) : null;

  // Animations run between renders, so they read the newest camera and frame from here
  const latest = useRef<{ camera: Camera | null; frame: Frame | null }>({ camera, frame });
  useLayoutEffect(() => {
    latest.current = { camera, frame };
  });

  const animation = useRef<Animation | null>(null);
  const frameRequest = useRef<number | null>(null);
  const lastTime = useRef(0);

  function commit(next: Camera) {
    latest.current = { ...latest.current, camera: next };
    setStored(next);
  }

  function stop() {
    if (frameRequest.current !== null) {
      cancelAnimationFrame(frameRequest.current);
    }
    frameRequest.current = null;
    animation.current = null;
  }

  function tick(time: number) {
    // Cap the step, so a tab that was in the background does not jump
    const dt = clamp(time - lastTime.current, 0, 64);
    lastTime.current = time;
    const current = animation.current;
    const { camera: from, frame: currentFrame } = latest.current;
    if (!current || !from || !currentFrame) {
      stop();
      return;
    }

    let next: Camera;
    let done: boolean;
    if (current.kind === "zoom") {
      const logK = lerp(Math.log(from.k), Math.log(current.targetK), 1 - Math.exp(-dt / ZOOM_EASING_MS));
      done = Math.abs(Math.log(current.targetK) - logK) < 0.002;
      next = zoomAround({ camera: from, frame: currentFrame, anchor: current.anchor, k: done ? current.targetK : Math.exp(logK) });
    } else if (current.kind === "fling") {
      const [vx, vy] = current.velocity;
      next = panBy({ camera: from, frame: currentFrame, delta: [vx * dt, vy * dt] });
      const decay = Math.exp(-dt / FLING_DECAY_MS);
      current.velocity = [vx * decay, vy * decay];
      // Also stop when the map edge blocks the movement
      done = Math.hypot(vx, vy) * decay < FLING_MIN_SPEED || sameCamera(next, from);
    } else {
      const progress = clamp((time - current.startTime) / current.duration, 0, 1);
      const eased = 1 - (1 - progress) ** 3;
      next = clampCamera({
        camera: {
          k: Math.exp(lerp(Math.log(current.from.k), Math.log(current.to.k), eased)),
          center: [
            lerp(current.from.center[0], current.to.center[0], eased),
            lerp(current.from.center[1], current.to.center[1], eased),
          ],
        },
        frame: currentFrame,
      });
      done = progress >= 1;
    }

    commit(next);
    if (done) {
      animation.current = null;
      frameRequest.current = null;
    } else {
      frameRequest.current = requestAnimationFrame(tick);
    }
  }

  function start(next: Animation) {
    animation.current = next;
    if (frameRequest.current === null) {
      lastTime.current = performance.now();
      frameRequest.current = requestAnimationFrame(tick);
    }
  }

  useEffect(() => {
    return () => {
      if (frameRequest.current !== null) {
        cancelAnimationFrame(frameRequest.current);
      }
    };
  }, []);

  return {
    camera,
    update: (change) => {
      stop();
      const { camera: from, frame: currentFrame } = latest.current;
      if (from && currentFrame) {
        commit(clampCamera({ camera: change(from, currentFrame), frame: currentFrame }));
      }
    },
    zoomSmooth: ({ anchor, factor }) => {
      const { camera: from, frame: currentFrame } = latest.current;
      if (!from || !currentFrame) {
        return;
      }
      const running = animation.current;
      const baseK = running?.kind === "zoom" ? running.targetK : from.k;
      if (running?.kind !== "zoom") {
        stop();
      }
      start({ kind: "zoom", targetK: clamp(baseK * factor, 1, currentFrame.maxZoom), anchor });
    },
    fling: (velocity) => {
      stop();
      if (Math.hypot(velocity[0], velocity[1]) >= FLING_MIN_SPEED) {
        start({ kind: "fling", velocity });
      }
    },
    moveTo: ({ to, duration }) => {
      const { camera: from, frame: currentFrame } = latest.current;
      stop();
      if (!from || !currentFrame) {
        return;
      }
      const target = clampCamera({ camera: to(currentFrame), frame: currentFrame });
      if (duration <= 0) {
        commit(target);
        return;
      }
      start({ kind: "tween", from, to: target, startTime: performance.now(), duration });
    },
    stop,
  };
}
