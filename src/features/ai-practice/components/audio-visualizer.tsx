"use client";

import { useEffect, useRef } from "react";

export function AudioVisualizer({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !analyser) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const currentCanvas = canvas;
    const currentCtx = ctx;
    const currentAnalyser = analyser;
    const bufferLength = currentAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId = 0;

    function draw() {
      animationId = requestAnimationFrame(draw);
      currentAnalyser.getByteFrequencyData(dataArray);

      const width = currentCanvas.width;
      const height = currentCanvas.height;
      const barCount = 24;
      const barWidth = width / barCount;
      const step = Math.floor(bufferLength / barCount);

      currentCtx.clearRect(0, 0, width, height);
      currentCtx.fillStyle = "#0f172a";

      for (let index = 0; index < barCount; index += 1) {
        const value = dataArray[index * step] ?? 0;
        const barHeight = (value / 255) * height * 0.9;
        const x = index * barWidth + barWidth * 0.15;
        const y = height - barHeight;
        const roundedBarWidth = barWidth * 0.7;

        currentCtx.beginPath();
        currentCtx.roundRect(x, y, roundedBarWidth, barHeight, roundedBarWidth / 2);
        currentCtx.fill();
      }
    }

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={40}
      className="h-10 w-full max-w-[15rem]"
      aria-hidden="true"
    />
  );
}
