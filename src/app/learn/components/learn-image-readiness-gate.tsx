"use client";

import { useLayoutEffect } from "react";
import { preloadBonusRewardImage } from "@/features/quiz/bonus-reward-media";

const READY_ATTRIBUTE = "data-learn-image-ready";

function getImageSource(image: HTMLImageElement) {
  return image.currentSrc || image.src;
}

/**
 * Learn images remain visually blank until their actual selected source has
 * finished loading and decoding. No poster or alternate artwork is rendered.
 */
export function installLearnImageReadinessGate() {
  if (typeof document === "undefined") return () => undefined;

  const imageGenerations = new WeakMap<HTMLImageElement, number>();

  function invalidate(image: HTMLImageElement) {
    imageGenerations.set(image, (imageGenerations.get(image) ?? 0) + 1);
    image.removeAttribute(READY_ATTRIBUTE);
  }

  function decodeIfLoaded(image: HTMLImageElement) {
    if (!image.complete || image.naturalWidth <= 0) return;

    const generation = (imageGenerations.get(image) ?? 0) + 1;
    const source = getImageSource(image);
    imageGenerations.set(image, generation);

    const decoded = typeof image.decode === "function"
      ? image.decode()
      : Promise.resolve();

    void decoded.then(() => {
      if (
        image.isConnected &&
        imageGenerations.get(image) === generation &&
        getImageSource(image) === source &&
        image.complete &&
        image.naturalWidth > 0
      ) {
        image.setAttribute(READY_ATTRIBUTE, "true");
      }
    }).catch(() => {
      // A failed decode deliberately leaves the image hidden and blank.
    });
  }

  function visitImages(node: Node) {
    if (node instanceof HTMLImageElement) {
      decodeIfLoaded(node);
      return;
    }

    if (node instanceof Element) {
      node.querySelectorAll("img").forEach((image) => decodeIfLoaded(image));
    }
  }

  const handleLoad = (event: Event) => {
    if (event.target instanceof HTMLImageElement) {
      decodeIfLoaded(event.target);
    }
  };

  const handleError = (event: Event) => {
    if (event.target instanceof HTMLImageElement) {
      invalidate(event.target);
    }
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes" && record.target instanceof HTMLImageElement) {
        invalidate(record.target);
        if (record.attributeName !== "src") {
          decodeIfLoaded(record.target);
        }
        continue;
      }

      record.addedNodes.forEach(visitImages);
    }
  });

  document.querySelectorAll(`img[${READY_ATTRIBUTE}]`).forEach((image) => {
    image.removeAttribute(READY_ATTRIBUTE);
  });
  document.addEventListener("load", handleLoad, true);
  document.addEventListener("error", handleError, true);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "srcset", "sizes"],
  });
  document.querySelectorAll("img").forEach((image) => decodeIfLoaded(image));

  return () => {
    observer.disconnect();
    document.removeEventListener("load", handleLoad, true);
    document.removeEventListener("error", handleError, true);
  };
}

export function LearnImageReadinessGate() {
  useLayoutEffect(() => {
    const releaseBonusRewardImage = preloadBonusRewardImage();
    const releaseImageGate = installLearnImageReadinessGate();
    return () => {
      releaseImageGate();
      releaseBonusRewardImage();
    };
  }, []);
  return null;
}
