"use client";

import { useEffect, useRef } from "react";

export function AudioVisualizer({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const heightsRef = useRef<number[]>([]);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    let animationId = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const width = container!.clientWidth;
      const height = container!.clientHeight;

      canvas!.width = Math.max(1, Math.floor(width * dpr));
      canvas!.height = Math.max(1, Math.floor(height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    const barCount = 36;
    const gap = 3;

    function draw() {
      animationId = requestAnimationFrame(draw);

      const width = container!.clientWidth;
      const height = container!.clientHeight;

      if (width === 0 || height === 0) {
        return;
      }

      ctx!.clearRect(0, 0, width, height);

      let averageVolume = 0;

      if (dataArray && analyser) {
        analyser.getByteFrequencyData(dataArray);

        for (let index = 0; index < dataArray.length; index += 1) {
          averageVolume += dataArray[index] ?? 0;
        }

        averageVolume /= dataArray.length;
      }

      const isSilent = averageVolume < 6;
      const barWidth = width / barCount;
      const maxBarHeight = height * 0.92;
      const minIdleHeight = height * 0.18;

      if (heightsRef.current.length !== barCount) {
        heightsRef.current = new Array(barCount).fill(minIdleHeight);
      }

      timeRef.current += 0.06;

      for (let index = 0; index < barCount; index += 1) {
        let targetHeight = 0;

        if (dataArray && analyser && !isSilent) {
          const step = Math.max(1, Math.floor(dataArray.length / barCount));
          const value = dataArray[index * step] ?? 0;
          const amplified = (value / 255) * 1.7;
          targetHeight = Math.min(maxBarHeight, amplified * maxBarHeight);
        } else {
          const wave = Math.sin(timeRef.current + index * 0.35);
          const normalized = (wave + 1) / 2;
          targetHeight = minIdleHeight + normalized * (maxBarHeight - minIdleHeight) * 0.55;
        }

        const previousHeight = heightsRef.current[index] ?? targetHeight;
        const smoothedHeight = previousHeight + (targetHeight - previousHeight) * 0.18;
        heightsRef.current[index] = smoothedHeight;

        const x = index * barWidth + gap / 2;
        const drawWidth = barWidth - gap;
        const y = height - smoothedHeight;

        ctx!.fillStyle = "#0f172a";
        ctx!.beginPath();
        ctx!.roundRect(x, y, drawWidth, smoothedHeight, drawWidth / 2);
        ctx!.fill();
      }
    }

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [analyser]);

  return (
    <div ref={containerRef} className="h-10 w-full">
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
    </div>
  );
}
