import Image from "next/image";
import type { MoodKey } from "@/lib/life/life-service";

const MOOD_ASSETS: Record<MoodKey, string> = {
  tired: "/illustrations/life/mood-tired.png",
  angry: "/illustrations/life/mood-angry.png",
  excited: "/illustrations/life/mood-excited.png",
  anxious: "/illustrations/life/mood-annoyed.png",
  neutral: "/illustrations/life/mood-love.png",
  calm: "/illustrations/life/mood-calm.png",
  sad: "/illustrations/life/mood-sad.png",
  happy: "/illustrations/life/mood-happy.png",
};

export function MoodIcon({ moodKey, label, className = "" }: { moodKey: MoodKey; label: string; className?: string }) {
  return <Image src={MOOD_ASSETS[moodKey]} alt={label} width={256} height={256} className={`select-none object-contain ${className}`.trim()} draggable={false} />;
}
