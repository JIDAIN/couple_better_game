import Image from "next/image";
import type { ReactNode } from "react";
import type { MealPhotoRotation } from "@/lib/nutrition/meal-service";

type MealPhotoFrameProps = {
  src: string;
  alt: string;
  rotationDegrees?: MealPhotoRotation | number | null;
  scale?: number | null;
  priority?: boolean;
  onError?: () => void;
  className?: string;
  children?: ReactNode;
};

function normalizeRotation(value: MealPhotoFrameProps["rotationDegrees"]): MealPhotoRotation {
  const numeric = Number(value ?? 0);
  return numeric === 90 || numeric === 180 || numeric === 270 ? numeric : 0;
}

function normalizeScale(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0.6, Math.min(1, Number(value)));
}

export function MealPhotoFrame({
  src,
  alt,
  rotationDegrees = 0,
  scale = 1,
  priority = false,
  onError,
  className = "",
  children,
}: MealPhotoFrameProps) {
  const rotation = normalizeRotation(rotationDegrees);
  const safeScale = normalizeScale(scale);
  const quarterTurn = rotation === 90 || rotation === 270;

  return (
    <div className={`relative aspect-[4/3] w-full overflow-hidden rounded-[var(--life-radius-control)] bg-[var(--life-surface-warm)] ${className}`}>
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: quarterTurn ? "75%" : "100%",
          height: quarterTurn ? "133.333333%" : "100%",
          transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${safeScale})`,
          transformOrigin: "center",
        }}
      >
        <Image
          unoptimized
          priority={priority}
          loading={priority ? "eager" : undefined}
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 480px) 42vw, 190px"
          className="object-contain"
          onError={onError}
        />
      </div>
      {children}
    </div>
  );
}
