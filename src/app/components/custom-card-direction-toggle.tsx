"use client";

import { ArrowRight } from "lucide-react";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { CardsIcon } from "@/components/icons/cards-icon";
import { LanguageFlag } from "@/components/language-flag";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatSuperWaterText } from "@/lib/super-water";
import type { CreateCardDirection } from "@/features/cards/create-card-schema";
import type { LanguageCode } from "@/types/domain";

interface CustomCardDirectionToggleProps {
  value: CreateCardDirection;
  onChange: (value: CreateCardDirection) => void;
  learningLanguage: LanguageCode;
}

export function CustomCardDirectionToggle({ value, onChange, learningLanguage }: CustomCardDirectionToggleProps) {
  const t = useT();
  const { locale } = useLocale();

  const renderDirectionIcons = (direction: CreateCardDirection) => (
    <span
      aria-hidden="true"
      data-create-card-direction-icons={direction}
      className="inline-flex items-center justify-center gap-1.5"
    >
      <LanguageFlag
        code={direction === "learning-to-native" ? learningLanguage : locale}
        className="h-6 w-8 shrink-0"
        imageClassName="scale-100"
      />
      <ArrowRight className="size-5 shrink-0" strokeWidth={3} />
      {direction === "native-to-learning" ? (
        <LanguageFlag
          code={learningLanguage}
          className="h-6 w-8 shrink-0"
          imageClassName="scale-100"
        />
      ) : null}
      <CardsIcon className="size-6 shrink-0" strokeWidth={2.5} />
    </span>
  );

  return (
    <div data-create-card-direction-toggle>
      <SegmentedToggle
        value={value}
        onChange={onChange}
        className="control-gradient-outline w-full [&>button]:flex-1"
        selectedClassName="bg-brand !text-white hover:brightness-105"
        ariaLabel={t("createCard.direction.label")}
        labelClassName="text-black/60 transition-colors duration-300"
        optionProps={(direction) => ({
          "data-create-card-direction": direction,
          "aria-label": formatSuperWaterText(
            locale,
            t(
              direction === "learning-to-native"
                ? "createCard.direction.learningToNative"
                : "createCard.direction.nativeToLearning",
            ),
          ),
        })}
        options={[
          {
            value: "learning-to-native",
            label: renderDirectionIcons("learning-to-native"),
          },
          {
            value: "native-to-learning",
            label: renderDirectionIcons("native-to-learning"),
          },
        ]}
      />
    </div>
  );
}
