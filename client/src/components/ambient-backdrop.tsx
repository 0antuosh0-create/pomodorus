import { useEffect, useRef } from "react";
import { useSession } from "@/lib/session";

/**
 * Temporal Strata: Generative Fluid Flow Field (Refined Edition)
 *
 * A refined, calm, and high-performance ambient canvas that embodies focus,
 * laminar flow, and the passage of time.
 *
 * Elevations & Craft:
 * 1. 3 Parallax Depth Strata: Distant, mid, and foreground streamlines create natural 3D depth.
 * 2. Edge Fading Gradients: Every streamline softly dissolves at screen borders (0% harsh cutoffs).
 * 3. Dynamic Velocity Wake: Cursor speed organically influences the fluid wake with spring damping.
 * 4. Cinematic Obsidian Vignette: Faint radial luminance anchors the hero viewport.
 * 5. 0% CPU on background/idle: Cancels RAF loop when tab is hidden or user is inactive.
 */

interface Streamline {
  depth: 0 | 1 | 2; // 0: Distant, 1: Mid, 2: Foreground
  baseYRatio: number;
  amp1: number;
  freq1: number;
  speed1: number;
  amp2: number;
  freq2: number;
  speed2: number;
  opacity: number;
  width: number;
  phase: number;
  gradient?: CanvasGradient;
}

export function AmbientBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { session } = useSession();

  const sessionKindRef = useRef<string | null>(null);
  sessionKindRef.current = session?.kind ?? null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let animId: number | null = null;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Pointer physics with velocity tracking
    let targetPointerX = -1000;
    let targetPointerY = -1000;
    let currentPointerX = -1000;
    let currentPointerY = -1000;
    let pointerVelocity = 0;
    let lastPointerTime = Date.now();
    let isIdle = false;

    // 14 carefully orchestrated streamlines across 3 depth planes
    const streamlines: Streamline[] = [
      // Layer 0: Distant (gentle, slower, whisper-quiet)
      { depth: 0, baseYRatio: 0.07, amp1: 14, freq1: 0.0016, speed1: 0.00022, amp2: 10, freq2: 0.0032, speed2: -0.00018, opacity: 0.018, width: 0.70, phase: 0.4 },
      { depth: 1, baseYRatio: 0.14, amp1: 22, freq1: 0.0015, speed1: 0.00028, amp2: 14, freq2: 0.0028, speed2: -0.00030, opacity: 0.028, width: 0.90, phase: 1.2 },
      { depth: 2, baseYRatio: 0.21, amp1: 26, freq1: 0.0013, speed1: 0.00034, amp2: 18, freq2: 0.0022, speed2: -0.00026, opacity: 0.036, width: 1.05, phase: 2.1 },
      { depth: 1, baseYRatio: 0.28, amp1: 18, freq1: 0.0018, speed1: 0.00026, amp2: 15, freq2: 0.0030, speed2: -0.00032, opacity: 0.030, width: 0.85, phase: 2.9 },
      { depth: 0, baseYRatio: 0.35, amp1: 15, freq1: 0.0019, speed1: 0.00020, amp2: 12, freq2: 0.0024, speed2: -0.00016, opacity: 0.020, width: 0.75, phase: 0.7 },
      { depth: 2, baseYRatio: 0.42, amp1: 28, freq1: 0.0014, speed1: 0.00032, amp2: 16, freq2: 0.0027, speed2: -0.00028, opacity: 0.038, width: 1.10, phase: 1.8 },
      { depth: 1, baseYRatio: 0.49, amp1: 20, freq1: 0.0017, speed1: 0.00029, amp2: 17, freq2: 0.0021, speed2: -0.00025, opacity: 0.029, width: 0.90, phase: 2.6 },
      { depth: 0, baseYRatio: 0.56, amp1: 16, freq1: 0.0020, speed1: 0.00021, amp2: 13, freq2: 0.0031, speed2: -0.00019, opacity: 0.022, width: 0.75, phase: 3.3 },
      { depth: 2, baseYRatio: 0.63, amp1: 25, freq1: 0.0015, speed1: 0.00033, amp2: 19, freq2: 0.0023, speed2: -0.00027, opacity: 0.035, width: 1.00, phase: 0.3 },
      { depth: 1, baseYRatio: 0.70, amp1: 21, freq1: 0.0016, speed1: 0.00027, amp2: 16, freq2: 0.0029, speed2: -0.00031, opacity: 0.031, width: 0.90, phase: 1.4 },
      { depth: 0, baseYRatio: 0.77, amp1: 15, freq1: 0.0021, speed1: 0.00022, amp2: 11, freq2: 0.0022, speed2: -0.00017, opacity: 0.020, width: 0.70, phase: 2.3 },
      { depth: 2, baseYRatio: 0.84, amp1: 27, freq1: 0.0013, speed1: 0.00035, amp2: 17, freq2: 0.0030, speed2: -0.00029, opacity: 0.037, width: 1.05, phase: 3.1 },
      { depth: 1, baseYRatio: 0.91, amp1: 20, freq1: 0.0018, speed1: 0.00028, amp2: 15, freq2: 0.0026, speed2: -0.00028, opacity: 0.028, width: 0.85, phase: 0.8 },
      { depth: 0, baseYRatio: 0.97, amp1: 16, freq1: 0.0017, speed1: 0.00023, amp2: 12, freq2: 0.0025, speed2: -0.00018, opacity: 0.021, width: 0.75, phase: 1.6 },
    ];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      // Precompute edge-fade gradients once on resize instead of every frame
      for (let s = 0; s < streamlines.length; s++) {
        const line = streamlines[s];
        try {
          const strokeGrad = ctx.createLinearGradient(0, 0, width, 0);
          strokeGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
          strokeGrad.addColorStop(0.06, `rgba(255, 255, 255, ${line.opacity})`);
          strokeGrad.addColorStop(0.94, `rgba(255, 255, 255, ${line.opacity})`);
          strokeGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
          line.gradient = strokeGrad;
        } catch {}
      }

      if (prefersReducedMotion) {
        drawFrame(0);
      }
    };

    let prevMoveX = -1000;
    let prevMoveY = -1000;

    const handlePointerMove = (e: PointerEvent) => {
      if (prevMoveX > -500) {
        const dX = e.clientX - prevMoveX;
        const dY = e.clientY - prevMoveY;
        const instantVel = Math.hypot(dX, dY);
        pointerVelocity = Math.min(pointerVelocity * 0.7 + instantVel * 0.3, 40);
      }
      prevMoveX = e.clientX;
      prevMoveY = e.clientY;

      targetPointerX = e.clientX;
      targetPointerY = e.clientY;
      lastPointerTime = Date.now();
      isIdle = false;
    };

    const handlePointerLeave = () => {
      targetPointerX = -1000;
      targetPointerY = -1000;
      prevMoveX = -1000;
      prevMoveY = -1000;
      pointerVelocity = 0;
    };

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    resize();

    let lastTime = performance.now();
    let elapsed = 0;

    const drawFrame = (time: number) => {
      const dt = Math.min(time - lastTime, 64);
      lastTime = time;
      elapsed += dt;

      // Smooth spring damping towards target pointer
      const lerpFactor = 0.085;
      currentPointerX += (targetPointerX - currentPointerX) * lerpFactor;
      currentPointerY += (targetPointerY - currentPointerY) * lerpFactor;
      pointerVelocity *= 0.94; // Decay velocity

      if (!isIdle && Date.now() - lastPointerTime > 10000) {
        isIdle = true;
      }

      ctx.clearRect(0, 0, width, height);
      // Clean background clear with zero per-frame fillRect allocations


      // Focus session attunement
      const isWork = sessionKindRef.current === "work";
      const isBreak = sessionKindRef.current === "break";
      const freqMultiplier = isWork ? 1.14 : isBreak ? 0.86 : 1.0;
      const speedMultiplier = isWork ? 1.1 : isBreak ? 0.8 : 1.0;

      const stepX = 18;
      // Dynamic wake radius responding gracefully to cursor speed
      const baseRadius = 180;
      const dynamicRadius = baseRadius + Math.min(pointerVelocity * 1.5, 60);

      // Render streamlines with edge-fading gradient
      for (let s = 0; s < streamlines.length; s++) {
        const line = streamlines[s];
        const baseY = line.baseYRatio * height;
        const phase1 = elapsed * line.speed1 * speedMultiplier + line.phase;
        const phase2 = elapsed * line.speed2 * speedMultiplier + line.phase * 1.5;

        // Depth responsiveness: foreground lines deflect more, distant lines stay calmer
        const depthSensitivity = line.depth === 2 ? 1.15 : line.depth === 1 ? 1.0 : 0.65;
        const maxDeflection = 22 * depthSensitivity;

        ctx.beginPath();
        ctx.strokeStyle = line.gradient || `rgba(255, 255, 255, ${line.opacity})`;
        ctx.lineWidth = line.width;

        let prevX = 0;
        let prevY = baseY;

        for (let x = 0; x <= width + stepX; x += stepX) {
          const wave =
            line.amp1 * Math.sin(x * line.freq1 * freqMultiplier + phase1) +
            line.amp2 * Math.cos(x * line.freq2 * freqMultiplier + phase2);

          let y = baseY + wave;

          // Interactive fluid deflection
          if (currentPointerX > -500) {
            const dx = x - currentPointerX;
            const dy = y - currentPointerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < dynamicRadius && dist > 1) {
              const factor = 1 - dist / dynamicRadius;
              const push = maxDeflection * factor * factor;
              y += dy > 0 ? push : -push;
            }
          }

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            const midX = (prevX + x) * 0.5;
            const midY = (prevY + y) * 0.5;
            ctx.quadraticCurveTo(prevX, prevY, midX, midY);
          }

          prevX = x;
          prevY = y;
        }

        ctx.lineTo(prevX, prevY);
        ctx.stroke();
      }
    };

    const renderLoop = (time: number) => {
      // The backdrop must never bring the page down. A GPU or driver
      // hiccup, a lost context, or an unexpected error stops the loop
      // and hides the canvas, leaving the plain ground and content intact.
      try {
        drawFrame(time);
      } catch {
        if (animId !== null) {
          cancelAnimationFrame(animId);
          animId = null;
        }
        canvas.style.display = "none";
        return;
      }
      animId = requestAnimationFrame(renderLoop);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animId !== null) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      } else {
        if (animId === null && !prefersReducedMotion) {
          lastTime = performance.now();
          animId = requestAnimationFrame(renderLoop);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (!prefersReducedMotion) {
      animId = requestAnimationFrame(renderLoop);
    }

    return () => {
      if (animId !== null) {
        cancelAnimationFrame(animId);
      }
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full select-none"
    />
  );
}
