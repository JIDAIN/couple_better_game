import type { HTMLAttributes, ReactNode } from "react";
import {
  Card,
  Divider,
  Footer,
  Title,
  type FooterType,
  type TitleColor,
} from "animal-island-ui";
import { AppGameIcon, type GameIconName } from "./AppGameIcon";
import { AppRoleAvatar, type RoleKind } from "./AppRoleAvatar";

export type AppSceneKind =
  | "notice-board"
  | "growth-map"
  | "shop"
  | "nook-phone"
  | "notebook"
  | "toolbox"
  | "rules-board";

type SceneDividerType =
  | "line-brown"
  | "line-teal"
  | "line-white"
  | "line-yellow"
  | "wave-yellow";

const sceneLabel: Record<AppSceneKind, string> = {
  "notice-board": "island notice board",
  "growth-map": "growth map board",
  shop: "island shop shelf",
  "nook-phone": "NookPhone screen",
  notebook: "handbook notebook",
  toolbox: "save toolbox",
  "rules-board": "rules notice board",
};

export type AppSceneBoardProps = HTMLAttributes<HTMLElement> & {
  scene: AppSceneKind;
  children: ReactNode;
};

export function AppSceneBoard({
  scene,
  className = "",
  children,
  ...props
}: AppSceneBoardProps) {
  return (
    <section
      {...props}
      className={`app-scene-board app-scene-board--${scene} ${className}`.trim()}
      aria-label={props["aria-label"] ?? sceneLabel[scene]}
    >
      <AppDecorLayer scene={scene} />
      <div className="app-scene-board__inner">
        <Card className="app-scene-card" pattern={scene === "notice-board" ? "app-yellow" : "none"}>
          {children}
          <AppSceneBottomDecor scene={scene} />
        </Card>
      </div>
    </section>
  );
}

export type AppSceneTitleProps = {
  icon: GameIconName;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
};

export function AppSceneTitle({ icon, title, subtitle, action }: AppSceneTitleProps) {
  return (
    <header className="app-scene-title">
      <div className="app-scene-title__main">
        <div className="app-scene-title__copy">
          <Title size="middle" color={sceneTitleColor(icon)}>
            {title}
          </Title>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="app-scene-title__action">{action}</div> : null}
    </header>
  );
}

function sceneTitleColor(icon: GameIconName): TitleColor {
  if (icon === "calendar") return "warm-peach-pink";
  if (icon === "shop" || icon === "nest" || icon === "data") return "app-yellow";
  if (icon === "map") return "app-green";
  return "app-yellow";
}

export type AppSectionPanelProps = Omit<HTMLAttributes<HTMLDivElement>, "color"> & {
  title?: ReactNode;
  icon?: GameIconName;
  children: ReactNode;
};

export function AppSectionPanel({
  title,
  icon,
  className = "",
  children,
  ...props
}: AppSectionPanelProps) {
  return (
    <Card {...props} className={`app-section-scene-panel ${className}`.trim()}>
      {title ? (
        <div className="app-section-scene-panel__header">
          {icon ? <AppGameIcon name={icon} size={16} /> : null}
          <span>{title}</span>
        </div>
      ) : null}
      {children}
    </Card>
  );
}

export function AppItemRow({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={`app-item-scene-row ${className}`.trim()}>
      {children}
    </div>
  );
}

export function AppMascotPair({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`app-mascot-pair ${compact ? "app-mascot-pair--compact" : ""}`.trim()} aria-hidden>
      <AppRoleAvatar role="fish" size={compact ? 30 : 42} />
      <AppRoleAvatar role="cat" size={compact ? 30 : 42} />
    </div>
  );
}

export function AppSpeechBubble({ children }: { children: ReactNode }) {
  return <div className="app-speech-bubble">{children}</div>;
}

export function AppAnimalGuide({
  role = "cat",
  speech,
}: {
  role?: RoleKind;
  speech: ReactNode;
}) {
  return (
    <div className="app-animal-guide">
      <AppRoleAvatar role={role} size={34} />
      <AppSpeechBubble>{speech}</AppSpeechBubble>
    </div>
  );
}

export function AppSticker({
  icon,
  label,
}: {
  icon: GameIconName;
  label: string;
}) {
  return (
    <span className="app-sticker">
      <AppGameIcon name={icon} size={14} />
      <span>{label}</span>
    </span>
  );
}

export function AppDecorLayer({ scene }: { scene: AppSceneKind }) {
  return (
    <div className={`app-decor-layer app-decor-layer--${scene}`} aria-hidden>
      <span className="app-decor-pin app-decor-pin--a" />
      <span className="app-decor-pin app-decor-pin--b" />
      <Divider type={sceneDividerType(scene)} className="app-decor-divider" />
    </div>
  );
}

function sceneDividerType(scene: AppSceneKind): SceneDividerType {
  if (scene === "growth-map") return "wave-yellow";
  if (scene === "shop") return "line-yellow";
  if (scene === "nook-phone" || scene === "toolbox") return "line-teal";
  return "line-brown";
}

function sceneFooterType(scene: AppSceneKind): FooterType {
  if (scene === "growth-map" || scene === "notebook") return "sea";
  return "tree";
}

function AppSceneBottomDecor({ scene }: { scene: AppSceneKind }) {
  return (
    <div className={`app-scene-bottom-decor app-scene-bottom-decor--${scene}`} aria-hidden>
      <Footer type={sceneFooterType(scene)} className="app-scene-footer" />
    </div>
  );
}

export function AppNookPhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="app-nook-phone-frame">
      <div className="app-nook-phone-frame__screen">{children}</div>
    </div>
  );
}
